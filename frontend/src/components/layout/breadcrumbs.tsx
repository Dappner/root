import { ChevronRight, Home } from "lucide-react";
import { Link } from "@/lib/nav";
import { Fragment } from "react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength).trimEnd()}...`;
}

export function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  return (
    <nav className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
      <Link
        href={routes.root}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isIntermediate = !isLast && index > 0;
        const label = isIntermediate ? truncateLabel(item.label, 30) : item.label;
        const labelClassName = cn(
          "block min-w-0 truncate",
          isLast
            ? "font-medium"
            : "text-muted-foreground hover:text-foreground transition-colors",
          isIntermediate ? "max-w-[30ch]" : "shrink-0",
        );

        return (
          <Fragment key={index}>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className={labelClassName}
                title={item.label}
              >
                {label}
              </Link>
            ) : (
              <span className={labelClassName} title={item.label}>
                {label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
