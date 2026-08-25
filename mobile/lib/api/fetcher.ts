import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  constructor(status: number, statusText: string, body: unknown) {
    super(`API error: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export async function mobileFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const cookies = authClient.getCookie();

  const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
  const isFormData = options?.body instanceof FormData;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(cookies ? { Cookie: cookies } : {}),
      ...options?.headers,
    },
    credentials: "omit",
  });

  if (!response.ok) {
    let body: unknown = undefined;
    try {
      const text = await response.text();
      try { body = JSON.parse(text); } catch { body = text || undefined; }
    } catch {}
    throw new ApiError(response.status, response.statusText, body);
  }

  if (response.status === 204) {
    return { data: undefined, status: 204 } as T;
  }

  const data = await response.json();
  return { data, status: response.status } as T;
}
