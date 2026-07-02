import { auth } from "@/app/(auth)/auth";
import { createChatEventsSubscriber } from "@/lib/realtime/events";
import {
  type ChatRealtimeEvent,
  getUserChatEventsChannel,
  toSseMessage,
} from "@/lib/realtime/events-shared";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const subscriber = await createChatEventsSubscriber();
  if (!subscriber) {
    return new Response(null, { status: 204 });
  }

  const channel = getUserChatEventsChannel(session.user.id);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: string) => {
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          // The request is already closing; cleanup below handles Redis.
        }
      };

      send("retry: 3000\n\n");

      const keepAlive = setInterval(() => {
        send(": keepalive\n\n");
      }, 25_000);

      subscriber
        .subscribe(channel, (rawMessage) => {
          try {
            const event = JSON.parse(rawMessage) as ChatRealtimeEvent;
            send(toSseMessage(event));
          } catch {
            // Ignore malformed messages on this internal channel.
          }
        })
        .catch(() => {
          clearInterval(keepAlive);
          controller.close();
        });

      request.signal.addEventListener(
        "abort",
        () => {
          clearInterval(keepAlive);
          subscriber.unsubscribe(channel).catch(() => undefined);
          subscriber.quit().catch(() => undefined);
          try {
            controller.close();
          } catch {
            // Stream may already be closed.
          }
        },
        { once: true }
      );
    },
    cancel() {
      subscriber.unsubscribe(channel).catch(() => undefined);
      subscriber.quit().catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
