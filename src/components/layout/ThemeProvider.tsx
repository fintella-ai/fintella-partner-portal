"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type ThemeValue = "light" | "dark";

interface ThemeContextType {
  theme: ThemeValue;
  systemTheme: ThemeValue;
  setTheme: (t: ThemeValue) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  systemTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): ThemeValue {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: ThemeValue) {
  document.documentElement.setAttribute("data-theme", t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemTheme, setSystemTheme] = useState<ThemeValue>("dark");
  const [theme, setThemeState] = useState<ThemeValue>("dark");

  // On mount: read localStorage, fall back to system
  useEffect(() => {
    const sys = getSystemTheme();
    setSystemTheme(sys);

    let stored: ThemeValue | null = null;
    try {
      const raw = localStorage.getItem("theme");
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {}

    const resolved = stored ?? sys;
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  // Listen for OS preference changes (only effective when no localStorage override)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const sys: ThemeValue = e.matches ? "dark" : "light";
      setSystemTheme(sys);
      // Only follow system if user hasn't set a manual override
      try {
        if (!localStorage.getItem("theme")) {
          setThemeState(sys);
          applyTheme(sys);
        }
      } catch {
        setThemeState(sys);
        applyTheme(sys);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((t: ThemeValue) => {
    try { localStorage.setItem("theme", t); } catch {}
    setThemeState(t);
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, systemTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
