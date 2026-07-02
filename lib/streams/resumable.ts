import "server-only";

import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

export function getResumableStreamContext() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}
