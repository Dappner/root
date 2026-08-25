import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (client) return client;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  client = new Resend(apiKey);
  return client;
}

// Thin transport wrapper so templates stay framework-agnostic.
export async function sendEmail(
  payload: Parameters<Resend["emails"]["send"]>[0]
) {
  const resend = getClient();
  return resend.emails.send(payload);
}
