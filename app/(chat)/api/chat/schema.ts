import { z } from "zod";

export const MAX_CHAT_TEXT_LENGTH = 100_000;

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(MAX_CHAT_TEXT_LENGTH),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  filename: z.string().min(1).max(100),
  url: z.string().min(1),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  webSearchEnabled: z.boolean().optional(),
  isOneTimeChat: z.boolean().optional(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
