import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type InferUIMessageChunk,
  type StepResult,
  stepCountIs,
  streamText,
} from "ai";
import sharp from "sharp";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  DEFAULT_CHAT_MODEL,
  getAllModels,
  getAllowedModelIds,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  getMissingProviderConfig,
  getProviderFromModelId,
  normalizeModelIdForGateway,
  shouldUseGateway,
} from "@/lib/ai/provider-config";
import { getLanguageModel } from "@/lib/ai/providers";
import type { ReasoningEffort } from "@/lib/ai/reasoning";
import { webSearch } from "@/lib/ai/tools/web-search";
import { getWebSearchStepSettings } from "@/lib/ai/web-search-step";

import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastModelById,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError, getErrorMessageFromUnknown } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { publishChatEvent } from "@/lib/realtime/events";
import { getResumableStreamContext } from "@/lib/streams/resumable";
import type { ChatMessage } from "@/lib/types";
import {
  getUploadPath,
  isSafeUploadFilename,
  readUploadMetadata,
} from "@/lib/uploads";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function searchResultCount(output: unknown) {
  if (
    output &&
    typeof output === "object" &&
    "results" in output &&
    Array.isArray(output.results)
  ) {
    return output.results.length;
  }

  return 0;
}

function withSearchAnswerFallback(
  stream: ReadableStream<InferUIMessageChunk<ChatMessage>>,
  context: { chatId: string; modelId: string }
) {
  let sawSearchOutput = false;
  let sawTextAfterSearch = false;

  return stream.pipeThrough(
    new TransformStream<InferUIMessageChunk<ChatMessage>>({
      transform(chunk, controller) {
        if (
          chunk.type === "tool-output-available" &&
          searchResultCount(chunk.output) > 0
        ) {
          sawSearchOutput = true;
        }

        if (
          sawSearchOutput &&
          chunk.type === "text-delta" &&
          chunk.delta.trim().length > 0
        ) {
          sawTextAfterSearch = true;
        }

        if (chunk.type === "finish" && sawSearchOutput && !sawTextAfterSearch) {
          const textId = generateUUID();
          const fallbackText =
            "I found search results, but the model finished without producing a visible answer. Please retry the message; the search results above did come back successfully.";

          console.error("Search turn finished without answer text", context);

          controller.enqueue({ type: "text-start", id: textId });
          controller.enqueue({
            type: "text-delta",
            id: textId,
            delta: fallbackText,
          });
          controller.enqueue({ type: "text-end", id: textId });
        }

        controller.enqueue(chunk);
      },
    })
  );
}

function getFallbackTitleFromMessage(message: ChatMessage) {
  const text = getTextFromMessage(message).replace(/\s+/g, " ").trim();

  if (!text) {
    return "New chat";
  }

  return text.length > 80 ? `${text.slice(0, 77).trim()}...` : text;
}

function getReasoningProviderOptions({
  chatModel,
  effort,
  isReasoningModel,
}: {
  chatModel: string;
  effort?: ReasoningEffort;
  isReasoningModel: boolean;
}): SharedV3ProviderOptions {
  if (!isReasoningModel || !effort || effort === "auto") {
    return {};
  }

  if (shouldUseGateway(chatModel)) {
    return {};
  }

  const provider = getProviderFromModelId(chatModel);

  if (provider === "opencodego") {
    return {
      opencodego: {
        reasoningEffort: effort,
      },
    };
  }

  if (provider === "openai" || provider === "openrouter") {
    return {
      openai: {
        reasoningEffort: effort,
      },
    };
  }

  return {};
}

