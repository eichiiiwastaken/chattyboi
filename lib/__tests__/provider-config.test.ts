import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMissingProviderConfig,
  getProviderFromModelId,
  isProviderConfigured,
} from "../ai/provider-config";

describe("provider config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects the provider from a model id", () => {
    expect(getProviderFromModelId("openrouter/google/gemini")).toBe(
      "openrouter"
    );
    expect(getProviderFromModelId("unknown/model")).toBeNull();
  });

  it("reports missing provider env vars", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");

    expect(getMissingProviderConfig("openrouter/google/gemini")).toEqual({
      envVar: "OPENROUTER_API_KEY",
      provider: "openrouter",
      providerName: "OpenRouter",
    });
  });

  it("treats providers with API keys as configured", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");

    expect(isProviderConfigured("openrouter")).toBe(true);
    expect(getMissingProviderConfig("openrouter/google/gemini")).toBeNull();
  });
});
