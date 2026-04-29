"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppNav } from "./AppNav";
import { checkHealth } from "@/lib/api";

const API_URL      = process.env.NEXT_PUBLIC_API_URL;
const POLL_ONLINE  = 30_000;
const POLL_OFFLINE = 5_000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [backendOnline, setBackendOnline] = useState(false);
  const [checking,      setChecking     ] = useState(!!API_URL);
  const prevOnline = useRef(false);

  const ping = useCallback(async () => {
    if (!API_URL) return;
    const ok = await checkHealth();
    setChecking(false);
    setBackendOnline(ok);
    if (ok && !prevOnline.current) {
      // backend just came back online — tell all pages to re-fetch immediately
      window.dispatchEvent(new Event("backend-online"));
    }
    prevOnline.current = ok;
  }, []);

  useEffect(() => {
    ping();
  }, [ping]);

  // adaptive polling: fast when offline, slow when online
  useEffect(() => {
    const ms = backendOnline ? POLL_ONLINE : POLL_OFFLINE;
    const id = setInterval(ping, ms);
    return () => clearInterval(id);
  }, [backendOnline, ping]);

  const showBanner = !!API_URL && !backendOnline;

  return (
    <div className="flex h-full">
      <AppSidebar backendOnline={backendOnline} />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <AppNav />

        {/* Wake-up banner */}
        {showBanner && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
            <span>
              {checking
                ? "Connecting to backend…"
                : "Backend is waking up — this takes ~30 seconds on the free tier…"}
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
