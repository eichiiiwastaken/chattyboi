import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Mock Models", () => {
  it("mock models produce streaming responses", async () => {
    const { chatModel } = await import("../ai/models.mock");
    const model = chatModel as any;

    const result = model.doStream({ prompt: "Hello" });
    expect(result.stream).toBeDefined();

    const reader = result.stream.getReader();
    const chunks: unknown[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    expect(chunks.length).toBeGreaterThan(0);
    const textDeltas = chunks.filter((c: any) => c.type === "text-delta");
    expect(textDeltas.length).toBeGreaterThan(0);
  });

  it("mock title model generates a title", async () => {
    const { titleModel: mockTitleModel } = await import("../ai/models.mock");
    const model = mockTitleModel as any;

    const result = await model.doGenerate({ prompt: "Test" });
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toBeDefined();
  });

  it("mock models return greeting for hello prompts", async () => {
    const { chatModel } = await import("../ai/models.mock");
    const model = chatModel as any;

    const result = await model.doGenerate({ prompt: "hello there" });
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("Hello");
  });

  it("mock models return weather for weather prompts", async () => {
    const { chatModel } = await import("../ai/models.mock");
    const model = chatModel as any;

    const result = await model.doGenerate({
      prompt: "What is the weather?",
    });
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("San Francisco");
  });

  it("mock models return default for unknown prompts", async () => {
    const { chatModel } = await import("../ai/models.mock");
    const model = chatModel as any;

    const result = await model.doGenerate({ prompt: "Some random topic" });
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain("mock response");
  });
});

describe("provider model discovery", () => {
  it("fetches public OpenRouter models without an OpenRouter API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({
        data: [{ id: "moonshotai/kimi-k2", name: "Kimi K2" }],
      }),
      ok: true,
    } as Response);
    const { fetchOpenRouterModels } = await import("../ai/models");

    await expect(fetchOpenRouterModels()).resolves.toEqual([
      {
        description: "",
        id: "openrouter/moonshotai/kimi-k2",
        name: "Kimi K2",
        provider: "openrouter",
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      { next: { revalidate: 86_400 } }
    );
  });

  it("fetches public OpenCode Go models without an OpenCode API key", async () => {
    vi.stubEnv("OPENCODE_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({
        data: [{ id: "kimi-k2.6" }],
      }),
      ok: true,
    } as Response);
    const { fetchOpenCodeGoModels } = await import("../ai/models");

    await expect(fetchOpenCodeGoModels()).resolves.toEqual([
      {
        description: "",
        id: "opencodego/kimi-k2.6",
        name: "kimi-k2.6",
        provider: "opencodego",
      },
    ]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://opencode.ai/zen/go/v1/models",
      { next: { revalidate: 86_400 } }
    );
  });
});
