import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { cn, generateUUID, getTextFromMessage, sanitizeText } from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", undefined, "active")).toBe("base active");
  });

  it("resolves tailwind conflicts", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("generateUUID", () => {
  it("generates a valid UUID v4 format", () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(ids.size).toBe(100);
  });
});

describe("sanitizeText", () => {
  it("removes <has_function_call> markers", () => {
    expect(sanitizeText("text<has_function_call>more")).toBe("textmore");
  });

  it("handles empty streamed text", () => {
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(null)).toBe("");
  });

  it("removes leaked DSML tool call blocks", () => {
    expect(
      sanitizeText(
        'before <| DSML | tool_calls><| DSML | invoke name="webSearch"><| DSML | parameter name="query" string="true">modern philosophers meaning of life today</| DSML | parameter></| DSML | invoke></| DSML | tool_calls> after'
      )
    ).toBe("before  after");
  });

  it("removes orphan DSML tags", () => {
    expect(sanitizeText("text<| DSML | tool_calls>more")).toBe("textmore");
    expect(sanitizeText("text</| DSML | tool_calls>more")).toBe("textmore");
  });

  it("removes <think> blocks with content", () => {
    expect(sanitizeText("before<think>hidden</think>after")).toBe(
      "beforeafter"
    );
  });

  it("removes multi-line <think> blocks", () => {
    expect(sanitizeText("a<think>\nline1\nline2\n</think>b")).toBe("ab");
  });

  it("removes orphan </think> tags", () => {
    expect(sanitizeText("text</think>more")).toBe("textmore");
  });

  it("removes orphan <think> tags", () => {
    expect(sanitizeText("text<think>more")).toBe("textmore");
  });

  it("returns unchanged text if no markers", () => {
    expect(sanitizeText("normal text")).toBe("normal text");
  });
});

describe("getTextFromMessage", () => {
  it("extracts text parts from a message", () => {
    const message = {
      id: "1",
      role: "user" as const,
      parts: [
        { type: "text" as const, text: "Hello" },
        { type: "text" as const, text: " world" },
      ],
    };
    expect(getTextFromMessage(message)).toBe("Hello world");
  });

  it("ignores non-text parts", () => {
    const message = {
      id: "1",
      role: "user" as const,
      parts: [
        { type: "text" as const, text: "Hello" },
        { type: "file" as const, url: "test.png", mediaType: "image/png" },
        { type: "text" as const, text: "!" },
      ],
    };
    expect(getTextFromMessage(message)).toBe("Hello!");
  });

  it("returns empty string for empty parts", () => {
    const message: UIMessage = {
      id: "1",
      role: "user",
      parts: [],
    };
    expect(getTextFromMessage(message)).toBe("");
  });

  it("extracts persisted error parts", () => {
    const message = {
      id: "1",
      role: "assistant" as const,
      parts: [
        {
          type: "error",
          errorText: "Generation failed because the provider is missing a key.",
        },
      ],
    } as unknown as UIMessage;

    expect(getTextFromMessage(message)).toBe(
      "Generation failed because the provider is missing a key."
    );
  });
});
