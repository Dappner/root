"use client";

import { motion } from "motion/react";
import { usePathname } from "@/lib/nav";
import { useEffect, useRef } from "react";
import { useAssistantPanel } from "../store";
import { AssistantSurface } from "./assistant-surface";

const DOUBLE_ESCAPE_WINDOW_MS = 650;

export function AssistantPanelRenderer() {
  const open = useAssistantPanel((state) => state.open);
  const context = useAssistantPanel((state) => state.context);
  const draft = useAssistantPanel((state) => state.draft);
  const closeAssistant = useAssistantPanel((state) => state.closeAssistant);
  const lastEscapeAtRef = useRef(0);
  const pathname = usePathname();
  const surfaceKey = JSON.stringify(context);

  useEffect(() => {
    if (pathname === "/ask" && open) {
      closeAssistant();
    }
  }, [pathname, open, closeAssistant]);

  useEffect(() => {
    if (!open) {
      lastEscapeAtRef.current = 0;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const now = Date.now();
      if (now - lastEscapeAtRef.current <= DOUBLE_ESCAPE_WINDOW_MS) {
        event.preventDefault();
        closeAssistant();
        lastEscapeAtRef.current = 0;
        return;
      }

      lastEscapeAtRef.current = now;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAssistant, open]);

  return (
    <motion.aside
      key="assistant-panel"
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: open ? 1 : 0, x: open ? 0 : "100%" }}
      transition={{ duration: 0.16 }}
      aria-hidden={!open}
      inert={!open}
      className="fixed bottom-0 right-0 top-0 z-40 w-full max-w-[min(520px,calc(100vw-3rem))] bg-background data-[closed=true]:pointer-events-none"
      data-closed={!open}
    >
      <AssistantSurface
        key={`${open ? "open" : "closed"}:${surfaceKey}`}
        variant="panel"
        context={context}
        initialDraft={draft}
        onClose={closeAssistant}
      />
    </motion.aside>
  );
}
