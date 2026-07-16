import { describe, expect, it } from "vitest";
import { getReasoningProviderOptions } from "../ai/reasoning-provider-options";

describe("reasoning provider options", () => {
  it("requests OpenAI reasoning summaries even when effort is automatic", () => {
    expect(
      getReasoningProviderOptions({
        chatModel: "openai/gpt-5.6-terra",
        effort: "auto",
        isReasoningModel: true,
      })
    ).toEqual({
      openai: { reasoningEffort: "medium", reasoningSummary: "auto" },
    });
  });

  it("combines an explicit effort with OpenAI reasoning summaries", () => {
    expect(
      getReasoningProviderOptions({
        chatModel: "openai/gpt-5.6-sol",
        effort: "high",
        isReasoningModel: true,
      })
    ).toEqual({
      openai: { reasoningEffort: "high", reasoningSummary: "auto" },
    });
  });

  it("does not request summaries from Chat Completions-compatible providers", () => {
    expect(
      getReasoningProviderOptions({
        chatModel: "openrouter/openai/gpt-5.6-terra",
        effort: "medium",
        isReasoningModel: true,
      })
    ).toEqual({ openai: { reasoningEffort: "medium" } });
  });

  it("uses high effort automatically for pro models", () => {
    expect(
      getReasoningProviderOptions({
        chatModel: "openai/gpt-5.5-pro",
        effort: "auto",
        isReasoningModel: true,
      })
    ).toEqual({
      openai: { reasoningEffort: "high", reasoningSummary: "auto" },
    });
  });

  it("returns no options for non-reasoning models", () => {
    expect(
      getReasoningProviderOptions({
        chatModel: "openai/gpt-4o",
        effort: "high",
        isReasoningModel: false,
      })
    ).toEqual({});
  });
});
