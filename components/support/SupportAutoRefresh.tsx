"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15_000;

/**
 * The admin app does not keep a notification socket open. Refresh support
 * server data while the page is visible, and immediately when the agent
 * returns to the tab, so customer replies and status changes do not go stale.
 */
export default function SupportAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return null;
}
