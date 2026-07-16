import type { ChatMessage } from "@/lib/types";
import { selectRecentChatMessages } from "./chat-context";

type ChatRequestInput = {
  isOneTimeChat: boolean;
  messageId?: string;
  messages: ChatMessage[];
  trigger?: "submit-message" | "regenerate-message" | "resume-stream";
};

type ChatRequestMessages = {
  clientContextWasTruncated?: true;
  message?: ChatMessage;
  messages?: ChatMessage[];
};

function isApprovalResponsePart(part: ChatMessage["parts"][number]) {
  if (!("state" in part)) {
    return false;
  }

  return part.state === "approval-responded" || part.state === "output-denied";
}

function compactApprovalMessage(message: ChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.flatMap((part) => {
      if (!isApprovalResponsePart(part)) {
        return [];
      }

      const runtimePart = part as unknown as Record<string, unknown>;
      return [
        {
          type: runtimePart.type,
          toolCallId: runtimePart.toolCallId,
          state: runtimePart.state,
          ...(runtimePart.approval === undefined
            ? {}
            : { approval: runtimePart.approval }),
        } as ChatMessage["parts"][number],
      ];
    }),
  } as ChatMessage;
}

/**
 * Keeps chat POST bodies independent of the length of a persisted chat.
 * Persisted history is authoritative on the server; the client only needs to
 * send the new user message or the small approval/regeneration delta.
 */
export function selectChatRequestMessages({
  isOneTimeChat,
  messageId,
  messages,
  trigger,
}: ChatRequestInput): ChatRequestMessages {
  const lastMessage = messages.at(-1);

  if (isOneTimeChat) {
    const recent = selectRecentChatMessages(messages);
    return {
      messages: recent.messages,
      ...(recent.wasTruncated ? { clientContextWasTruncated: true } : {}),
    };
  }

  if (trigger === "regenerate-message") {
    const targetMessage =
      (messageId
        ? messages.find((currentMessage) => currentMessage.id === messageId)
        : undefined) ?? lastMessage;

    return targetMessage?.role === "user" ? { message: targetMessage } : {};
  }

  // Tool approvals mutate the latest assistant message. Only inspect that
  // message: an approval in old history must never turn future user messages
  // into continuations or cause the whole chat to be uploaded again.
  if (
    lastMessage?.role !== "user" ||
    lastMessage.parts.some(isApprovalResponsePart)
  ) {
    const approvalMessage = lastMessage
      ? compactApprovalMessage(lastMessage)
      : undefined;

    return approvalMessage && approvalMessage.parts.length > 0
      ? { messages: [approvalMessage] }
      : {};
  }

  return { message: lastMessage };
}
