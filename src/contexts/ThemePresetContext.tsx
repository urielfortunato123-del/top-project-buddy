import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemePreset = "saas" | "apple";

interface ThemePresetContextValue {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
}

const ThemePresetContext = createContext<ThemePresetContextValue>({
  preset: "saas",
  setPreset: () => {},
});

export function useThemePreset() {
  return useContext(ThemePresetContext);
}

export function ThemePresetProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>(() => {
    const saved = localStorage.getItem("essencial_theme_preset");
    return (saved === "saas" || saved === "apple") ? saved : "saas";
  });

  const setPreset = (p: ThemePreset) => {
    setPresetState(p);
    localStorage.setItem("essencial_theme_preset", p);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-preset", preset);
    return () => {
      document.documentElement.removeAttribute("data-theme-preset");
    };
  }, [preset]);

  return (
    <ThemePresetContext.Provider value={{ preset, setPreset }}>
      {children}
    </ThemePresetContext.Provider>
  );
}
