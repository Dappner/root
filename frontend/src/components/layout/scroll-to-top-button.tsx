"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const shouldShow = scrollY > viewportHeight;

    setIsVisible(shouldShow);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Throttle scroll events to 100ms
    const handleScroll = () => {
      if (throttleTimerRef.current) return;

      throttleTimerRef.current = setTimeout(() => {
        checkScrollPosition();
        throttleTimerRef.current = null;
      }, 100);
    };

    // Check initial scroll position
    checkScrollPosition();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [checkScrollPosition]);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!isVisible) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleScrollToTop}
      aria-label="Scroll to top"
      className={cn(
        "fixed top-20 right-4 z-40",
        "opacity-60 hover:opacity-100",
        "transition-opacity duration-200",
        "shadow-sm border border-border/50",
        "bg-background/80 backdrop-blur-sm",
        "hover:bg-muted"
      )}
    >
      <ArrowUp className="w-3.5 h-3.5" />
    </Button>
  );
}
