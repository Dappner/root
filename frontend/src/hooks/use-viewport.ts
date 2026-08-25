"use client";

import { useEffect, useState } from "react";

interface ViewportSize {
  width: number;
  height: number;
}

export function useViewport() {
  const [viewport, setViewport] = useState<ViewportSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}

// Tailwind breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export function useBreakpoint() {
  const { width } = useViewport();

  return {
    isMobile: width < BREAKPOINTS.sm,
    isTablet: width >= BREAKPOINTS.sm && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isSmall: width < BREAKPOINTS.md,
    isMedium: width >= BREAKPOINTS.md && width < BREAKPOINTS.xl,
    isLarge: width >= BREAKPOINTS.xl,
    width,
  };
}

// Convenience hook for mobile detection
export function useIsMobile() {
  const { isMobile } = useBreakpoint();
  return isMobile;
}
