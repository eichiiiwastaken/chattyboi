import { PinIcon, PinOffIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { Chat } from "@/lib/db/schema";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onPin,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onPin: (chatId: string, pinnedAt: Date | null) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  return (
    <SidebarMenuItem
      className={`group/menu-item rounded-lg transition-colors hover:bg-sidebar-accent/45 ${
        isActive ? "bg-sidebar-accent/80" : ""
      }`}
    >
      <SidebarMenuButton
        asChild
        className="h-8 rounded-lg pr-18 text-[13px] text-sidebar-foreground/55 transition-colors duration-150 hover:bg-transparent hover:text-sidebar-foreground data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground"
        isActive={isActive}
      >
        <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
          <span className="truncate">
            {chat.title?.trim() || "Untitled chat"}
          </span>
        </Link>
      </SidebarMenuButton>

      <SidebarMenuAction
        className="right-8 top-1/2! size-7 -translate-y-1/2 rounded-sm bg-transparent text-sidebar-foreground/45 transition-[background-color,color,transform] duration-150 hover:scale-105 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground peer-data-active/menu-button:text-sidebar-foreground/55"
        onClick={(e) => {
          e.preventDefault();
          onPin(chat.id, chat.pinnedAt ? null : new Date());
        }}
        showOnHover={!isActive}
      >
        {chat.pinnedAt ? <PinOffIcon /> : <PinIcon />}
        <span className="sr-only">{chat.pinnedAt ? "Unpin" : "Pin"}</span>
      </SidebarMenuAction>

      <SidebarMenuAction
        className="right-0 top-1/2! h-8 w-8 -translate-y-1/2 rounded-sm bg-transparent text-sidebar-foreground/45 transition-[background-color,color] duration-150 hover:bg-destructive/15 hover:text-destructive peer-data-active/menu-button:text-sidebar-foreground/55"
        onClick={(e) => {
          e.preventDefault();
          onDelete(chat.id);
        }}
        showOnHover={!isActive}
      >
        <Trash2Icon />
        <span className="sr-only">Delete</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
};

export const ChatItem = PureChatItem;
