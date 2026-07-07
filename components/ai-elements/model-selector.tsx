"use client";

import { useTheme } from "next-themes";
import {
  createContext,
  type ComponentProps,
  type ReactNode,
  useContext,
} from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SvglRoute =
  | string
  | { dark: string; light: string };

const SVGL_LOGO_MAP: Partial<Record<string, SvglRoute>> = {
  opencodego: { dark: "https://svgl.app/library/opencode-dark.svg", light: "https://svgl.app/library/opencode.svg" },
  opencode: { dark: "https://svgl.app/library/opencode-dark.svg", light: "https://svgl.app/library/opencode.svg" },
  openai: { dark: "https://svgl.app/library/openai_dark.svg", light: "https://svgl.app/library/openai.svg" },
  anthropic: { dark: "https://svgl.app/library/anthropic_white.svg", light: "https://svgl.app/library/anthropic_black.svg" },
  google: "https://svgl.app/library/google.svg",
  deepseek: "https://svgl.app/library/deepseek.svg",
  mistral: "https://svgl.app/library/mistral-ai_logo.svg",
  groq: "https://svgl.app/library/groq.svg",
  xai: { dark: "https://svgl.app/library/xai_dark.svg", light: "https://svgl.app/library/xai_light.svg" },
  perplexity: "https://svgl.app/library/perplexity.svg",
  azure: "https://svgl.app/library/azure.svg",
  huggingface: "https://svgl.app/library/hugging_face.svg",
  togetherai: { dark: "https://svgl.app/library/togetherai_dark.svg", light: "https://svgl.app/library/togetherai_light.svg" },
  cerebras: { dark: "https://svgl.app/library/cerebras.svg", light: "https://svgl.app/library/cerebras-dark.svg" },
  nvidia: { dark: "https://svgl.app/library/nvidia-icon-dark.svg", light: "https://svgl.app/library/nvidia-icon-light.svg" },
  "github-copilot": { dark: "https://svgl.app/library/copilot_dark.svg", light: "https://svgl.app/library/copilot.svg" },
  vercel: { dark: "https://svgl.app/library/vercel_dark.svg", light: "https://svgl.app/library/vercel.svg" },
  openrouter: { dark: "https://svgl.app/library/openrouter_dark.svg", light: "https://svgl.app/library/openrouter_light.svg" },
  "amazon-bedrock": "https://svgl.app/library/aws_light.svg",
  meta: "https://svgl.app/library/meta.svg",
  llama: "https://svgl.app/library/meta.svg",
  "github-models": { dark: "https://svgl.app/library/github_dark.svg", light: "https://svgl.app/library/github_light.svg" },
  v0: { dark: "https://svgl.app/library/vercel_dark.svg", light: "https://svgl.app/library/vercel.svg" },
};

const ModelSelectorContext = createContext({ isMobile: false });

export type ModelSelectorProps = ComponentProps<typeof Popover>;

export const ModelSelector = (props: ModelSelectorProps) => {
  const isMobile = useIsMobile();
  const Root = isMobile ? Sheet : Popover;

  return (
    <ModelSelectorContext.Provider value={{ isMobile }}>
      <Root {...props} />
    </ModelSelectorContext.Provider>
  );
};

export type ModelSelectorTriggerProps = ComponentProps<typeof PopoverTrigger>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => {
  const { isMobile } = useContext(ModelSelectorContext);
  const Trigger = isMobile ? SheetTrigger : PopoverTrigger;

  return <Trigger {...props} />;
};

export type ModelSelectorContentProps = ComponentProps<typeof PopoverContent> & {
  commandProps?: ComponentProps<typeof Command>;
  title?: ReactNode;
};

