import type { UserType } from "@/app/(auth)/auth";

type Entitlements = {
  maxMessagesPerHour: number;
};

function getMaxMessagesPerHour() {
  const rawLimit = process.env.CHAT_MAX_MESSAGES_PER_HOUR;
  if (!rawLimit) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedLimit = Number.parseInt(rawLimit, 10);
  return Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : Number.POSITIVE_INFINITY;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  regular: {
    maxMessagesPerHour: getMaxMessagesPerHour(),
  },
};
