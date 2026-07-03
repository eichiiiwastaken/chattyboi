import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMissingProviderConfig,
  getProviderFromModelId,
  isGatewayConfigured,
  isProviderConfigured,
  normalizeModelIdForGateway,
  shouldUseGateway,
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

  it("uses AI Gateway for gateway model ids when configured", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "vck-test");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(isGatewayConfigured()).toBe(true);
    expect(shouldUseGateway("google/gemini-3.5-flash")).toBe(true);
    expect(shouldUseGateway("openai/gpt-5")).toBe(true);
    expect(shouldUseGateway("openrouter/google/gemini")).toBe(true);
    expect(getMissingProviderConfig("openai/gpt-5")).toBeNull();
    expect(normalizeModelIdForGateway("openrouter/google/gemini")).toBe(
      "google/gemini"
    );
    expect(normalizeModelIdForGateway("openrouter/~google/gemini")).toBe(
      "google/gemini"
    );
    expect(normalizeModelIdForGateway("~google/gemini")).toBe("google/gemini");
  });

  it("does not treat placeholder env values as configured", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "replace-with-openrouter-api-key");
    vi.stubEnv("AI_GATEWAY_API_KEY", "replace-with-ai-gateway-key");

    expect(isProviderConfigured("openrouter")).toBe(false);
    expect(isGatewayConfigured()).toBe(false);
  });
});
