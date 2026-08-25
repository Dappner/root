import { useEffect } from "react";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/lib/nav";
import { routes } from "@/lib/routes";

interface GoFetchError extends Error {
  endpoint?: string;
  statusCode?: number;
  statusText?: string;
  responseBody?: unknown;
}

interface RouteErrorProps {
  error: (Error | GoFetchError) & { digest?: string };
  /** Re-run the failed render/load. Optional: the Next `error.tsx` always
   *  supplies it; TanStack's `errorComponent` supplies `reset` too. */
  reset?: () => void;
}

/**
 * Shared error UI for the authenticated tree. Parses RFC-7807 / GoFetchError
 * shapes into friendly copy. Rendered by both the Next `error.tsx` boundary and
 * the TanStack route `errorComponent` during the dual-stack window.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error("Page error:", error);
    if ("responseBody" in error && error.responseBody) {
      console.error("Response body:", error.responseBody);
    }
  }, [error]);

  const { title, description, action } = getErrorDetails(error);

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
      <Card className="max-w-lg w-full border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription className="text-base mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error.digest && (
            <div className="rounded-md bg-muted p-3 text-sm font-mono">
              <p className="text-muted-foreground">Error ID:</p>
              <p className="text-foreground">{error.digest}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {action === "retry" && reset && (
            <Button onClick={reset} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={routes.root} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            }
          />
        </CardFooter>
      </Card>
    </div>
  );
}

function getErrorDetails(error: Error | GoFetchError): {
  title: string;
  description: string;
  action: "retry" | "go-home";
} {
  if ("statusCode" in error && typeof error.statusCode === "number") {
    const endpoint = error.endpoint || "unknown endpoint";
    const code = error.statusCode;
    switch (code) {
      case 404:
        return {
          title: "Resource Not Found",
          description: `The requested resource (${endpoint}) could not be found. It may have been deleted or moved.`,
          action: "go-home",
        };
      case 405:
        return {
          title: "Service Temporarily Unavailable",
          description:
            "The backend service is starting up or being updated. Please try again in a moment.",
          action: "retry",
        };
      case 500:
        return {
          title: "Server Error",
          description: `The server encountered an error while processing ${endpoint}. Our team has been notified.`,
          action: "retry",
        };
      case 503:
        return {
          title: "Service Unavailable",
          description:
            "The service is temporarily unavailable. Please try again in a few moments.",
          action: "retry",
        };
      default:
        return {
          title: "Request Failed",
          description: `Failed to load data from ${endpoint}. Status: ${code}`,
          action: "retry",
        };
    }
  }

  const message = error.message || "Something went wrong";
  const fetchErrorMatch = message.match(/Failed to fetch (.+): (\d+)/);
  if (fetchErrorMatch) {
    const [, endpoint, statusCode] = fetchErrorMatch;
    const code = parseInt(statusCode);
    switch (code) {
      case 404:
        return {
          title: "Resource Not Found",
          description: `The requested resource (${endpoint}) could not be found.`,
          action: "go-home",
        };
      case 405:
        return {
          title: "Service Temporarily Unavailable",
          description:
            "The backend service is starting up or being updated. Please try again in a moment.",
          action: "retry",
        };
      default:
        return {
          title: "Request Failed",
          description: `Failed to load data from ${endpoint}. Status: ${code}`,
          action: "retry",
        };
    }
  }

  return {
    title: "Unexpected Error",
    description:
      message.length > 200 ? message.substring(0, 200) + "..." : message,
    action: "retry",
  };
}
