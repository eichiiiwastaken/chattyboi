import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export interface UploadMetadata {
  userId: string;
  contentType: string;
}

export function isSafeUploadFilename(filename: string) {
  return (
    filename.length > 0 &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}

export function getUploadPath(filename: string) {
  if (!isSafeUploadFilename(filename)) {
    throw new Error("Unsafe upload filename");
  }

  return path.join(UPLOADS_DIR, filename);
}

function getUploadMetadataPath(filename: string) {
  if (!isSafeUploadFilename(filename)) {
    throw new Error("Unsafe upload filename");
  }

  return path.join(UPLOADS_DIR, `${filename}.json`);
}

export async function saveUpload({
  filename,
  buffer,
  metadata,
}: {
  filename: string;
  buffer: Buffer;
  metadata: UploadMetadata;
}) {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(getUploadPath(filename), buffer);
  await writeFile(getUploadMetadataPath(filename), JSON.stringify(metadata));
}

export async function readUploadMetadata(filename: string) {
  const metadata = await readFile(getUploadMetadataPath(filename), "utf8");
  return JSON.parse(metadata) as UploadMetadata;
}
