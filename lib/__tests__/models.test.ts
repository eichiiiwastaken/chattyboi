import { describe, expect, it } from "vitest";

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
