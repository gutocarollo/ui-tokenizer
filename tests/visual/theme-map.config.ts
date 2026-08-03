// Theme map de UM app-alvo (exemplo real, anonimizado — D4). O mecanismo
// confirmado no hook de tema do alvo: lê localStorage["theme"]
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
