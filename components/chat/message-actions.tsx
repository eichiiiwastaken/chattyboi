import {
  BrainIcon,
  CheckIcon,
  EyeIcon,
  InfoIcon,
  RefreshCcwIcon,
  WrenchIcon,
} from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MODELS_API_PATH } from "@/lib/ai/model-api";
import type { ChatModel, ModelCapabilities } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "../ai-elements/message";
import { CopyIcon, PencilEditIcon, T3AttachIcon } from "./icons";
import { MessageStats } from "./message-stats";

export function PureMessageActions({
  chatId: _chatId,
  message,
  isLoading,
  onEdit,
  onRetry,
  selectedModelId,
  statsForNerds,
}: {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  onEdit?: () => void;
  onRetry?: (message: ChatMessage, modelId?: string) => Promise<void> | void;
  selectedModelId: string;
  statsForNerds?: boolean;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();

  if (isLoading) {
    return null;
  }

  const textFromParts = getTextFromMessage(message).trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 gap-0.5 justify-end opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
        {onEdit && (
          <Action
            className="size-7 text-muted-foreground/50 hover:text-foreground"
            data-testid="message-edit-button"
            onClick={onEdit}
            tooltip="Edit"
          >
            <PencilEditIcon />
          </Action>
        )}
        {onRetry && (
          <RetryMenu
            message={message}
            onRetry={onRetry}
            selectedModelId={selectedModelId}
          />
        )}
        <Action
          className="size-7 text-muted-foreground/50 hover:text-foreground"
          onClick={handleCopy}
          tooltip="Copy"
        >
          <CopyIcon />
        </Action>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        onClick={handleCopy}
        tooltip="Copy"
      >
        <CopyIcon />
      </Action>
      {onRetry && (
        <RetryMenu
          message={message}
          onRetry={onRetry}
          selectedModelId={selectedModelId}
        />
      )}
      {statsForNerds && <MessageStats message={message} />}
    </Actions>
  );
}

function RetryMenu({
  message,
  onRetry,
  selectedModelId,
}: {
  message: ChatMessage;
  onRetry: (message: ChatMessage, modelId?: string) => Promise<void> | void;
  selectedModelId: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${MODELS_API_PATH}`,
    (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  const capabilities: Record<string, ModelCapabilities> | undefined =
    modelsData?.capabilities ?? modelsData;
  const allModels: ChatModel[] = modelsData?.models ?? [];
  const curatedIds = new Set(allModels.map((model) => model.id));
  const grouped: Record<string, { model: ChatModel; curated: boolean }[]> = {};

  for (const model of allModels) {
    const key = model.provider;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({ model, curated: curatedIds.has(model.id) });
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const providerNames: Record<string, string> = {
    opencodego: "OpenCodeGo",
    openrouter: "OpenRouter",
  };

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ModelSelectorTrigger asChild>
              <Button
                aria-label="Retry"
                className="size-7 text-muted-foreground/50 hover:text-foreground"
                data-testid="message-retry-button"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <RefreshCcwIcon className="size-4" />
              </Button>
            </ModelSelectorTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Retry</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ModelSelectorContent className="w-[300px]">
        <div className="border-border/50 border-b p-1.5">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => {
              setOpen(false);
              Promise.resolve(onRetry(message)).catch(() => undefined);
            }}
            type="button"
          >
            <RefreshCcwIcon className="size-4 shrink-0 text-primary" />
            <span className="flex-1">Retry same</span>
            <InfoIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3 px-2 py-2 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border/60" />
            <span>or switch model</span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
        </div>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {sortedKeys.map((key) => (
            <ModelSelectorGroup heading={providerNames[key] ?? key} key={key}>
              {grouped[key].map(({ model, curated }) => {
                const logoProvider = (model.id ?? "").split("/")[0];
                return (
                  <ModelSelectorItem
                    className="flex w-full"
                    key={model.id}
                    onSelect={() => {
                      if (!curated) {
                        return;
                      }
                      setOpen(false);
                      Promise.resolve(onRetry(message, model.id)).catch(
                        () => undefined
                      );
                    }}
                    value={model.id}
                  >
                    {model.id === selectedModelId ? (
                      <CheckIcon className="size-4 shrink-0 text-foreground" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <ModelSelectorLogo provider={logoProvider} />
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    <div className="ml-auto flex items-center gap-2 text-foreground/70">
                      {capabilities?.[model.id]?.tools && (
                        <WrenchIcon className="size-3.5" />
                      )}
                      {capabilities?.[model.id]?.vision && (
                        <EyeIcon className="size-3.5" />
                      )}
                      {capabilities?.[model.id]?.file && (
                        <T3AttachIcon size={14} />
                      )}
                      {capabilities?.[model.id]?.reasoning && (
                        <BrainIcon className="size-3.5" />
                      )}
                    </div>
                  </ModelSelectorItem>
                );
              })}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.statsForNerds !== nextProps.statsForNerds) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.onRetry !== nextProps.onRetry) {
      return false;
    }
    return true;
  }
);
