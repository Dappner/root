import { sendEmail } from "./send";
import {
  type PasswordResetEmailParams,
  renderPasswordResetEmail,
} from "./templates/password-reset";

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
) {
  const { to, subject, html } = renderPasswordResetEmail(params);

  return sendEmail({
    from: process.env.EMAIL_FROM || "Root <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}

export { type PasswordResetEmailParams };
