import type { UseChatHelpers } from "@ai-sdk/react";
import { AlertTriangleIcon, ArrowDownIcon, RefreshCcwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { GenerationError } from "@/hooks/use-active-chat";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  generationError: GenerationError | null;
  onEditMessage?: (message: ChatMessage) => void;
  onQuoteSelection?: (text: string) => void;
  onRetryMessage?: (message: ChatMessage, modelId?: string) => void;
  searchSources?: Array<{ title: string; url: string }> | null;
  statsForNerds?: boolean;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId,
  generationError,
  onEditMessage,
  onQuoteSelection,
  onRetryMessage,
  searchSources,
  statsForNerds,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  const retryErrorMessage = generationError ? messages.at(-1) : undefined;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  const shouldShowThinkingMessage =
    (status === "submitted" || status === "streaming") &&
    messages.at(-1)?.role !== "assistant";

  return (
    <div className="relative flex-1 bg-background">
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        ref={messagesContainerRef}
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-5 px-3 py-5 sm:px-4 md:gap-7 md:py-6">
          {messages.map((message, index) => (
            <PreviewMessage
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              onEdit={onEditMessage}
              onQuoteSelection={onQuoteSelection}
              onRetryMessage={onRetryMessage}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              searchSources={
                index === messages.length - 1 ? searchSources : null
              }
              selectedModelId={selectedModelId}
              setMessages={setMessages}
              statsForNerds={statsForNerds}
            />
          ))}

          {shouldShowThinkingMessage && <ThinkingMessage />}

          {generationError && (
            <GenerationErrorMessage
              error={generationError}
              onRetry={
                retryErrorMessage && onRetryMessage
                  ? () => onRetryMessage(retryErrorMessage)
                  : undefined
              }
            />
          )}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-[var(--shadow-float)] backdrop-blur-lg transition-all duration-200 h-7 text-[10px] ${
          isAtBottom
            ? "pointer-events-none scale-90 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-3 text-muted-foreground" />
      </button>
    </div>
  );
}

function GenerationErrorMessage({
  error,
  onRetry,
}: {
  error: GenerationError;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex w-full justify-start"
      data-testid="generation-error-message"
      role="alert"
    >
      <div className="max-w-[min(100%,720px)] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950 shadow-[var(--shadow-card)] dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-100">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-300" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[13px] leading-5">
              The assistant response failed.
            </p>
            <p className="mt-1 break-words text-[13px] leading-5 text-red-900/80 dark:text-red-100/80">
              {error.message}
            </p>
            {error.detail && (
              <p className="mt-1 break-words text-[12px] leading-5 text-red-900/70 dark:text-red-100/65">
                {error.detail}
              </p>
            )}
          </div>
          {onRetry && (
            <Button
              className="h-8 shrink-0 border-red-300 text-red-950 hover:bg-red-100 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-900/50"
              onClick={onRetry}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCcwIcon className="size-3.5" />
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const Messages = PureMessages;
