"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getChatMessagesKey, useActiveChat } from "@/hooks/use-active-chat";
import type { ChatRealtimeEvent } from "@/lib/realtime/events-shared";
import type { ChatMessage } from "@/lib/types";
import { getChatHistoryPaginationKey } from "./sidebar-history";

type ChatMessagesResponse = {
  messages: ChatMessage[];
  visibility: "private" | "public";
  userId: string | null;
  isReadonly: boolean;
};

const realtimeEventTypes: ChatRealtimeEvent["type"][] = [
  "chat.created",
  "message.created",
  "chat.stream.created",
  "chat.title.updated",
  "chat.deleted",
  "chat.pinned.updated",
  "chat.visibility.updated",
];

export function ChatRealtimeEvents() {
  const {
    chatId,
    isNewChat,
    isOneTimeChat,
    resumeStream,
    setMessages,
    status,
  } = useActiveChat();
  const { mutate } = useSWRConfig();
  const router = useRouter();

  const chatIdRef = useRef(chatId);
  const isNewChatRef = useRef(isNewChat);
  const isOneTimeChatRef = useRef(isOneTimeChat);
  const statusRef = useRef(status);

  useEffect(() => {
    chatIdRef.current = chatId;
    isNewChatRef.current = isNewChat;
    isOneTimeChatRef.current = isOneTimeChat;
    statusRef.current = status;
  }, [chatId, isNewChat, isOneTimeChat, status]);

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const eventSource = new EventSource(`${basePath}/api/events`);

    const refreshHistory = () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    };

    const refreshActiveChat = async (event: ChatRealtimeEvent) => {
      const activeChatId = chatIdRef.current;
      if (
        event.chatId !== activeChatId ||
        isNewChatRef.current ||
        isOneTimeChatRef.current
      ) {
        return;
      }

      const data = await mutate<ChatMessagesResponse>(
        getChatMessagesKey(activeChatId)
      );
      if (data?.messages) {
        setMessages(data.messages);
      }

      if (
        (event.type === "message.created" ||
          event.type === "chat.stream.created") &&
        statusRef.current === "ready"
      ) {
        const lastMessage = data?.messages.at(-1);
        if (lastMessage?.role === "user") {
          await resumeStream().catch((error: unknown) => {
            console.error("[realtime] Failed to resume stream:", error);
          });
        }
      }
    };

    const onRealtimeEvent = (messageEvent: MessageEvent<string>) => {
      let event: ChatRealtimeEvent;
      try {
        event = JSON.parse(messageEvent.data) as ChatRealtimeEvent;
      } catch {
        return;
      }

      refreshHistory();

      if (event.type === "chat.deleted" && event.chatId === chatIdRef.current) {
        router.replace(`${basePath}/`);
        return;
      }

      if (
        event.type === "message.created" ||
        event.type === "chat.stream.created" ||
        event.type === "chat.title.updated" ||
        event.type === "chat.visibility.updated"
      ) {
        refreshActiveChat(event);
      }
    };

    for (const type of realtimeEventTypes) {
      eventSource.addEventListener(type, onRealtimeEvent);
    }

    return () => {
      for (const type of realtimeEventTypes) {
        eventSource.removeEventListener(type, onRealtimeEvent);
      }
      eventSource.close();
    };
  }, [mutate, resumeStream, router, setMessages]);

  return null;
}
