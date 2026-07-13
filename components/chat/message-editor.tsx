"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { deleteTrailingMessages } from "@/app/(chat)/actions";
import type { Attachment, ChatMessage } from "@/lib/types";

export async function submitEditedMessage({
  message,
  text,
  attachments = [],
  setMessages,
  regenerate,
  skipPersistence = false,
}: {
  message: ChatMessage;
  text: string;
  attachments?: Attachment[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  skipPersistence?: boolean;
}) {
  if (!skipPersistence) {
    await deleteTrailingMessages({ id: message.id });
  }

  setMessages((messages) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return messages;
    }

    return [
      ...messages.slice(0, index),
      {
        ...message,
        parts: [
          ...attachments.map((attachment) => ({
            type: "file" as const,
            url: attachment.url,
            filename: attachment.name,
            mediaType: attachment.contentType,
          })),
          { type: "text" as const, text },
        ],
      },
    ];
  });

  regenerate();
}
