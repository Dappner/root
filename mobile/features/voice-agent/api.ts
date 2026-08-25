import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/config";

export async function getElevenLabsSignedUrl(): Promise<string> {
  const cookies = authClient.getCookie();
  const response = await fetch(`${API_URL}/rag-api/voice/elevenlabs/signed-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    credentials: "omit",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs signed URL failed: ${response.status} ${body}`);
  }

  const body = (await response.json()) as { signed_url?: string };
  if (!body.signed_url) {
    throw new Error("ElevenLabs signed URL response was missing signed_url");
  }
  return body.signed_url;
}

export async function getElevenLabsConversationToken(): Promise<string> {
  const cookies = authClient.getCookie();
  const response = await fetch(`${API_URL}/rag-api/voice/elevenlabs/conversation-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    credentials: "omit",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs conversation token failed: ${response.status} ${body}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error("ElevenLabs conversation token response was missing token");
  }
  return body.token;
}
