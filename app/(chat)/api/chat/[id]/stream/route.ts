import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { auth } from "@/app/(auth)/auth";
import { getChatById, getStreamIdsByChatId } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { getResumableStreamContext } from "@/lib/streams/resumable";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [session, chat] = await Promise.all([auth(), getChatById({ id })]);

  if (!chat) {
    return new Response(null, { status: 204 });
  }

  if (
    chat.visibility === "private" &&
    (!session?.user || session.user.id !== chat.userId)
  ) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const streamContext = getResumableStreamContext();
  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const streamIds = await getStreamIdsByChatId({ chatId: id });

  for (const streamId of streamIds.toReversed()) {
    const stream = await streamContext.resumeExistingStream(streamId);
    if (stream) {
      return new Response(stream, {
        headers: UI_MESSAGE_STREAM_HEADERS,
      });
    }
  }

  return new Response(null, { status: 204 });
}
