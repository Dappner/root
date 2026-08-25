export interface Theme {
  background: string;
  foreground: string;
  muted: string;
  card: string;
}

// Reads concrete theme tokens from CSS custom properties so canvas rendering
// tracks next-themes without handing unresolved var(...) aliases to Canvas.
export function readTheme(el: HTMLElement, isDark: boolean): Theme {
  const styles = getComputedStyle(el);
  const v = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    background: v("--background", isDark ? "#0a0a0a" : "#ffffff"),
    foreground: v("--foreground", isDark ? "#fafafa" : "#0a0a0a"),
    muted: v("--muted-foreground", isDark ? "#a1a1aa" : "#71717a"),
    card: v("--card", isDark ? "#0a0a0a" : "#ffffff"),
  };
}
