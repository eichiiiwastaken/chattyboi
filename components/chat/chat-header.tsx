"use client";

import { ClockIcon, PanelLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  isOneTimeChat,
  isNewChat,
  hasMessages,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  isOneTimeChat: boolean;
  isNewChat: boolean;
  hasMessages: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const router = useRouter();
  const showOneTimeOption = isNewChat && !hasMessages && !isReadonly;

  if (state === "collapsed" && !isMobile && !showOneTimeOption) {
    return null;
  }

  return (
    <header className="sticky top-0 flex min-h-14 items-center gap-2 bg-sidebar px-3 pt-[env(safe-area-inset-top)]">
      <Button
        className="lg:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      {showOneTimeOption ? (
        <div className="flex h-8 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 text-muted-foreground text-xs transition-colors hover:text-foreground">
          <ClockIcon className="size-3.5" />
          <span>One-time chat</span>
          <Switch
            aria-label="One-time chat"
            checked={isOneTimeChat}
            className="h-4 w-7"
            onCheckedChange={(checked) => {
              router.push(
                checked
                  ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/?temporary=true`
                  : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`
              );
            }}
          />
        </div>
      ) : isOneTimeChat ? (
        <div className="flex h-8 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 text-muted-foreground text-xs">
          <ClockIcon className="size-3.5" />
          One-time chat
        </div>
      ) : (
        !isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.isOneTimeChat === nextProps.isOneTimeChat &&
    prevProps.isNewChat === nextProps.isNewChat &&
    prevProps.hasMessages === nextProps.hasMessages
  );
});
