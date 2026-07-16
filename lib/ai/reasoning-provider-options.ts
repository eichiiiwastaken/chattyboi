import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import { getProviderFromModelId } from "./provider-config";
import type { ReasoningEffort } from "./reasoning";

function getAutomaticOpenAIEffort(modelId: string) {
  return /(?:^|\/)(?:gpt-[^/]*-pro|o\d+-pro)(?:$|-)/i.test(modelId)
    ? "high"
    : "medium";
}

export function getReasoningProviderOptions({
  chatModel,
  effort,
  isReasoningModel,
}: {
  chatModel: string;
  effort?: ReasoningEffort;
  isReasoningModel: boolean;
}): SharedV3ProviderOptions {
  if (!isReasoningModel) {
    return {};
  }

  const provider = getProviderFromModelId(chatModel);
  const explicitReasoningEffort =
    effort && effort !== "auto" ? { reasoningEffort: effort } : {};

  if (provider === "opencodego") {
    return Object.keys(explicitReasoningEffort).length > 0
      ? { opencodego: explicitReasoningEffort }
      : {};
  }

  if (provider === "openai") {
    return {
      openai: {
        reasoningEffort:
          effort && effort !== "auto"
            ? effort
            : getAutomaticOpenAIEffort(chatModel),
        reasoningSummary: "auto",
      },
    };
  }

  if (provider === "openrouter") {
    return Object.keys(explicitReasoningEffort).length > 0
      ? { openai: explicitReasoningEffort }
      : {};
  }

  return {};
}
