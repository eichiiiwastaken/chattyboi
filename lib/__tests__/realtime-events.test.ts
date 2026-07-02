import { describe, expect, it } from "vitest";
import {
  getUserChatEventsChannel,
  toSseMessage,
} from "../realtime/events-shared";

describe("chat realtime events", () => {
  it("uses per-user channels", () => {
    expect(getUserChatEventsChannel("user-123")).toBe(
      "chattyboi:chat-events:user:user-123"
    );
  });

  it("serializes events as named SSE messages", () => {
    const event = {
      type: "chat.stream.created" as const,
      chatId: "chat-123",
      streamId: "stream-123",
    };

    expect(toSseMessage(event)).toBe(
      `event: chat.stream.created\ndata: ${JSON.stringify(event)}\n\n`
    );
  });
});
