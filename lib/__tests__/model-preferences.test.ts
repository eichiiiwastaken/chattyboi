import { describe, expect, it } from "vitest";
import { getModelPreferenceBoost } from "../ai/model-preferences";

describe("model preferences", () => {
  it("prioritizes the regular GPT-5.6 models and keeps Sol as the premium option", () => {
    expect(getModelPreferenceBoost("openai/gpt-5.6-terra")).toBe(80);
    expect(getModelPreferenceBoost("openai/gpt-5.6-luna")).toBe(78);
    expect(getModelPreferenceBoost("openai/gpt-5.6-sol")).toBe(70);
  });

  it("handles OpenRouter model ids without boosting older pro models", () => {
    expect(getModelPreferenceBoost("openrouter/openai/gpt-5.6-terra")).toBe(80);
    expect(getModelPreferenceBoost("openai/gpt-5-pro")).toBe(0);
  });
});
