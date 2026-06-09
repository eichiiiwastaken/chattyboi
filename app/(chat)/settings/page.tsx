"use client";

import { CheckIcon, Copy } from "lucide-react";
import { useCallback, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ChatModel } from "@/lib/ai/models";

function ModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );

  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? [];

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels[0];

  if (!selectedModel) {
    return null;
  }

  const [provider] = selectedModel.id.split("/");

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-8 w-full justify-between gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          variant="ghost"
        >
          {provider && <ModelSelectorLogo provider={provider} />}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
          <span className="ml-auto text-muted-foreground text-xs">▼</span>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {(() => {
            const allModels = dynamicModels ?? [];
            const grouped: Record<string, ChatModel[]> = {};
            for (const model of allModels) {
              const key = model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push(model);
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) =>
              a.localeCompare(b)
            );

            const providerNames: Record<string, string> = {
              opencodego: "OpenCodeGo",
              openrouter: "OpenRouter",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup heading={providerNames[key] ?? key} key={key}>
                {grouped[key].map((model) => {
                  const logoProvider = model.id.split("/")[0];
                  return (
                    <ModelSelectorItem
                      className="flex w-full"
                      key={model.id}
                      onSelect={() => {
                        onModelChange(model.id);
                        setOpen(false);
                      }}
                      value={model.id}
                    >
                      {model.id === selectedModel.id ? (
                        <CheckIcon className="size-4 shrink-0 text-foreground" />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                      <ModelSelectorLogo provider={logoProvider} />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

export default function SettingsPage() {
  const { data: settings, mutate } = useSWR<{
    defaultSearchModel: string | null;
    webSearchEnabled: boolean;
    statsForNerds: boolean;
  }>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/settings`,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [_, copyToClipboard] = useCopyToClipboard();

  const updateSetting = useCallback(
    async (patch: {
      defaultSearchModel?: string;
      webSearchEnabled?: boolean;
      statsForNerds?: boolean;
    }) => {
      setIsSaving(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/settings`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          }
        );
        if (!res.ok) {
          throw new Error("Failed to save settings");
        }
        const updated = await res.json();
        mutate(updated, false);
        toast.success("Settings saved");
      } catch {
        toast.error("Failed to save settings");
      } finally {
        setIsSaving(false);
      }
    },
    [mutate]
  );

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center border-b border-border/40 px-4 py-3">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-8 p-6">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Chat Preferences
          </h2>

          <div className="space-y-6 rounded-xl border border-border/40 bg-card/50 p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]" htmlFor="web-search-default">
                  Enable web search by default
                </Label>
                <Switch
                  checked={settings?.webSearchEnabled ?? false}
                  disabled={!settings || isSaving}
                  id="web-search-default"
                  onCheckedChange={(checked) =>
                    updateSetting({ webSearchEnabled: checked })
                  }
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                When starting a new chat, web search will be enabled
                automatically.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[13px]" htmlFor="stats-for-nerds">
                  Show stats for nerds
                </Label>
                <Switch
                  checked={settings?.statsForNerds ?? false}
                  disabled={!settings || isSaving}
                  id="stats-for-nerds"
                  onCheckedChange={(checked) =>
                    updateSetting({ statsForNerds: checked })
                  }
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Display token usage, latency, and model info under assistant
                messages.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Default Model for Search
          </h2>
          <div className="space-y-3 rounded-xl border border-border/40 bg-card/50 p-5">
            <div className="space-y-2">
              <Label className="text-[13px]">
                Default model used when web search is enabled
              </Label>
              <ModelSelectorCompact
                onModelChange={(modelId) =>
                  updateSetting({ defaultSearchModel: modelId })
                }
                selectedModelId={
                  settings?.defaultSearchModel ?? "opencodego/kimi-k2.6"
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Bang URLs
          </h2>
          <div className="space-y-3 rounded-xl border border-border/40 bg-card/50 p-5">
            <p className="text-[12px] text-muted-foreground">
              Use these URLs as custom search engines or DuckDuckGo bangs to
              start a chat from anywhere.
            </p>
            <div className="space-y-2">
              <Label className="text-[13px]">Chat (no search)</Label>
              <div className="flex items-center gap-1">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                  {`${typeof window === "undefined" ? "" : window.location.origin}/?q=%s`}
                </code>
                <Button
                  onClick={async () => {
                    await copyToClipboard(`${window.location.origin}/?q=%s`);
                    toast.success("Copied to clipboard!");
                  }}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">Chat with web search</Label>
              <div className="flex items-center gap-1">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                  {`${typeof window === "undefined" ? "" : window.location.origin}/?q=%s&search=true`}
                </code>
                <Button
                  onClick={async () => {
                    await copyToClipboard(
                      `${window.location.origin}/?q=%s&search=true`
                    );
                    toast.success("Copied to clipboard!");
                  }}
                  size="icon-xs"
                  variant="ghost"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
