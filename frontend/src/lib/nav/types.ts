import type { ReactNode, AnchorHTMLAttributes } from "react";

/** Minimal Next-compatible router surface used across the app. */
export interface AppRouter {
  push: (href: string) => void;
  replace: (href: string) => void;
  refresh: () => void;
  back: () => void;
}

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  // Optional: in Base UI `render={<Link href=... />}` slots, the parent clones
  // the element and injects children, so call sites legitimately omit them.
  children?: ReactNode;
  prefetch?: boolean;
}
