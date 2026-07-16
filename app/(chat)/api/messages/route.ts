import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagePageByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

const MESSAGE_PAGE_SIZE = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const beforeMessageId = searchParams.get("before") ?? undefined;

  if (!chatId || (beforeMessageId && !UUID_PATTERN.test(beforeMessageId))) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  const [session, chat, messagePage] = await Promise.all([
    auth(),
    getChatById({ id: chatId }),
    getMessagePageByChatId({
      id: chatId,
      limit: MESSAGE_PAGE_SIZE,
      beforeMessageId,
    }),
  ]);

  if (!chat) {
    return Response.json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
      lastModelId: null,
      hasMoreMessages: false,
      oldestMessageId: null,
    });
  }

  if (
    chat.visibility === "private" &&
    (!session?.user || session.user.id !== chat.userId)
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const isReadonly = !session?.user || session.user.id !== chat.userId;

  return Response.json({
    messages: convertToUIMessages(messagePage.messages),
    visibility: chat.visibility,
    userId: chat.userId,
    isReadonly,
    lastModelId: chat.lastModelId,
    hasMoreMessages: messagePage.hasMore,
    oldestMessageId: messagePage.messages[0]?.id ?? null,
  });
}
