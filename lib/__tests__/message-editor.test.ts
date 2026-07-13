import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitEditedMessage } from "@/components/chat/message-editor";
import type { ChatMessage } from "@/lib/types";

const { deleteTrailingMessages } = vi.hoisted(() => ({
  deleteTrailingMessages: vi.fn(),
}));

vi.mock("@/app/(chat)/actions", () => ({ deleteTrailingMessages }));

describe("submitEditedMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps attachments when replacing the edited message", async () => {
    const message = {
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "Before" }],
    } as ChatMessage;
    let updatedMessages: ChatMessage[] = [message];
    const setMessages = vi.fn((updater) => {
      updatedMessages = updater(updatedMessages);
    });
    const regenerate = vi.fn();

    await submitEditedMessage({
      message,
      text: "After",
      attachments: [
        {
          name: "notes.pdf",
          url: "/uploads/notes.pdf",
          contentType: "application/pdf",
        },
      ],
      setMessages: setMessages as never,
      regenerate: regenerate as never,
    });

    expect(deleteTrailingMessages).toHaveBeenCalledWith({ id: message.id });
    expect(updatedMessages[0]?.parts).toEqual([
      {
        type: "file",
        url: "/uploads/notes.pdf",
        filename: "notes.pdf",
        mediaType: "application/pdf",
      },
      { type: "text", text: "After" },
    ]);
    expect(regenerate).toHaveBeenCalledOnce();
  });
});
