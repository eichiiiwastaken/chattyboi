"use client";

import { usePathname } from "next/navigation";
import { ChatShell } from "./shell";

export function ChatShellRoute() {
  const pathname = usePathname();

  if (pathname.startsWith("/settings")) {
    return null;
  }

  return <ChatShell />;
}
