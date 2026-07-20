import { describe, expect, it } from "vitest";
import { copyMessagesForBranch } from "../chat-branch";
import type { DBMessage } from "../db/schema";

function message(
  id: string,
  role: "assistant" | "user",
  createdAt: Date
): DBMessage {
  return {
    id,
    chatId: "source-chat",
    role,
    parts: [{ type: "text", text: id }],
    attachments: [],
    createdAt,
    metadata: null,
  };
}

describe("copyMessagesForBranch", () => {
  it("copies context through the selected message with fresh ids", () => {
    const sourceMessages = [
      message("user-1", "user", new Date("2026-01-01T00:00:00Z")),
      message("assistant-1", "assistant", new Date("2026-01-01T00:00:01Z")),
      message("user-2", "user", new Date("2026-01-01T00:00:02Z")),
      message("assistant-2", "assistant", new Date("2026-01-01T00:00:03Z")),
    ];
    const ids = ["copy-1", "copy-2", "copy-3"];

    const result = copyMessagesForBranch({
      sourceMessages,
      sourceBranchMessageId: "user-2",
      newChatId: "branched-chat",
      generateId: () => ids.shift() ?? "unexpected",
    });

    expect(result.branchMessageId).toBe("copy-3");
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map((item) => item.id)).toEqual([
      "copy-1",
      "copy-2",
      "copy-3",
    ]);
    expect(
      result.messages.every((item) => item.chatId === "branched-chat")
    ).toBe(true);
    expect(result.messages.at(-1)?.parts).toEqual(sourceMessages[2]?.parts);
  });

  it("preserves the selected assistant response in the new chat", () => {
    const selectedResponse = message(
      "assistant-1",
      "assistant",
      new Date("2026-01-01T00:00:01Z")
    );
    selectedResponse.parts = [
      { type: "text", text: "The response to keep" },
      { type: "reasoning", text: "Supporting reasoning" },
    ];

    const result = copyMessagesForBranch({
      sourceMessages: [
        message("user-1", "user", new Date("2026-01-01T00:00:00Z")),
        selectedResponse,
      ],
      sourceBranchMessageId: "assistant-1",
      newChatId: "branched-chat",
      generateId: () => "copy-assistant",
    });

    expect(result.branchMessageId).toBe("copy-assistant");
    expect(result.messages).toHaveLength(2);
    expect(result.messages.at(-1)).toMatchObject({
      chatId: "branched-chat",
      id: "copy-assistant",
      parts: selectedResponse.parts,
      role: "assistant",
    });
  });
});