export const ModelSelectorContent = ({
  className,
  children,
  commandProps,
  title = "Choose model",
  onOpenAutoFocus,
  ...props
}: ModelSelectorContentProps) => {
  const { isMobile } = useContext(ModelSelectorContext);
  const handleOpenAutoFocus: NonNullable<
    ModelSelectorContentProps["onOpenAutoFocus"]
  > = (event) => {
    event.preventDefault();
    onOpenAutoFocus?.(event);
  };

  if (isMobile) {
    return (
      <SheetContent
        className={cn(
          "inset-x-0 bottom-0 top-auto !h-[82dvh] !w-full max-w-none overflow-hidden rounded-t-2xl border-t border-border/30 bg-card p-0 pb-[env(safe-area-inset-bottom)] text-card-foreground sm:!h-[76dvh]",
          className
        )}
        onOpenAutoFocus={handleOpenAutoFocus}
        showCloseButton={false}
        side="bottom"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Search and choose a model.</SheetDescription>
        </SheetHeader>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/20" />
        <Command
          {...commandProps}
          className={cn(
            "min-h-0 flex-1 rounded-none bg-transparent p-1 pt-2 **:data-[slot=command-input-wrapper]:h-auto",
            commandProps?.className
          )}
        >
          {children}
        </Command>
      </SheetContent>
    );
  }

  return (
    <PopoverContent
      align="start"
      className={cn(
        "w-[280px] max-w-[calc(100vw-1rem)] p-0 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-[var(--shadow-float)]",
        className
      )}
      onOpenAutoFocus={handleOpenAutoFocus}
      side="top"
      sideOffset={8}
      {...props}
    >
      <Command
        {...commandProps}
        className={cn(
          "**:data-[slot=command-input-wrapper]:h-auto",
          commandProps?.className
        )}
      >
        {children}
      </Command>
    </PopoverContent>
  );
};

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

export const ModelSelectorInput = ({
  className,
  ...props
}: ModelSelectorInputProps) => (
  <CommandInput
    className={cn("h-auto py-2.5 text-[13px]", className)}
    {...props}
  />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

export const ModelSelectorList = ({
  className,
  ...props
}: ModelSelectorListProps) => (
  <CommandList
    className={cn("max-h-[min(280px,55dvh)] overscroll-contain", className)}
    {...props}
  />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
  <CommandEmpty {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup {...props} />
);

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>;

export const ModelSelectorItem = ({ className, ...props }: ModelSelectorItemProps) => (
  <CommandItem className={cn("w-full text-[13px] rounded-lg", className)} {...props} />
);

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
);

export type ModelSelectorLogoProps = Omit<
  ComponentProps<"img">,
  "src" | "alt"
> & {
  provider:
    | "moonshotai-cn"
    | "lucidquery"
    | "moonshotai"
    | "zai-coding-plan"
    | "alibaba"
    | "xai"
    | "vultr"
    | "nvidia"
    | "upstage"
    | "groq"
    | "github-copilot"
    | "mistral"
    | "vercel"
    | "nebius"
    | "deepseek"
    | "alibaba-cn"
    | "google-vertex-anthropic"
    | "venice"
    | "chutes"
    | "cortecs"
    | "github-models"
    | "togetherai"
    | "azure"
    | "baseten"
    | "huggingface"
    | "opencode"
    | "fastrouter"
    | "google"
    | "google-vertex"
    | "cloudflare-workers-ai"
    | "inception"
    | "wandb"
    | "openai"
    | "zhipuai-coding-plan"
    | "perplexity"
    | "openrouter"
    | "zenmux"
    | "v0"
    | "iflowcn"
    | "synthetic"
    | "deepinfra"
    | "zhipuai"
    | "submodel"
    | "zai"
    | "inference"
    | "requesty"
    | "morph"
    | "lmstudio"
    | "anthropic"
    | "aihubmix"
    | "fireworks-ai"
    | "modelscope"
    | "llama"
    | "scaleway"
    | "amazon-bedrock"
    | "cerebras"
    // oxlint-disable-next-line typescript-eslint(ban-types) -- intentional pattern for autocomplete-friendly string union
    | (string & {});
};

export const ModelSelectorLogo = ({
  provider,
  className,
  ...props
}: ModelSelectorLogoProps) => {
  const { resolvedTheme } = useTheme();
  const route = SVGL_LOGO_MAP[provider];
  const src = route
    ? typeof route === "string"
      ? route
      : resolvedTheme === "dark"
        ? route.dark
        : route.light
    : `https://models.dev/logos/${provider}.svg`;

  const isSingleRoute = typeof route === "string";

  return (
    <img
      {...props}
      alt={`${provider} logo`}
      className={cn("size-4", isSingleRoute && "dark:invert", className)}
      height={16}
      src={src}
      width={16}
    />
  );
};

export type ModelSelectorLogoGroupProps = ComponentProps<"div">;

export const ModelSelectorLogoGroup = ({
  className,
  ...props
}: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      "flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:p-px [&>img]:ring-1 [&>img]:ring-border/30",
      className
    )}
    {...props}
  />
);

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
);
