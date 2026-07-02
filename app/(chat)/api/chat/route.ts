import { readFile } from "node:fs/promises";
import path from "node:path";
import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
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
import { getLanguageModel } from "@/lib/ai/providers";
import { webSearch } from "@/lib/ai/tools/web-search";

import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import { publishChatEvent } from "@/lib/realtime/events";
import { getResumableStreamContext } from "@/lib/streams/resumable";
import type { ChatMessage } from "@/lib/types";
import {
  getUploadPath,
  isSafeUploadFilename,
  readUploadMetadata,
} from "@/lib/uploads";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

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
      selectedChatModel,
      selectedVisibilityType,
      webSearchEnabled,
      isOneTimeChat,
    } = requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const allowedModelIds = await getAllowedModelIds();
    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const models = await getAllModels();
    const modelName = models.find((m) => m.id === chatModel)?.name ?? chatModel;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages) && !isOneTimeChat;

    const chat = isOneTimeChat ? null : await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (!isOneTimeChat && message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
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
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isOneTimeChat) {
      uiMessages = (messages ?? (message ? [message] : [])) as ChatMessage[];
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

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (!isOneTimeChat && message?.role === "user") {
      const createdAt = new Date();
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
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
          messageId: message.id,
          role: "user",
          createdAt: createdAt.toISOString(),
        },
      });
    }

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

        const result = streamText({
          model: getLanguageModel(chatModel),
          system: systemPrompt({
            requestHints,
            webSearchEnabled: canUseWebSearch,
          }),
          messages: modelMessages,
          stopWhen: canUseWebSearch ? stepCountIs(2) : stepCountIs(5),
          tools: canUseWebSearch ? { webSearch } : undefined,
          toolChoice: canUseWebSearch ? "auto" : "none",
          prepareStep: canUseWebSearch
            ? ({ stepNumber }) =>
                stepNumber === 0
                  ? {
                      activeTools: ["webSearch"],
                      toolChoice: "auto",
                    }
                  : { activeTools: [], toolChoice: "none" }
            : undefined,
          providerOptions: {},
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onChunk: () => {
            if (firstChunkTime === undefined) {
              firstChunkTime = Date.now() - startTime;
            }
          },
        });

        dataStream.merge(
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
          })
        );

        if (titlePromise) {
          const title = await titlePromise;
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
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "AI Gateway requires a valid credit card on file to service requests. Please visit https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card to add a card and unlock your free credits.";
        }
        return "Oops, an error occurred!";
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
