"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "dxg-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSavedPreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";
};

const applyPreference = (preference: ThemePreference) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    preference === "system" ? (prefersDark ? "dark" : "light") : preference;
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolvedTheme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(getSavedPreference);

  useEffect(() => {
    applyPreference(preference);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (preference === "system") {
        applyPreference("system");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const nextPreference =
        event.newValue === "light" || event.newValue === "dark"
          ? event.newValue
          : "system";
      setPreferenceState(nextPreference);
    };

    media.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [preference]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    if (nextPreference === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, nextPreference);
    }
    applyPreference(nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextPreference = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    setPreference(nextPreference);
  }, [setPreference]);

  const value = useMemo(
    () => ({ preference, setPreference, toggleTheme }),
    [preference, setPreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
