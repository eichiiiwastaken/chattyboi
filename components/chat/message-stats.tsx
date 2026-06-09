import { Puzzle, Timer, Zap } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MessageStats({
  message,
  className,
}: {
  message: ChatMessage;
  className?: string;
}) {
  const meta = message.metadata;
  if (!meta?.usage && !meta?.modelName && !meta?.duration) {
    return null;
  }

  const totalTokens = meta.usage?.totalTokens ?? 0;
  const outputTokens = meta.usage?.outputTokens ?? 0;
  const durationMs = meta.duration ?? 0;
  const durationSec = durationMs / 1000;
  const ttfMs = meta.timeToFirstToken;

  const tokensForRate = outputTokens > 0 ? outputTokens : totalTokens;
  const tokPerSec =
    tokensForRate > 0 && durationSec > 0
      ? (tokensForRate / durationSec).toFixed(2)
      : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px] text-muted-foreground/70",
        className
      )}
    >
      {meta.modelName && <span className="font-medium">{meta.modelName}</span>}

      {tokPerSec && (
        <span className="inline-flex items-center gap-0.5">
          <Zap className="text-muted-foreground/50" size={10} />
          {tokPerSec} tok/sec
        </span>
      )}

      {totalTokens > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <Puzzle className="text-muted-foreground/50" size={10} />
          {totalTokens} tokens
        </span>
      )}

      {ttfMs !== undefined && ttfMs !== null && (
        <span className="inline-flex items-center gap-0.5">
          <Timer className="text-muted-foreground/50" size={10} />
          Time-to-First: {(ttfMs / 1000).toFixed(2)} sec
        </span>
      )}
    </div>
  );
}
