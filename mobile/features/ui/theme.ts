export const appTheme = {
  color: {
    background: "#FAF5EB",
    surface: "#FCFCF5",
    foreground: "#2C2C2C",
    muted: "#666050",
    border: "#C9C0A8",
    borderSoft: "#E4DBC5",
    primary: "#3F6B51",
    primaryForeground: "#FFFFFF",
    danger: "#9D2B2B",
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    round: 999,
  },
  typography: {
    pageTitle: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "700" as const,
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700" as const,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
    },
  },
} as const;

export type AppTheme = typeof appTheme;
