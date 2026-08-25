/**
 * Custom fetcher for orval-generated API clients.
 * Attaches the Better-Auth JWT (Bearer) and handles RFC 7807 Problem+JSON errors.
 */
import { authHeaders, clearJwt } from "@/lib/auth/jwt";

/**
 * RFC 7807 Problem Details for HTTP APIs
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /** RFC7807 type (URI or stable code like "error/not-found") */
  type?: string;
  /** Short human-readable summary */
  title?: string;
  /** HTTP status code */
  status: number;
  /** Human-readable explanation specific to this occurrence */
  detail?: string;
  /** URI reference identifying the specific occurrence (usually request path) */
  instance?: string;
  /** Field-level validation errors */
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  code?: string;
  message: string;
}

/**
 * API Error with structured Problem+JSON support
 */
export class APIError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title || `API error: ${problem.status}`);
    this.name = "APIError";
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get fieldErrors(): FieldError[] {
    return this.problem.errors || [];
  }

  /**
   * Get the error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }

  /**
   * Check if this is a validation error (400 with field errors)
   */
  isValidationError(): boolean {
    return this.status === 400 && this.fieldErrors.length > 0;
  }

  /**
   * Check if this is a not found error
   */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * Check if this is an unauthorized error
   */
  isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * Parse response as Problem+JSON or create a generic problem
 */
async function parseErrorResponse(response: Response): Promise<ProblemDetails> {
  try {
    const data = await response.json();
    // Check if it's a Problem+JSON response
    if (data && typeof data === "object" && "status" in data) {
      return data as ProblemDetails;
    }
    // Legacy error format
    return {
      status: response.status,
      title: response.statusText,
      detail: data.error || data.message || response.statusText,
    };
  } catch {
    return {
      status: response.status,
      title: response.statusText,
      detail: response.statusText,
    };
  }
}

/**
 * Issue a request with the Bearer JWT attached, retrying once on a 401 with a
 * freshly minted token. Shared by the orval `customFetch` and the hand-rolled
 * SSE streams so both recover identically when a cached JWT expires.
 *
 * If a token cannot be acquired at all (auth-server down, session lost),
 * throws `APIError(401)` so the request is never sent unauthenticated and the
 * query client's 401 handler routes the user to `/login`.
 */
export async function authenticatedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const send = async () => {
    let auth: Record<string, string>;
    try {
      auth = await authHeaders();
    } catch {
      // Couldn't mint a JWT — surface as an unauthorized error rather than
      // sending a header-less request that 401s with a misleading message.
      throw new APIError({
        status: 401,
        title: "Unauthorized",
        detail: "Could not acquire an authentication token.",
      });
    }
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...auth,
        ...options?.headers,
      },
    });
  };

  const response = await send();

  // A 401 usually means the cached JWT expired; drop it and retry once with a
  // freshly minted token before surfacing the error.
  if (response.status === 401) {
    clearJwt();
    return send();
  }

  return response;
}

/**
 * Custom fetch function for orval-generated clients.
 * Signature: customFetch<T>(url: string, options?: RequestInit) => Promise<T>
 *
 * The orval-generated code passes the full URL (including /api prefix) and
 * standard RequestInit options. We attach the Bearer JWT and parse the response.
 */
export async function customFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;

  const response = await authenticatedFetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const problem = await parseErrorResponse(response);
    throw new APIError(problem);
  }

  // Convert Headers to plain object for serialization (IndexedDB)
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: undefined, status: 204, headers } as T;
  }

  try {
    const data = await response.json();
    return { data, status: response.status, headers } as T;
  } catch {
    throw new APIError({
      status: response.status,
      title: "Parse Error",
      detail: "Failed to parse response as JSON",
    });
  }
}

export default customFetch;
