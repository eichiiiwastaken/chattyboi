"use client";

import { useState } from "react";
import type { Attachment } from "@/lib/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon, FileIcon, ImageIcon } from "./icons";

function getPreviewUrl(url: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (basePath && url.startsWith("/") && !url.startsWith(basePath)) {
    return `${basePath}${url}`;
  }

  return url;
}

function getAttachmentLabel(contentType: string, name?: string) {
  const normalizedContentType = contentType.toLowerCase();
  const normalizedName = name?.toLowerCase() ?? "";

  if (
    normalizedContentType === "application/pdf" ||
    normalizedName.endsWith(".pdf")
  ) {
    return "PDF";
  }

  if (normalizedContentType.startsWith("image/")) {
    return "Image";
  }

  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(normalizedName)) {
    return "Image";
  }

  return "File";
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const [imageFailed, setImageFailed] = useState(false);
  const previewUrl = getPreviewUrl(url);
  const label = getAttachmentLabel(contentType, name);
  const isImage =
    contentType.toLowerCase().startsWith("image/") ||
    label === "Image" ||
    previewUrl.startsWith("data:image/");
  const shouldShowImage = isImage && !imageFailed;
  const canOpen = previewUrl.length > 0 && !isUploading;

  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted transition-all duration-200 hover:border-border/80 hover:shadow-[var(--shadow-float)] hover:ring-1 hover:ring-foreground/10"
      data-testid="input-attachment-preview"
      title={name ?? label}
    >
      {shouldShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: falls back to a file tile when the thumbnail URL cannot load
        // biome-ignore lint/performance/noImgElement: dynamic blob URLs
        <img
          alt={name ?? "attachment"}
          className="size-full object-cover transition-all duration-200 group-hover:brightness-75"
          draggable={false}
          onError={() => setImageFailed(true)}
          src={previewUrl}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-muted-foreground text-xs transition-colors duration-200 group-hover:text-foreground">
          <div className="flex size-9 items-center justify-center rounded-md bg-background/70 text-foreground shadow-sm">
            {label === "Image" ? (
              <ImageIcon size={18} />
            ) : (
              <FileIcon size={18} />
            )}
          </div>
          <span className="font-medium text-[11px] uppercase leading-none">
            {label}
          </span>
          {name && (
            <span className="line-clamp-2 max-w-full break-all text-center text-[10px] leading-tight">
              {name}
            </span>
          )}
        </div>
      )}

      {canOpen && (
        <a
          aria-label={`Open ${name ?? label}`}
          className="absolute inset-0 z-20 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href={previewUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="sr-only">Open {name ?? label}</span>
        </a>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </div>
      )}

      {onRemove && !isUploading && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 pb-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="line-clamp-2 text-[10px] font-medium text-white">
              {name ?? "attachment"}
            </span>
          </div>
          <button
            aria-label={`Remove ${name ?? "attachment"}`}
            className="absolute top-1.5 right-1.5 z-30 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-100 shadow-sm transition-all duration-200 hover:scale-110 hover:bg-black/90 active:scale-95"
            onClick={onRemove}
            type="button"
          >
            <CrossSmallIcon size={12} />
          </button>
        </>
      )}
    </div>
  );
};
