import { describe, expect, it } from "vitest";
import {
  ChatContextLimitError,
  limitChatFiles,
  MAX_CONTEXT_FILE_BYTES,
  MAX_CONTEXT_FILES,
  MAX_CONTEXT_MESSAGES,
  selectRecentChatMessages,
} from "../ai/chat-context";
import type { ChatMessage } from "../types";

function textMessage(role: "user" | "assistant", text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: "text", text }],
  };
}

function fileMessage(url: string, filename = "notes.pdf"): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [
      {
        type: "file",
        filename,
        mediaType: "application/pdf",
        url,
      },
      { type: "text", text: "Summarize this" },
    ],
  };
}

describe("selectRecentChatMessages", () => {
  it("keeps a bounded recent suffix that starts with a user message", () => {
    const messages = Array.from(
      { length: MAX_CONTEXT_MESSAGES + 20 },
      (_, index) =>
        textMessage(index % 2 === 0 ? "user" : "assistant", `${index}`)
    );

    const result = selectRecentChatMessages(messages);

    expect(result.wasTruncated).toBe(true);
    expect(result.messages.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);
    expect(result.messages[0]?.role).toBe("user");
    expect(result.messages.at(-1)?.parts).toEqual(messages.at(-1)?.parts);
  });

  it("always keeps the newest message", () => {
    const newest = textMessage("user", "x".repeat(200_000));
    const result = selectRecentChatMessages([
      textMessage("user", "old"),
      textMessage("assistant", "old reply"),
      newest,
    ]);

    expect(result.messages).toEqual([newest]);
    expect(result.wasTruncated).toBe(true);
  });
});

describe("limitChatFiles", () => {
  it("keeps current files and omits older files beyond the budget", () => {
    const old = fileMessage("/uploads/old.pdf", "old.pdf");
    const current = fileMessage("/uploads/current.pdf", "current.pdf");
    const result = limitChatFiles({
      fileSizes: new Map([
        ["/uploads/old.pdf", 10 * 1024 * 1024],
        ["/uploads/current.pdf", 20 * 1024 * 1024],
      ]),
      messages: [old, textMessage("assistant", "Earlier reply"), current],
    });

    expect(result.wasTruncated).toBe(true);
    expect(result.messages[0]?.parts.some((part) => part.type === "file")).toBe(
      false
    );
    expect(
      result.messages.at(-1)?.parts.some((part) => part.type === "file")
    ).toBe(true);
  });

  it("rejects an oversized set of current files with a clear error", () => {
    const current = fileMessage("/uploads/current.pdf");

    expect(() =>
      limitChatFiles({
        fileSizes: new Map([
          ["/uploads/current.pdf", MAX_CONTEXT_FILE_BYTES + 1],
        ]),
        messages: [current],
      })
    ).toThrow(ChatContextLimitError);
  });

  it("rejects too many current attachments", () => {
    const urls = Array.from(
      { length: MAX_CONTEXT_FILES + 1 },
      (_, index) => `/uploads/${index}.pdf`
    );
    const message = {
      ...fileMessage(urls[0]),
      parts: urls.map((url) => ({
        type: "file" as const,
        filename: "notes.pdf",
        mediaType: "application/pdf" as const,
        url,
      })),
    };

    expect(() =>
      limitChatFiles({
        fileSizes: new Map(urls.map((url) => [url, 1])),
        messages: [message],
      })
    ).toThrow(`Please attach at most ${MAX_CONTEXT_FILES} files`);
  });
});
