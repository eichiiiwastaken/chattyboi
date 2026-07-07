"use client";

import {
  BrainIcon,
  CheckIcon,
  EyeIcon,
  FilterIcon,
  GaugeIcon,
  InfoIcon,
  SparklesIcon,
  StarIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import {
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatModel, ModelCapabilities } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { T3AttachIcon } from "./icons";

type CapabilityFilter = "fast" | "vision" | "reasoning" | "tools" | "file";

type ProviderTab = {
  id: string;
  label: string;
  provider?: string;
};

const providerNames: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  inclusionai: "InclusionAI",
  meta: "Meta",
  minimax: "MiniMax",
  mistral: "Mistral",
  moonshotai: "Moonshot",
  opencodego: "OpenCodeGo",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  qwen: "Qwen",
  xai: "xAI",
  zai: "Z.ai",
  zhipuai: "Zhipu",
};

const providerOrder = [
  "opencodego",
  "openai",
  "anthropic",
  "google",
  "meta",
  "deepseek",
  "xai",
  "moonshotai",
  "mistral",
  "alibaba",
  "qwen",
  "zai",
  "minimax",
  "inclusionai",
  "openrouter",
];

const capabilityFilters: {
  id: CapabilityFilter;
  icon: typeof SparklesIcon;
  label: string;
}[] = [
  { id: "fast", icon: SparklesIcon, label: "Fast" },
  { id: "vision", icon: EyeIcon, label: "Vision" },
  { id: "reasoning", icon: BrainIcon, label: "Reasoning" },
  { id: "tools", icon: WrenchIcon, label: "Tool calling" },
  { id: "file", icon: T3AttachIcon as typeof SparklesIcon, label: "Files" },
];

function getProviderLabel(provider: string) {
  return providerNames[provider] ?? provider;
}

function getSearchText(model: ChatModel) {
  return `${model.name} ${model.id} ${model.provider} ${model.description}`.toLowerCase();
}

function isFastModel(model: ChatModel) {
  return /flash|haiku|mini|small|nano|fast|lite|instant|turbo|kimi/i.test(
    `${model.id} ${model.name}`
  );
}

function matchesCapability(
  model: ChatModel,
  capabilities: Record<string, ModelCapabilities> | undefined,
  filter: CapabilityFilter
) {
  if (filter === "fast") {
    return isFastModel(model);
  }

  return Boolean(capabilities?.[model.id]?.[filter]);
}

function sortProviders(a: string, b: string) {
  const aIndex = providerOrder.indexOf(a);
  const bIndex = providerOrder.indexOf(b);

  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  }

  return getProviderLabel(a).localeCompare(getProviderLabel(b));
}

