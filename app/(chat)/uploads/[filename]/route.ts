import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";
import {
  getUploadPath,
  isSafeUploadFilename,
  readUploadMetadata,
} from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!isSafeUploadFilename(filename) || path.basename(filename) !== filename) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:api").toResponse();
  }

  try {
    const metadata = await readUploadMetadata(filename);

    if (metadata.userId !== session.user.id) {
      return new ChatbotError("forbidden:api").toResponse();
    }

    const uploadPath = getUploadPath(filename);
    const [buffer, fileStat] = await Promise.all([
      readFile(uploadPath),
      stat(uploadPath),
    ]);

    return new Response(buffer, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": fileStat.size.toString(),
        "Content-Type": metadata.contentType,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to read upload:", error);
    return new ChatbotError("not_found:api").toResponse();
  }
}
