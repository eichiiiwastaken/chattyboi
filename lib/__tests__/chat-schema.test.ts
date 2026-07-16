import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_TEXT_LENGTH,
  postRequestBodySchema,
} from "../../app/(chat)/api/chat/schema";

const validRequest = (text: string) => ({
  id: crypto.randomUUID(),
  message: {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  },
  selectedChatModel: "chat-model",
  selectedVisibilityType: "private",
});

describe("postRequestBodySchema", () => {
  it("accepts long pasted text", () => {
    const result = postRequestBodySchema.safeParse(
      validRequest("a".repeat(5000))
    );

    expect(result.success).toBe(true);
  });

  it("accepts supported reasoning effort values", () => {
    const result = postRequestBodySchema.safeParse({
      ...validRequest("hello"),
      selectedReasoningEffort: "high",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported reasoning effort values", () => {
    const result = postRequestBodySchema.safeParse({
      ...validRequest("hello"),
      selectedReasoningEffort: "extreme",
    });

    expect(result.success).toBe(false);
  });

  it("rejects text that exceeds the chat text limit", () => {
    const result = postRequestBodySchema.safeParse(
      validRequest("a".repeat(MAX_CHAT_TEXT_LENGTH + 1))
    );

    expect(result.success).toBe(false);
  });

  it("rejects multiple text parts that exceed the aggregate text limit", () => {
    const request = {
      ...validRequest("hello"),
      message: {
        ...validRequest("hello").message,
        parts: [
          { type: "text", text: "a".repeat(MAX_CHAT_TEXT_LENGTH / 2 + 1) },
          { type: "text", text: "b".repeat(MAX_CHAT_TEXT_LENGTH / 2 + 1) },
        ],
      },
    };

    expect(postRequestBodySchema.safeParse(request).success).toBe(false);
  });

  it("accepts an attachment-only message with an empty text part", () => {
    const request = {
      ...validRequest(""),
      message: {
        ...validRequest("").message,
        parts: [
          {
            type: "file",
            mediaType: "application/pdf",
            filename: "notes.pdf",
            url: "/uploads/notes.pdf",
          },
          { type: "text", text: "" },
        ],
      },
    };

    expect(postRequestBodySchema.safeParse(request).success).toBe(true);
  });
});
