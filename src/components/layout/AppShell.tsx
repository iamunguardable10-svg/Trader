"use client";

import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppNav } from "./AppNav";
import { checkHealth } from "@/lib/api";

const API_URL    = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS    = 30_000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [backendOnline, setBackendOnline] = useState(false);

  const ping = useCallback(async () => {
    if (!API_URL) return;
    setBackendOnline(await checkHealth());
  }, []);

  useEffect(() => {
    ping();
    const id = setInterval(ping, POLL_MS);
    return () => clearInterval(id);
  }, [ping]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <AppSidebar backendOnline={backendOnline} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <AppNav />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
