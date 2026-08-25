export interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
  userName?: string;
}

export function renderPasswordResetEmail({
  to,
  resetUrl,
  userName,
}: PasswordResetEmailParams) {
  const subject = "Reset your password";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            background-color: #000;
            color: #fff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer {
            font-size: 12px;
            color: #666;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Reset your password</h1>
          <p>Hi${userName ? ` ${userName}` : ""},</p>
          <p>You requested to reset your password for your Root account. Click the button below to choose a new password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>If you didn't request a password reset, you can safely ignore this email. The link will expire in 1 hour.</p>
          <p>For security reasons, this link can only be used once.</p>
        </div>
        <div class="footer">
          <p>If the button doesn't work, copy and paste this URL into your browser:</p>
          <p>${resetUrl}</p>
        </div>
      </body>
    </html>
  `;

  return { to, subject, html };
}
