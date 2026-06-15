import { hashSync } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import type { AllowedUser } from "@/lib/auth/users";
import { getOrCreateUser, saveChatWithMessages } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

const importSecret = process.env.CHATTYBOI_STUDYBOI_IMPORT_SECRET;

function getEnvUsers(): AllowedUser[] {
  try {
    const raw = process.env.ALLOWED_USERS;
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(
        (u: {
          username: string;
          name: string;
          password?: string;
          passwordHash?: string;
        }) => {
          const username = u.username?.trim().toLowerCase();
          const name = u.name?.trim();
          const passwordHash = u.passwordHash?.trim();
          const password = u.password;

          if (
            !username ||
            !name ||
            (!passwordHash && typeof password !== "string")
          ) {
            return null;
          }

          return {
            username,
            name,
            passwordHash:
              passwordHash ??
              hashSync(password as NonNullable<typeof password>, 10),
          };
        }
      )
      .filter((u): u is AllowedUser => u !== null);
  } catch {
    console.error("[studyboi/import] Failed to parse ALLOWED_USERS env var");
    return [];
  }
}

const envUsers = getEnvUsers();

function getAllowedUser(username: string) {
  return envUsers.find((u) => u.username === username);
}

const importBodySchema = z.object({
  title: z.string().min(1).max(200),
  initialMessage: z.string().min(1).max(10_000),
  context: z
    .object({
      courseTitle: z.string().min(1).max(200),
      examDate: z.string().optional(),
      topicTitle: z.string().max(200).optional(),
      blockTitle: z.string().max(200).optional(),
      summary: z.string().max(5000).optional(),
      sourceExcerpts: z
        .array(
          z.object({
            label: z.string().max(200),
            text: z.string().max(5000),
            sourceRef: z.string().max(200).optional(),
          })
        )
        .max(20)
        .optional(),
      practiceQuestions: z.array(z.string().max(2000)).max(20).optional(),
      knownMistakes: z.array(z.string().max(2000)).max(20).optional(),
      studyboiReturnUrl: z.string().max(500).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let userId: string | null = null;

  if (importSecret) {
    const secretHeader = request.headers.get("x-studyboi-import-secret");
    if (secretHeader === importSecret) {
      const username = request.headers.get("x-studyboi-user");
      if (username) {
        const cleanUsername = username.trim().toLowerCase();
        const allowedUser = getAllowedUser(cleanUsername);
        if (allowedUser) {
          const email = `${cleanUsername}@chattyboi.local`;
          const randomPassword = generateUUID();
          const dbUser = await getOrCreateUser(email, randomPassword);
          if (dbUser) {
            userId = dbUser.id;
          }
        }
      }

      if (!userId) {
        return NextResponse.json(
          {
            error:
              "Unauthorized. x-studyboi-user header missing or does not match an allowed user.",
          },
          { status: 401 }
        );
      }
    }
  }

  if (!userId) {
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid session or import secret." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = importBodySchema.parse(body);

    const title = parsed.title;
    const initialMessage = parsed.initialMessage;
    const contextStr = parsed.context
      ? formatContextMessage(parsed.context as Record<string, unknown>)
      : "";
    const fullMessage = contextStr
      ? `${initialMessage}\n\n${contextStr}`
      : initialMessage;

    const chatId = generateUUID();
    const messageId = generateUUID();

    await saveChatWithMessages({
      chat: {
        id: chatId,
        userId,
        title: title.slice(0, 100),
        visibility: "private",
      },
      messages: [
        {
          id: messageId,
          chatId,
          role: "user",
          parts: [{ type: "text", text: fullMessage }],
          attachments: [],
          metadata: { source: "studyboi_import" },
          createdAt: new Date(),
        },
      ],
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3232";
    const url = `${baseUrl}/chat/${chatId}`;

    return NextResponse.json({ chatId, url }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("[studyboi/import] Error:", error);
    return NextResponse.json(
      { error: "Failed to create import chat" },
      { status: 500 }
    );
  }
}

function formatContextMessage(context: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push("--- StudyBoi Context ---");

  if (typeof context.courseTitle === "string") {
    lines.push(`Course: ${context.courseTitle}`);
  }
  if (typeof context.examDate === "string") {
    lines.push(`Exam Date: ${context.examDate}`);
  }
  if (typeof context.topicTitle === "string") {
    lines.push(`Topic: ${context.topicTitle}`);
  }
  if (typeof context.blockTitle === "string") {
    lines.push(`Block: ${context.blockTitle}`);
  }
  if (typeof context.summary === "string") {
    lines.push(`\nSummary:\n${context.summary}`);
  }

  if (Array.isArray(context.sourceExcerpts)) {
    lines.push("\nSource Excerpts:");
    for (const excerpt of context.sourceExcerpts) {
      if (excerpt && typeof excerpt === "object") {
        const label = typeof excerpt.label === "string" ? excerpt.label : "";
        const text = typeof excerpt.text === "string" ? excerpt.text : "";
        const ref =
          typeof excerpt.sourceRef === "string"
            ? ` [${excerpt.sourceRef}]`
            : "";
        if (text) {
          lines.push(`\n${label}${ref}:\n${text}`);
        }
      }
    }
  }

  if (Array.isArray(context.practiceQuestions)) {
    lines.push("\nPractice Questions:");
    for (const q of context.practiceQuestions) {
      if (typeof q === "string") {
        lines.push(`- ${q}`);
      }
    }
  }

  if (Array.isArray(context.knownMistakes)) {
    lines.push("\nKnown Mistakes:");
    for (const m of context.knownMistakes) {
      if (typeof m === "string") {
        lines.push(`- ${m}`);
      }
    }
  }

  if (typeof context.studyboiReturnUrl === "string") {
    lines.push(`\nReturn to StudyBoi: ${context.studyboiReturnUrl}`);
  }

  lines.push("--- End StudyBoi Context ---");

  return lines.join("\n");
}