async function saveAssistantErrorMessage({
  chatId,
  errorText,
  modelId,
  modelName,
  userId,
}: {
  chatId: string;
  errorText: string;
  modelId: string;
  modelName: string;
  userId: string;
}) {
  const createdAt = new Date();
  const messageId = generateUUID();

  await saveMessages({
    messages: [
      {
        id: messageId,
        role: "assistant",
        parts: [{ type: "error", errorText }] as DBMessage["parts"],
        createdAt,
        attachments: [],
        chatId,
        metadata: {
          modelId,
          modelName,
        } as DBMessage["metadata"],
      },
    ],
  });

  await publishChatEvent({
    userId,
    event: {
      type: "message.created",
      chatId,
      messageId,
      role: "assistant",
      createdAt: createdAt.toISOString(),
    },
  });
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      trigger,
      messageId,
      selectedChatModel,
      selectedReasoningEffort,
      selectedVisibilityType,
      webSearchEnabled,
      isOneTimeChat,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const allowedModelIds = await getAllowedModelIds();
    const firstAllowedModel = allowedModelIds.values().next().value;
    const normalizedSelectedChatModel =
      normalizeModelIdForGateway(selectedChatModel);
    const chatModel = allowedModelIds.has(normalizedSelectedChatModel)
      ? normalizedSelectedChatModel
      : (firstAllowedModel ?? DEFAULT_CHAT_MODEL);

    const missingProviderConfig = getMissingProviderConfig(chatModel);

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isRegenerate = trigger === "regenerate-message";
    const isToolApprovalFlow =
      Boolean(messages) && !isOneTimeChat && !isRegenerate;

    const chat = isOneTimeChat ? null : await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let regeneratedUserMessage: ChatMessage | null = null;
    let titlePromise: Promise<string | null> | null = null;
    let shouldGenerateTitle = false;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });

      if (isRegenerate && messageId) {
        const messageToRegenerate = messagesFromDb.find(
          (currentMessage) => currentMessage.id === messageId
        );

        if (!messageToRegenerate) {
          return new ChatbotError("bad_request:api").toResponse();
        }

        await deleteMessagesByChatIdAfterTimestamp({
          chatId: id,
          timestamp: messageToRegenerate.createdAt,
        });

        messagesFromDb = await getMessagesByChatId({ id });

        if (messageToRegenerate.role === "user") {
          const retryMessage =
            messages?.find(
              (currentMessage) => currentMessage.id === messageId
            ) ?? (message?.id === messageId ? message : undefined);

          if (retryMessage?.role !== "user") {
            return new ChatbotError("bad_request:api").toResponse();
          }

          regeneratedUserMessage = retryMessage as ChatMessage;
        }
      }
    } else if (!isOneTimeChat && message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
        lastModelId: chatModel,
      });
      await publishChatEvent({
        userId: session.user.id,
        event: {
          type: "chat.created",
          chatId: id,
          title: "New chat",
          createdAt: new Date().toISOString(),
        },
      });
      shouldGenerateTitle = true;
    }

    if (chat && !isOneTimeChat && chat.lastModelId !== chatModel) {
      await updateChatLastModelById({ chatId: id, lastModelId: chatModel });
    }

    let uiMessages: ChatMessage[];

    const regenerateUserMessage =
      regeneratedUserMessage ??
      (isRegenerate && message?.role === "user" ? message : null);

    if (isOneTimeChat) {
      uiMessages = (messages ?? (message ? [message] : [])) as ChatMessage[];
    } else if (isRegenerate) {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        ...(regenerateUserMessage ? [regenerateUserMessage] : []),
      ];
    } else if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);
    const timezone = request.headers.get("x-vercel-ip-timezone") ?? undefined;

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
      timezone,
    };

    const userMessageToSave =
      !isOneTimeChat && message?.role === "user"
        ? message
        : regeneratedUserMessage;

    if (userMessageToSave) {
      const createdAt = new Date();
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: userMessageToSave.id,
            role: "user",
            parts: userMessageToSave.parts,
            attachments: [],
            createdAt,
            metadata: null,
          },
        ],
      });
      await publishChatEvent({
        userId: session.user.id,
        event: {
          type: "message.created",
          chatId: id,
          messageId: userMessageToSave.id,
          role: "user",
          createdAt: createdAt.toISOString(),
        },
      });
    }

    if (missingProviderConfig) {
      const providerConfigError = new ChatbotError(
        "bad_request:chat",
        `${missingProviderConfig.providerName} is missing ${missingProviderConfig.envVar}.`
      );
      const normalizedError = getErrorMessageFromUnknown(providerConfigError);
      const errorText = normalizedError.detail
        ? `${normalizedError.message}\n${normalizedError.detail}`
        : normalizedError.message;

      if (!isOneTimeChat) {
        if (shouldGenerateTitle && message?.role === "user") {
          const title = getFallbackTitleFromMessage(message);
          await updateChatTitleById({ chatId: id, title });
          await publishChatEvent({
            userId: session.user.id,
            event: {
              type: "chat.title.updated",
              chatId: id,
              title,
            },
          });
        }

        await saveAssistantErrorMessage({
          chatId: id,
          errorText,
          modelId: chatModel,
          modelName: chatModel,
          userId: session.user.id,
        });
      }

      return providerConfigError.toResponse();
    }

    if (shouldGenerateTitle && message?.role === "user") {
      titlePromise = generateTitleFromUserMessage({
        message,
        abortSignal: request.signal,
      }).catch((error: unknown) => {
        if (request.signal.aborted) {
          return null;
        }

        throw error;
      });
    }

    const models = await getAllModels();
    const modelName = models.find((m) => m.id === chatModel)?.name ?? chatModel;

    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const canUseWebSearch =
      webSearchEnabled === true && capabilities?.tools !== false;

    const resolvedMessages = await Promise.all(
      uiMessages.map(async (msg) => ({
        ...msg,
        parts: await Promise.all(
          msg.parts.map(async (part) => {
            if (part.type === "file" && part.url?.startsWith("/uploads/")) {
              try {
                const filename = path.basename(part.url);

                if (!isSafeUploadFilename(filename)) {
                  return part;
                }

                const metadata = await readUploadMetadata(filename);
                if (metadata.userId !== session.user.id) {
                  console.error("Blocked unauthorized upload reference:", {
                    filename,
                  });
                  return part;
                }

                const buffer = await readFile(getUploadPath(filename));

                if (buffer.length === 0) {
                  console.error("Empty file for base64 inline:", part.url);
                  return part;
                }

                if (part.mediaType?.startsWith("image/")) {
                  try {
                    await sharp(buffer).toBuffer();
                  } catch {
                    console.error(
                      "Invalid image file for base64 inline:",
                      part.url
                    );
                    return part;
                  }
                }

                const dataUrl = `data:${part.mediaType ?? "application/octet-stream"};base64,${buffer.toString("base64")}`;
                return { ...part, url: dataUrl };
              } catch (error) {
                console.error("Failed to read file for base64 inline:", error);
                return part;
              }
            }
            return part;
          })
        ),
      }))
    );

    const modelMessages = await convertToModelMessages(resolvedMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const startTime = Date.now();
        let firstChunkTime: number | undefined;
        const baseSystemPrompt = systemPrompt({
          requestHints,
          webSearchEnabled: canUseWebSearch,
        });

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: baseSystemPrompt,
          messages: modelMessages,
          abortSignal: request.signal,
          stopWhen: canUseWebSearch ? stepCountIs(2) : stepCountIs(5),
          tools: canUseWebSearch ? { webSearch } : undefined,
          toolChoice: canUseWebSearch ? "auto" : "none",
          prepareStep: canUseWebSearch
            ? ({ stepNumber }) =>
                getWebSearchStepSettings({ baseSystemPrompt, stepNumber })
            : undefined,
          providerOptions: getReasoningProviderOptions({
            chatModel,
            effort: selectedReasoningEffort,
            isReasoningModel,
          }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onStepFinish: (step: StepResult<{ webSearch: typeof webSearch }>) => {
            if (!canUseWebSearch) {
              return;
            }

            console.info("AI search step finished", {
              chatId: id,
              modelId: chatModel,
              stepNumber: step.stepNumber,
              finishReason: step.finishReason,
              textLength: step.text.trim().length,
              reasoningLength: step.reasoningText?.trim().length ?? 0,
              toolCalls: step.toolCalls.map((toolCall) => toolCall.toolName),
              toolResultCount: step.toolResults.reduce(
                (count, toolResult) =>
                  count + searchResultCount(toolResult.output),
                0
              ),
            });
          },
          onChunk: () => {
            if (firstChunkTime === undefined) {
              firstChunkTime = Date.now() - startTime;
            }
          },
        });

        dataStream.merge(
          withSearchAnswerFallback(
            result.toUIMessageStream({
              sendReasoning: isReasoningModel,
              messageMetadata: ({ part }) => {
                if (part.type === "finish") {
                  return {
                    modelId: chatModel,
                    modelName,
                    usage: {
                      inputTokens: part.totalUsage.inputTokens ?? 0,
                      outputTokens: part.totalUsage.outputTokens ?? 0,
                      totalTokens: part.totalUsage.totalTokens ?? 0,
                    },
                    duration: Date.now() - startTime,
                    timeToFirstToken: firstChunkTime,
                  };
                }
                return undefined;
              },
            }),
            { chatId: id, modelId: chatModel }
          )
        );

        if (titlePromise) {
          const title = await titlePromise;
          if (title === null) {
            return;
          }

          dataStream.write({ type: "data-chat-title", data: title });
          await updateChatTitleById({ chatId: id, title });
          await publishChatEvent({
            userId: session.user.id,
            event: {
              type: "chat.title.updated",
              chatId: id,
              title,
            },
          });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isOneTimeChat) {
          return;
        }

        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
                metadata: finishedMsg.metadata as DBMessage["metadata"],
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                    metadata: finishedMsg.metadata as DBMessage["metadata"],
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          const createdAt = new Date();
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt,
              attachments: [],
              chatId: id,
              metadata: currentMessage.metadata as DBMessage["metadata"],
            })),
          });
          for (const finishedMessage of finishedMessages) {
            if (finishedMessage.role !== "user") {
              await publishChatEvent({
                userId: session.user.id,
                event: {
                  type: "message.created",
                  chatId: id,
                  messageId: finishedMessage.id,
                  role: finishedMessage.role,
                  createdAt: createdAt.toISOString(),
                },
              });
            }
          }
        }
      },
      onError: (error) => {
        const { detail, message: errorMessage } = getErrorMessageFromUnknown(
          error,
          "The assistant response failed."
        );

        console.error("AI stream failed:", error);

        if (
          errorMessage.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }

        return detail ? `${errorMessage}\n${detail}` : errorMessage;
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (isOneTimeChat || !process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getResumableStreamContext();
          if (streamContext) {
            const streamId = generateUUID();
            await createStreamId({ streamId, chatId: id });
            await publishChatEvent({
              userId: session.user.id,
              event: {
                type: "chat.stream.created",
                chatId: id,
                streamId,
              },
            });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  await publishChatEvent({
    userId: session.user.id,
    event: {
      type: "chat.deleted",
      chatId: id,
    },
  });

  return Response.json(deletedChat, { status: 200 });
}
