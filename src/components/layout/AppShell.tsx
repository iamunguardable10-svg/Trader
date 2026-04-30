"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppNav } from "./AppNav";
import { MobileNav } from "./MobileNav";
import { checkHealth } from "@/lib/api";
import { DataProvider } from "@/contexts/DataContext";

const API_URL      = process.env.NEXT_PUBLIC_API_URL;
const POLL_ONLINE  = 30_000;
const POLL_OFFLINE = 5_000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [backendOnline, setBackendOnline] = useState(false);
  const [checking,      setChecking     ] = useState(!!API_URL);
  const [sidebarOpen,   setSidebarOpen  ] = useState(false);
  const prevOnline = useRef(false);

  const ping = useCallback(async () => {
    if (!API_URL) return;
    const ok = await checkHealth();
    setChecking(false);
    setBackendOnline(ok);
    if (ok && !prevOnline.current) {
      window.dispatchEvent(new Event("backend-online"));
    }
    prevOnline.current = ok;
  }, []);

  useEffect(() => { ping(); }, [ping]);

  useEffect(() => {
    const ms = backendOnline ? POLL_ONLINE : POLL_OFFLINE;
    const id = setInterval(ping, ms);
    return () => clearInterval(id);
  }, [backendOnline, ping]);

  const showBanner = !!API_URL && !backendOnline;

  return (
    <DataProvider>
      <div className="flex h-full">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <AppSidebar backendOnline={backendOnline} />
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden">
              <AppSidebar backendOnline={backendOnline} onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <AppNav onMenuClick={() => setSidebarOpen(true)} />

          {showBanner && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-400">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
              <span>
                {checking
                  ? "Verbinde mit Backend…"
                  : "Backend startet — dauert ~30 Sekunden auf Free Tier…"}
              </span>
            </div>
          )}

          {/* pb-16 on mobile to avoid content behind bottom nav */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        </div>
      </div>

      <MobileNav />
    </DataProvider>
  );
}
