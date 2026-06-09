import { describe, expect, it } from "vitest";
import {
  ChatbotError,
  getMessageByErrorCode,
  visibilityBySurface,
} from "../errors";

describe("ChatbotError", () => {
  it("creates an error with correct type and surface", () => {
    const err = new ChatbotError("unauthorized:chat");
    expect(err.type).toBe("unauthorized");
    expect(err.surface).toBe("chat");
    expect(err.statusCode).toBe(401);
  });

  it("creates a bad_request error with 400 status", () => {
    const err = new ChatbotError("bad_request:api");
    expect(err.type).toBe("bad_request");
    expect(err.statusCode).toBe(400);
  });

  it("creates a forbidden error with 403 status", () => {
    const err = new ChatbotError("forbidden:chat");
    expect(err.statusCode).toBe(403);
  });

  it("creates a not_found error with 404 status", () => {
    const err = new ChatbotError("not_found:chat");
    expect(err.statusCode).toBe(404);
  });

  it("creates a rate_limit error with 429 status", () => {
    const err = new ChatbotError("rate_limit:chat");
    expect(err.statusCode).toBe(429);
  });

  it("creates an offline error with 503 status", () => {
    const err = new ChatbotError("offline:chat");
    expect(err.statusCode).toBe(503);
  });

  it("has correct messages for known error codes", () => {
    const err = new ChatbotError("unauthorized:chat");
    expect(err.message).toContain("sign in");

    const err2 = new ChatbotError("rate_limit:chat");
    expect(err2.message).toContain("limit");

    const err3 = new ChatbotError("offline:chat");
    expect(err3.message).toContain("trouble");

    const err4 = new ChatbotError("not_found:chat");
    expect(err4.message).toContain("not found");
  });

  it("handles database errors with generic message", () => {
    const err = new ChatbotError("offline:database");
    expect(err.message).toBe(
      "An error occurred while executing a database query."
    );
  });

  it("toResponse returns a JSON Response with correct status code", () => {
    const err = new ChatbotError("unauthorized:chat");
    const response = err.toResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("toResponse includes error code in log visibility mode", async () => {
    const err = new ChatbotError("offline:database");
    const response = err.toResponse();
    const json = await response.json();
    expect(json.code).toBe("");
    expect(json.message).toContain("try again");
  });
});

describe("getMessageByErrorCode", () => {
  it("returns known messages", () => {
    expect(getMessageByErrorCode("bad_request:api")).toContain(
      "couldn't be processed"
    );
    expect(getMessageByErrorCode("unauthorized:auth")).toContain("sign in");
    expect(getMessageByErrorCode("forbidden:chat")).toContain(
      "belongs to another user"
    );
  });

  it("returns default message for unknown codes", () => {
    const msg = getMessageByErrorCode("unknown:surface" as never);
    expect(msg).toBe("Something went wrong. Please try again later.");
  });
});

describe("visibilityBySurface", () => {
  it("database errors are log-only (not shown to user)", () => {
    expect(visibilityBySurface.database).toBe("log");
  });

  it("user-facing surfaces use response visibility", () => {
    expect(visibilityBySurface.chat).toBe("response");
    expect(visibilityBySurface.auth).toBe("response");
    expect(visibilityBySurface.api).toBe("response");
  });
});
