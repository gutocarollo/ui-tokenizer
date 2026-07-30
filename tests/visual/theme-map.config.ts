// Makers AI theme map (AnythingLLM fork). The mechanism is confirmed in
// frontend/src/hooks/useTheme.js: it reads localStorage["theme"]
// (light|dark|system), sets documentElement[data-theme], and toggles the
// body's `light` class. seedLocalStorage is authoritative because the hook
// reads it before the first render; documentAttrs covers the first paint.
export type ThemeState = {
  documentAttrs?: Record<string, string>;
  documentClasses?: string[];
  seedLocalStorage?: Record<string, string>;
};

export const THEME_STATES: Record<string, ThemeState> = {
  light: {
    seedLocalStorage: { theme: "light" },
    documentAttrs: { "data-theme": "light" },
  },
  dark: {
    seedLocalStorage: { theme: "dark" },
    documentAttrs: { "data-theme": "dark" },
  },
};
