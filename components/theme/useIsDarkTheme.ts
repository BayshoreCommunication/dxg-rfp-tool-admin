"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

// Follows the `dark` class on <html>, whoever sets it (the saved choice, the system setting or
// a switch), so a "Dark mode" switch always shows the theme actually on screen.
export function useIsDarkTheme() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}
