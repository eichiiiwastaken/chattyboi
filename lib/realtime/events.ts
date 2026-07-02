import "server-only";

import { createClient } from "redis";
import {
  type ChatRealtimeEvent,
  getUserChatEventsChannel,
} from "./events-shared";

type RedisClient = ReturnType<typeof createClient>;

let publisher: RedisClient | null = null;
let publisherConnecting: Promise<RedisClient | null> | null = null;

function getPublisher() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (publisher?.isReady) {
    return publisher;
  }

  if (publisherConnecting) {
    return publisherConnecting;
  }

  publisher = createClient({ url: process.env.REDIS_URL });
  publisher.on("error", () => undefined);

  publisherConnecting = publisher
    .connect()
    .then(() => publisher)
    .catch(() => {
      publisher = null;
      return null;
    })
    .finally(() => {
      publisherConnecting = null;
    });

  return publisherConnecting;
}

export async function createChatEventsSubscriber() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  const subscriber = createClient({ url: process.env.REDIS_URL });
  subscriber.on("error", () => undefined);

  try {
    await subscriber.connect();
    return subscriber;
  } catch {
    await subscriber.quit().catch(() => undefined);
    return null;
  }
}

export async function publishChatEvent({
  userId,
  event,
}: {
  userId: string;
  event: ChatRealtimeEvent;
}) {
  const redis = await getPublisher();
  if (!redis?.isReady) {
    return;
  }

  await redis
    .publish(getUserChatEventsChannel(userId), JSON.stringify(event))
    .catch(() => undefined);
}
