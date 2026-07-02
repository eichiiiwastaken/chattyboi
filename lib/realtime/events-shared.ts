export type ChatRealtimeEvent =
  | {
      type: "chat.created";
      chatId: string;
      title: string;
      createdAt: string;
    }
  | {
      type: "message.created";
      chatId: string;
      messageId: string;
      role: string;
      createdAt: string;
    }
  | {
      type: "chat.stream.created";
      chatId: string;
      streamId: string;
    }
  | {
      type: "chat.title.updated";
      chatId: string;
      title: string;
    }
  | {
      type: "chat.deleted";
      chatId: string;
    }
  | {
      type: "chat.pinned.updated";
      chatId: string;
      pinnedAt: string | null;
    }
  | {
      type: "chat.visibility.updated";
      chatId: string;
      visibility: "private" | "public";
    };

export function getUserChatEventsChannel(userId: string) {
  return `chattyboi:chat-events:user:${userId}`;
}

export function toSseMessage(event: ChatRealtimeEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
