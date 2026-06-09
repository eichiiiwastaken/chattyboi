import type { Attachment } from "@/lib/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon } from "./icons";

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

  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted transition-all duration-200 hover:border-border/80 hover:shadow-[var(--shadow-float)] hover:ring-1 hover:ring-foreground/10"
      data-testid="input-attachment-preview"
    >
      {contentType?.startsWith("image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        // biome-ignore lint/performance/noImgElement: dynamic blob URLs
        <img
          alt={name ?? "attachment"}
          className="size-full object-cover transition-all duration-200 group-hover:brightness-75"
          draggable={false}
          src={url}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs transition-colors duration-200 group-hover:text-foreground">
          File
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </div>
      )}

      {onRemove && !isUploading && (
        <>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 pb-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="line-clamp-2 text-[10px] font-medium text-white">
              {name ?? "attachment"}
            </span>
          </div>
          <button
            className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white opacity-100 shadow-sm transition-all duration-200 hover:scale-110 hover:bg-black/90 active:scale-95"
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
