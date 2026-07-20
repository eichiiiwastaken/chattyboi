import type { InferUIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import {
  MAX_SEARCH_ANSWER_CHARACTERS,
  withSearchAnswerFallback,
} from "../ai/search-answer-fallback";
import type { ChatMessage } from "../types";

async function collect(chunks: InferUIMessageChunk<ChatMessage>[]) {
  const stream = new ReadableStream<InferUIMessageChunk<ChatMessage>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const reader = withSearchAnswerFallback(stream, {
    chatId: "chat-123",
    modelId: "test-model",
  }).getReader();
  const output: InferUIMessageChunk<ChatMessage>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return output;
    }
    output.push(value);
  }
}

describe("search answer fallback", () => {
  it("limits a runaway search answer and appends an incomplete-response notice", async () => {
    const output = await collect([
      {
        type: "tool-output-available",
        toolCallId: "search-1",
        output: { results: [{ title: "Result" }] },
      },
      { type: "text-start", id: "answer" },
      {
        type: "text-delta",
        id: "answer",
        delta: "a".repeat(MAX_SEARCH_ANSWER_CHARACTERS + 1),
      },
      { type: "text-end", id: "answer" },
      { type: "finish", finishReason: "length" },
    ]);

    const text = output
      .filter(
        (chunk): chunk is Extract<typeof chunk, { type: "text-delta" }> =>
          chunk.type === "text-delta"
      )
      .map((chunk) => chunk.delta);

    expect(text[0]).toHaveLength(MAX_SEARCH_ANSWER_CHARACTERS);
    expect(text.at(-1)).toContain("may be incomplete");
  });

  it("adds an error part when search produced results but no answer", async () => {
    const output = await collect([
      {
        type: "tool-output-available",
        toolCallId: "search-1",
        output: { results: [{ title: "Result" }] },
      },
      { type: "finish", finishReason: "stop" },
    ]);

    expect(
      output.some(
        (chunk) =>
          chunk.type === "error" && chunk.errorText.includes("Please retry")
      )
    ).toBe(true);
  });

  it("adds an error part when a normal turn finishes empty", async () => {
    const output = await collect([{ type: "finish", finishReason: "length" }]);

    expect(
      output.some(
        (chunk) =>
          chunk.type === "error" &&
          chunk.errorText.includes("context or output limit")
      )
    ).toBe(true);
  });

  it("adds an error part when a stream closes without a finish event", async () => {
    const output = await collect([]);

    expect(
      output.some(
        (chunk) =>
          chunk.type === "error" &&
          chunk.errorText.includes("ended unexpectedly")
      )
    ).toBe(true);
  });

  it("does not add a second error card when the provider reported an error", async () => {
    const output = await collect([
      { type: "error", errorText: "Rate limit exceeded" },
      { type: "finish", finishReason: "error" },
    ]);

    expect(output.filter((chunk) => chunk.type === "error")).toHaveLength(1);
  });
});
