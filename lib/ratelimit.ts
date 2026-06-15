import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

const TTL_SECONDS = 60 * 60;

function getIpMaxMessagesPerHour() {
  const rawLimit = process.env.IP_MAX_MESSAGES_PER_HOUR;
  if (!rawLimit) {
    return null;
  }

  const parsedLimit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
}

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export async function checkIpRateLimit(ip: string | undefined) {
  const maxMessages = getIpMaxMessagesPerHour();
  if (!(isProductionEnvironment && ip && maxMessages)) {
    return;
  }

  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > maxMessages) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
  }
}
