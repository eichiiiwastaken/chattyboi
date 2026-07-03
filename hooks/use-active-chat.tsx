"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { Settings, Vote } from "@/lib/db/schema";
import { ChatbotError, getErrorMessageFromUnknown } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";

type SearchSource = {
  title: string;
  url: string;
};

export type GenerationError = {
  message: string;
  detail?: string;
};

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  resumeStream: UseChatHelpers<ChatMessage>["resumeStream"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  visibilityType: VisibilityType;
  isReadonly: boolean;
  isLoading: boolean;
  votes: Vote[] | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  searchSources: SearchSource[] | null;
  setSearchSources: (sources: SearchSource[] | null) => void;
  generationError: GenerationError | null;
  clearGenerationError: () => void;
  setGenerationErrorFromUnknown: (error: unknown) => void;
  settings: Settings | null;
  isOneTimeChat: boolean;
  isNewChat: boolean;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

export function getChatMessagesKey(chatId: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`;
}

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const isOneTimeChat = isNewChat && searchParams.get("temporary") === "true";
  const newChatIdRef = useRef(generateUUID());
  const currentChatRouteKey = `${pathname}?temporary=${isOneTimeChat}`;
  const prevChatRouteKeyRef = useRef(currentChatRouteKey);

  if (isNewChat && prevChatRouteKeyRef.current !== currentChatRouteKey) {
    newChatIdRef.current = generateUUID();
  }
  prevChatRouteKeyRef.current = currentChatRouteKey;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [searchSources, setSearchSources] = useState<SearchSource[] | null>(
    null
  );
  const [generationError, setGenerationError] =
    useState<GenerationError | null>(null);
  const clearGenerationError = useCallback(() => {
    setGenerationError(null);
  }, []);
  const setGenerationErrorFromUnknown = useCallback((error: unknown) => {
    const normalized = getErrorMessageFromUnknown(
      error,
      "The assistant response failed."
    );
    const [firstLine, ...detailLines] = normalized.message.split("\n");
    const detail = normalized.detail ?? detailLines.join("\n").trim();

    setGenerationError({
      detail: detail || undefined,
      message: firstLine || "The assistant response failed.",
    });
  }, []);

  const { data: chatData, isLoading } = useSWR(
    isNewChat ? null : getChatMessagesKey(chatId),
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: settingsData, error: settingsError } = useSWR<Settings>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/settings`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const settings = settingsData ?? null;

  // Apply settings defaults once on new chats
  const hasAppliedDefaultsRef = useRef(false);
  useEffect(() => {
    if (!settings || !isNewChat || hasAppliedDefaultsRef.current) {
      return;
    }
    hasAppliedDefaultsRef.current = true;

    if (settings.webSearchEnabled) {
      setWebSearchEnabled(true);
    }
  }, [settings, isNewChat]);

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (chatData?.messages ?? []);
  const visibility: VisibilityType = isNewChat
    ? "private"
    : (chatData?.visibility ?? "private");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
    error: chatError,
    clearError: clearChatError,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isRegenerate = request.trigger === "regenerate-message";
        const shouldSendMessages =
          isRegenerate && request.messageId !== undefined;
        const isToolApprovalContinuation =
          isOneTimeChat ||
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation || shouldSendMessages
              ? { messages: request.messages }
              : { message: lastMessage }),
            trigger: request.trigger,
            messageId: request.messageId,
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibility,
            isOneTimeChat,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      clearGenerationError();
      if (!isOneTimeChat) {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
      }
    },
    onError: (error) => {
      if (error.message?.includes("AI Gateway requires a valid credit card")) {
        setGenerationErrorFromUnknown(error);
        setShowCreditCardAlert(true);
      } else if (error instanceof ChatbotError) {
        setGenerationErrorFromUnknown(error);
      } else {
        setGenerationErrorFromUnknown(error);
      }
    },
  });

  const sendMessageWithErrorReset = useCallback<
    UseChatHelpers<ChatMessage>["sendMessage"]
  >(
    (...args) => {
      clearGenerationError();
      clearChatError();
      const sendPromise = sendMessage(...args);
      sendPromise.catch(setGenerationErrorFromUnknown);
      return sendPromise;
    },
    [
      clearChatError,
      clearGenerationError,
      sendMessage,
      setGenerationErrorFromUnknown,
    ]
  );

  const regenerateWithErrorReset = useCallback<
    UseChatHelpers<ChatMessage>["regenerate"]
  >(
    (...args) => {
      clearGenerationError();
      clearChatError();
      const regeneratePromise = regenerate(...args);
      regeneratePromise.catch(setGenerationErrorFromUnknown);
      return regeneratePromise;
    },
    [
      clearChatError,
      clearGenerationError,
      regenerate,
      setGenerationErrorFromUnknown,
    ]
  );

  useEffect(() => {
    if (status === "error" && chatError) {
      setGenerationErrorFromUnknown(chatError);
    }
  }, [chatError, setGenerationErrorFromUnknown, status]);

  const loadedChatIds = useRef(new Set<string>());

  if (isNewChat && !loadedChatIds.current.has(newChatIdRef.current)) {
    loadedChatIds.current.add(newChatIdRef.current);
  }

  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (chatData?.messages) {
      loadedChatIds.current.add(chatId);
      setMessages(chatData.messages);
    }
  }, [chatId, chatData?.messages, setMessages]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        setMessages([]);
      }
      clearGenerationError();
    }
  }, [chatId, clearGenerationError, isNewChat, setMessages]);

  useEffect(() => {
    if (chatData && !isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [chatData, isNewChat]);

  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q") ?? params.get("query");
    const searchParam = params.get("search");

    if (query && !hasAppendedQueryRef.current) {
      if (settingsData === undefined && !settingsError) {
        return;
      }

      hasAppendedQueryRef.current = true;

      // Enable web search if ?search=true or ?search=1 is present
      const shouldSearch = searchParam === "true" || searchParam === "1";
      if (shouldSearch) {
        setWebSearchEnabled(true);
      }

      const urlDefaultModel = settings?.defaultSearchModel;
      if (urlDefaultModel) {
        setCurrentModelId(urlDefaultModel);
        currentModelIdRef.current = urlDefaultModel;
      }

      router.replace(
        isOneTimeChat
          ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/?temporary=true`
          : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );

      const send = () => {
        sendMessageWithErrorReset(
          {
            role: "user" as const,
            parts: [{ type: "text", text: query }],
          },
          shouldSearch ? { body: { webSearchEnabled: true } } : undefined
        );
      };

      send();
    }
  }, [
    sendMessageWithErrorReset,
    chatId,
    router,
    isOneTimeChat,
    settings?.defaultSearchModel,
    settingsData,
    settingsError,
  ]);

  useAutoResume({
    autoResume: !isNewChat && !!chatData,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isReadonly = isNewChat ? false : (chatData?.isReadonly ?? false);

  const { data: votes } = useSWR<Vote[]>(
    !isOneTimeChat && !isReadonly && messages.length >= 2
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      messages,
      setMessages,
      sendMessage: sendMessageWithErrorReset,
      status,
      stop,
      regenerate: regenerateWithErrorReset,
      resumeStream,
      addToolApprovalResponse,
      input,
      setInput,
      visibilityType: visibility,
      isReadonly,
      isLoading: !isNewChat && isLoading,
      votes,
      currentModelId,
      setCurrentModelId,
      showCreditCardAlert,
      setShowCreditCardAlert,
      webSearchEnabled,
      setWebSearchEnabled,
      searchSources,
      setSearchSources,
      generationError,
      clearGenerationError,
      setGenerationErrorFromUnknown,
      settings,
      isOneTimeChat,
      isNewChat,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessageWithErrorReset,
      status,
      stop,
      regenerateWithErrorReset,
      resumeStream,
      addToolApprovalResponse,
      input,
      visibility,
      isReadonly,
      isNewChat,
      isLoading,
      votes,
      currentModelId,
      showCreditCardAlert,
      webSearchEnabled,
      searchSources,
      generationError,
      clearGenerationError,
      setGenerationErrorFromUnknown,
      settings,
      isOneTimeChat,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
