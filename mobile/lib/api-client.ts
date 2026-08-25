import { API_URL } from "@/lib/config";

export async function apiFetch(path: string, init?: RequestInit) {
  const url = new URL(path, API_URL);

  return fetch(url.toString(), {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
}
