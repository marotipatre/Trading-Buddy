"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** A thin notice when the connection drops, so a stale price is never mistaken for a live one. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the real connection state after mount
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="sticky top-14 z-20 flex items-center justify-center gap-2 border-b border-warn/40 bg-warn/10 px-4 py-1.5 text-xs font-medium text-warn">
      <WifiOff className="size-3.5" /> You are offline. Prices on screen may be out of date, and orders cannot be checked until you reconnect.
    </div>
  );
}
