"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { QuoteIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent, MessageResponse } from "../ai-elements/message";
import { Shimmer } from "../ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../ai-elements/tool";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";

type QuoteSelectionState = {
  left: number;
  text: string;
  top: number;
};

function isUsableRect(rect: DOMRect) {
  return rect.width > 0 || rect.height > 0;
}

function getDeepTextEndpoint(node: Node, atEnd: boolean): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

  return walker[atEnd ? "lastChild" : "firstChild"]() as Text | null;
}

function getRangeEndRect(range: Range) {
  let endpoint: { node: Text; offset: number } | null = null;

  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    endpoint = { node: range.endContainer as Text, offset: range.endOffset };
  } else {
    const child =
      range.endContainer.childNodes[Math.max(0, range.endOffset - 1)];
    const textNode = child ? getDeepTextEndpoint(child, true) : null;

    if (textNode) {
      endpoint = { node: textNode, offset: textNode.length };
    }
  }

  if (!endpoint) {
    return null;
  }

  const endpointRange = document.createRange();
  endpointRange.setStart(endpoint.node, endpoint.offset);
  endpointRange.collapse(true);
  const rect = endpointRange.getClientRects()[0] ?? null;
  endpointRange.detach();

  return rect;
}

function getVisualEndRect(rects: DOMRect[]) {
  const usableRects = rects.filter(isUsableRect);

  return usableRects.reduce<DOMRect | null>((endRect, rect) => {
    if (!endRect) {
      return rect;
    }

    const isLowerLine = rect.top > endRect.top + 4;
    const isSameLineFurtherRight =
      Math.abs(rect.top - endRect.top) <= 4 && rect.right > endRect.right;

    return isLowerLine || isSameLineFurtherRight ? rect : endRect;
  }, null);
}