export function ModelPickerContent({
  capabilities,
  models,
  onSelectModel,
  selectedModelId,
}: {
  capabilities?: Record<string, ModelCapabilities>;
  models: ChatModel[];
  onSelectModel: (modelId: string) => void;
  selectedModelId: string;
}) {
  const [search, setSearch] = useState("");
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<CapabilityFilter[]>([]);
  const [matchAllFilters, setMatchAllFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>(
    "chattyboi-model-favorites",
    []
  );

  const modelIds = useMemo(
    () => new Set(models.map((model) => model.id)),
    [models]
  );
  const favorites = useMemo(
    () => favoriteIds.filter((id) => modelIds.has(id)),
    [favoriteIds, modelIds]
  );
  const favoriteTabIds = useMemo(
    () =>
      favorites.length > 0
        ? favorites
        : models.slice(0, Math.min(8, models.length)).map((model) => model.id),
    [favorites, models]
  );
  const providerIds = useMemo(
    () =>
      Array.from(new Set(models.map((model) => model.provider))).sort(
        sortProviders
      ),
    [models]
  );

  useEffect(() => {
    const selectedProvider = models.find(
      (model) => model.id === selectedModelId
    )?.provider;
    const validTabs = new Set(["favorites", ...providerIds]);
    const nextProvider =
      favoriteTabIds.length > 0
        ? "favorites"
        : (selectedProvider ?? providerIds[0] ?? null);

    if (!activeProvider || !validTabs.has(activeProvider)) {
      setActiveProvider(nextProvider);
    }
  }, [
    activeProvider,
    favoriteTabIds.length,
    models,
    providerIds,
    selectedModelId,
  ]);

  useEffect(() => {
    if (favorites.length !== favoriteIds.length) {
      setFavoriteIds(favorites);
    }
  }, [favoriteIds.length, favorites, setFavoriteIds]);

  const tabs: ProviderTab[] = useMemo(
    () => [
      { id: "favorites", label: "Favorites" },
      ...providerIds.map((provider) => ({
        id: provider,
        label: getProviderLabel(provider),
        provider,
      })),
    ],
    [providerIds]
  );

  const visibleModels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return models.filter((model) => {
      const matchesProvider =
        query.length > 0 ||
        activeProvider === null ||
        (activeProvider === "favorites"
          ? favoriteTabIds.includes(model.id)
          : model.provider === activeProvider);
      const matchesSearch =
        query.length === 0 || getSearchText(model).includes(query);
      const matchesFilters =
        activeFilters.length === 0 ||
        (matchAllFilters
          ? activeFilters.every((filter) =>
              matchesCapability(model, capabilities, filter)
            )
          : activeFilters.some((filter) =>
              matchesCapability(model, capabilities, filter)
            ));

      return matchesProvider && matchesSearch && matchesFilters;
    });
  }, [
    activeFilters,
    activeProvider,
    capabilities,
    favoriteTabIds,
    matchAllFilters,
    models,
    search,
  ]);

  const filterLabel =
    activeFilters.length === 0
      ? "Filter models"
      : `${activeFilters.length} filters`;
  const isSearching = search.trim().length > 0;

  function toggleFavorite(modelId: string) {
    setFavoriteIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
    );
  }

  function toggleFilter(filter: CapabilityFilter) {
    setActiveFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter]
    );
  }

  return (
    <>
      <div className="sticky top-0 z-10 border-border/50 border-b bg-card/95 p-1.5 backdrop-blur-xl">
        <div className="flex items-center gap-1">
          <ModelSelectorInput
            className="text-[13px]"
            onValueChange={setSearch}
            placeholder="Search models..."
            value={search}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={filterLabel}
                className={cn(
                  "h-9 w-9 rounded-lg text-muted-foreground",
                  activeFilters.length > 0 && "text-foreground"
                )}
                size="icon"
                type="button"
                variant="ghost"
              >
                <FilterIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {capabilityFilters.map((filter) => {
                const Icon = filter.icon;

                return (
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.includes(filter.id)}
                    key={filter.id}
                    onCheckedChange={() => toggleFilter(filter.id)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {filter.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={matchAllFilters}
                onCheckedChange={(checked) =>
                  setMatchAllFilters(Boolean(checked))
                }
              >
                <GaugeIcon className="size-4 text-muted-foreground" />
                Match all filters
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0",
          isSearching ? "grid-cols-1" : "grid-cols-[44px_minmax(0,1fr)]"
        )}
      >
        {!isSearching && (
          <div className="border-border/50 border-r bg-muted/15 p-1">
            <div className="flex flex-col items-center gap-1">
              {tabs.map((tab) => {
                const isActive = activeProvider === tab.id;

                return (
                  <Button
                    aria-label={tab.label}
                    className={cn(
                      "size-8 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      isActive &&
                        "bg-muted text-foreground ring-1 ring-border/60"
                    )}
                    key={tab.id}
                    onClick={() => {
                      setActiveProvider(tab.id);
                      setSearch("");
                    }}
                    size="icon-sm"
                    title={tab.label}
                    type="button"
                    variant="ghost"
                  >
                    {tab.id === "favorites" ? (
                      <StarIcon
                        className={cn(
                          "size-4",
                          favorites.length > 0 && "fill-current"
                        )}
                      />
                    ) : (
                      <ModelSelectorLogo provider={tab.provider ?? tab.id} />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <ModelSelectorList className="max-h-[min(430px,65dvh)]">
          {visibleModels.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">
              No matching models
            </div>
          ) : (
            visibleModels.map((model) => {
              const modelCapabilities = capabilities?.[model.id];
              const isSelected = model.id === selectedModelId;
              const isFavorite = favorites.includes(model.id);
              const logoProvider =
                model.provider || (model.id ?? "").split("/")[0];

              return (
                <ModelSelectorItem
                  className={cn(
                    "flex w-full items-start gap-2.5 px-2.5 py-2.5",
                    isSelected && "bg-muted/75 text-foreground"
                  )}
                  key={model.id}
                  onSelect={() => onSelectModel(model.id)}
                  value={`${model.name} ${model.id} ${model.description}`}
                >
                  <ModelSelectorLogo
                    className="mt-0.5 size-5 rounded-md"
                    provider={logoProvider}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <ModelSelectorName className="font-medium">
                        {model.name}
                      </ModelSelectorName>
                      {isFastModel(model) && (
                        <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <button
                        aria-label={
                          isFavorite
                            ? `Remove ${model.name} from favorites`
                            : `Add ${model.name} to favorites`
                        }
                        className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleFavorite(model.id);
                        }}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        type="button"
                      >
                        <StarIcon
                          className={cn(
                            "size-3.5",
                            isFavorite && "fill-current text-foreground"
                          )}
                        />
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-muted-foreground text-xs">
                      {model.description || model.id}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5 pt-0.5 text-foreground/70">
                    {modelCapabilities?.tools && (
                      <WrenchIcon className="size-3.5" />
                    )}
                    {modelCapabilities?.vision && (
                      <EyeIcon className="size-3.5" />
                    )}
                    {modelCapabilities?.file && <T3AttachIcon size={14} />}
                    {modelCapabilities?.reasoning && (
                      <BrainIcon className="size-3.5" />
                    )}
                    <InfoIcon className="size-3.5 text-muted-foreground/70" />
                    {isSelected && (
                      <CheckIcon className="size-3.5 text-foreground" />
                    )}
                  </div>
                </ModelSelectorItem>
              );
            })
          )}
        </ModelSelectorList>
      </div>
    </>
  );
}