function QuoteSelectionPopover({
  children,
  className,
  onQuote,
}: {
  children: ReactNode;
  className?: string;
  onQuote?: (text: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<QuoteSelectionState | null>(null);

  const hideSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const updateSelection = useCallback(() => {
    if (!onQuote) {
      return;
    }

    const activeSelection = window.getSelection();
    const selectedText = activeSelection?.toString().trim();

    if (!(activeSelection && selectedText && activeSelection.rangeCount > 0)) {
      hideSelection();
      return;
    }

    const range = activeSelection.getRangeAt(0);
    const root = rootRef.current;
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentNode;

    if (!(root && ancestor && root.contains(ancestor))) {
      hideSelection();
      return;
    }

    const endpointRect = getRangeEndRect(range);
    const rangeRects = Array.from(range.getClientRects());
    const fallbackRect =
      getVisualEndRect(rangeRects) ?? range.getBoundingClientRect();
    const rect =
      endpointRect && isUsableRect(endpointRect) ? endpointRect : fallbackRect;

    if (!rect || !isUsableRect(rect)) {
      hideSelection();
      return;
    }

    setSelection({
      left: Math.min(Math.max(rect.right + 22, 28), window.innerWidth - 28),
      text: selectedText,
      top: Math.min(
        Math.max(rect.top + rect.height / 2, 18),
        window.innerHeight - 18
      ),
    });
  }, [hideSelection, onQuote]);

  useEffect(() => {
    if (!onQuote) {
      return;
    }

    document.addEventListener("selectionchange", updateSelection);

    return () => {
      document.removeEventListener("selectionchange", updateSelection);
    };
  }, [onQuote, updateSelection]);

  useEffect(() => {
    if (!selection) {
      return;
    }

    window.addEventListener("resize", hideSelection);
    window.addEventListener("scroll", hideSelection, true);

    return () => {
      window.removeEventListener("resize", hideSelection);
      window.removeEventListener("scroll", hideSelection, true);
    };
  }, [hideSelection, selection]);

  const quoteSelection = useCallback(() => {
    if (!selection) {
      return;
    }

    onQuote?.(selection.text);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [onQuote, selection]);

  if (!onQuote) {
    return children;
  }

  return (
    <div className={className} ref={rootRef}>
      {children}
      {selection && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Quote selection"
                className="fixed z-50 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-popover text-popover-foreground shadow-[var(--shadow-float)] backdrop-blur transition-transform duration-150 hover:scale-105 hover:bg-muted"
                onClick={quoteSelection}
                onMouseDown={(event) => event.preventDefault()}
                style={{ left: selection.left, top: selection.top }}
                type="button"
              >
                <QuoteIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              <p>Quote selection</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  selectedModelId,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
  onQuoteSelection,
  onRetryMessage,
  searchSources,
  statsForNerds,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  selectedModelId?: string;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
  onQuoteSelection?: (text: string) => void;
  onRetryMessage?: (message: ChatMessage, modelId?: string) => void;
  searchSources?: Array<{ title: string; url: string }> | null;
  statsForNerds?: boolean;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const hasAnyContent = message.parts?.some(
    (part) =>
      (part.type === "text" && part.text?.trim().length > 0) ||
      (part.type === "reasoning" &&
        "text" in part &&
        part.text?.trim().length > 0) ||
      part.type.startsWith("tool-")
  );
  const isThinking = isAssistant && isLoading && !hasAnyContent;

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className="flex flex-row justify-end gap-2"
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            name: attachment.filename ?? "file",
            contentType: attachment.mediaType,
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const mergedReasoning = message.parts?.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && part.text?.trim().length > 0) {
        return {
          text: acc.text ? `${acc.text}\n\n${part.text}` : part.text,
          isStreaming: "state" in part ? part.state === "streaming" : false,
          rendered: false,
        };
      }
      return acc;
    },
    { text: "", isStreaming: false, rendered: false }
  ) ?? { text: "", isStreaming: false, rendered: false };

  const parts = message.parts?.map((part, index) => {
    const { type } = part;
    const key = `message-${message.id}-part-${index}`;

    if (type === "reasoning") {
      if (!mergedReasoning.rendered && mergedReasoning.text) {
        mergedReasoning.rendered = true;
        return (
          <MessageReasoning
            isLoading={isLoading || mergedReasoning.isStreaming}
            key={key}
            reasoning={mergedReasoning.text}
          />
        );
      }
      return null;
    }

    if (type === "text") {
      return (
        <MessageContent
          className={cn("text-[13px] leading-[1.65]", {
            "w-fit max-w-[min(88%,56ch)] overflow-hidden break-words rounded-2xl rounded-br-lg border border-border/30 bg-gradient-to-br from-secondary to-muted px-3.5 py-2 shadow-[var(--shadow-card)] sm:max-w-[min(80%,56ch)]":
              message.role === "user",
          })}
          data-testid="message-content"
          key={key}
        >
          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
        </MessageContent>
      );
    }

    if (type === "tool-getWeather") {
      const { toolCallId, state } = part;
      const approvalId = (part as { approval?: { id: string } }).approval?.id;
      const isDenied =
        state === "output-denied" ||
        (state === "approval-responded" &&
          (part as { approval?: { approved?: boolean } }).approval?.approved ===
            false);
      const widthClass = "w-[min(100%,450px)]";

      if (state === "output-available") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Weather weatherAtLocation={part.output} />
          </div>
        );
      }

      if (isDenied) {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state="output-denied" type="tool-getWeather" />
              <ToolContent>
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  Weather lookup was denied.
                </div>
              </ToolContent>
            </Tool>
          </div>
        );
      }

      if (state === "approval-responded") {
        return (
          <div className={widthClass} key={toolCallId}>
            <Tool className="w-full" defaultOpen={true}>
              <ToolHeader state={state} type="tool-getWeather" />
              <ToolContent>
                <ToolInput input={part.input} />
              </ToolContent>
            </Tool>
          </div>
        );
      }

      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              {(state === "input-available" ||
                state === "approval-requested") && (
                <ToolInput input={part.input} />
              )}
              {state === "approval-requested" && approvalId && (
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                  <button
                    className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                        reason: "User denied weather lookup",
                      });
                    }}
                    type="button"
                  >
                    Deny
                  </button>
                  <button
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                    type="button"
                  >
                    Allow
                  </button>
                </div>
              )}
            </ToolContent>
          </Tool>
        </div>
      );
    }

    if (type === "tool-webSearch") {
      const { toolCallId, state } = part;
      const output = "output" in part ? part.output : null;
      const results =
        output &&
        typeof output === "object" &&
        "results" in output &&
        Array.isArray(output.results)
          ? output.results
          : [];

      return (
        <Tool
          className="w-[min(100%,520px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-webSearch" />
          <ToolContent>
            {"input" in part && <ToolInput input={part.input} />}
            {state === "output-available" && results.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {results.map((result: { title?: string; url?: string }) => (
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    href={result.url}
                    key={result.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {result.title || result.url}
                  </a>
                ))}
              </div>
            )}
            {state === "output-available" && results.length === 0 && (
              <ToolOutput
                errorText={undefined}
                output={
                  output && typeof output === "object" && "error" in output
                    ? output.error
                    : "No search results found."
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    if (type === "tool-createDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error creating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <DocumentPreview
          isReadonly={isReadonly}
          key={toolCallId}
          result={part.output}
        />
      );
    }

    if (type === "tool-updateDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error updating document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }

    if (type === "tool-requestSuggestions") {
      const { toolCallId, state } = part;

      return (
        <Tool
          className="w-[min(100%,450px)]"
          defaultOpen={true}
          key={toolCallId}
        >
          <ToolHeader state={state} type="tool-requestSuggestions" />
          <ToolContent>
            {state === "input-available" && <ToolInput input={part.input} />}
            {state === "output-available" && (
              <ToolOutput
                errorText={undefined}
                output={
                  "error" in part.output ? (
                    <div className="rounded border p-2 text-red-500">
                      Error: {String(part.output.error)}
                    </div>
                  ) : (
                    <DocumentToolResult
                      isReadonly={isReadonly}
                      result={part.output}
                      type="request-suggestions"
                    />
                  )
                }
              />
            )}
          </ToolContent>
        </Tool>
      );
    }

    return null;
  });

  const actions = !isReadonly && (
    <MessageActions
      chatId={chatId}
      isLoading={isLoading}
      key={`action-${message.id}`}
      message={message}
      onEdit={onEdit ? () => onEdit(message) : undefined}
      onRetry={onRetryMessage}
      selectedModelId={selectedModelId ?? ""}
      statsForNerds={statsForNerds}
    />
  );

  const content = isThinking ? (
    <div className="flex h-[calc(13px*1.65)] items-center text-[13px] leading-[1.65]">
      <Shimmer className="font-medium" duration={1}>
        Thinking...
      </Shimmer>
    </div>
  ) : (
    <>
      {attachments}
      {parts}
      {actions}
      {isAssistant && searchSources && searchSources.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground/70">
            Sources
          </p>
          <div className="flex flex-wrap gap-1.5">
            {searchSources.map((source) => (
              <a
                className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                href={source.url}
                key={source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {source.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "group/message w-full",
        !isAssistant && "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn(
          isUser ? "flex flex-col items-end gap-2" : "flex items-start gap-3"
        )}
      >
        {isAssistant && (
          <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
              <SparklesIcon size={13} />
            </div>
          </div>
        )}
        <QuoteSelectionPopover
          className={
            isAssistant ? "flex min-w-0 flex-1 flex-col gap-2" : "contents"
          }
          onQuote={onQuoteSelection}
        >
          {content}
        </QuoteSelectionPopover>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message w-full"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[calc(13px*1.65)] shrink-0 items-center">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <SparklesIcon size={13} />
          </div>
        </div>

        <div className="flex h-[calc(13px*1.65)] items-center text-[13px] leading-[1.65]">
          <Shimmer className="font-medium" duration={1}>
            Thinking...
          </Shimmer>
        </div>
      </div>
    </div>
  );
};
