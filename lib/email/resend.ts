import "server-only";
import { Resend } from "resend";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const resend = new Resend(requireEnv("RESEND_API_KEY"));

// Sender: set EMAIL_FROM to an address at your verified Resend domain.
// Falls back to Resend's test sender (delivers only to your own address).
const SENDER_EMAIL =
  process.env.EMAIL_FROM || "DOJ Roleplay <onboarding@resend.dev>"; // or custom domain once configured

/**
 * Send an invitation email with an activation link.
 */
export async function sendInvitationEmail(
  toEmail: string,
  plainToken: string,
) {
  const activationLink = `${requireEnv("NEXT_PUBLIC_SITE_URL")}/auth/activate?token=${encodeURIComponent(plainToken)}`;

  const { error } = await resend.emails.send({
    from: SENDER_EMAIL,
    to: toEmail,
    subject: "Welcome to The Department of Justice",
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f2f2f0; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f0; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#ffffff; border-collapse:collapse;">

          <!-- Header band -->
          <tr>
            <td style="background-color:#14263f; border-bottom: 4px solid #A3852C; padding: 28px 40px;">
              <p style="margin:0; color:#D9C27E; font-size:11px; letter-spacing:3px; text-transform:uppercase;">Roleplay Community</p>
              <h1 style="margin:6px 0 0; color:#ffffff; font-size:26px; font-weight:normal;">Welcome to The Department of Justice</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px 8px;">
              <p style="margin:0 0 16px; color:#1d2733; font-size:15px; line-height:1.6;">
                You have been invited to join the Department of Justice as a member of staff.
                Activate your account to choose a password and access the staff portal.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 20px;">
                <tr>
                  <td style="background-color:#14263f; border-radius:4px;">
                    <a href="${activationLink}" style="display:inline-block; padding:13px 28px; color:#ffffff; font-size:15px; text-decoration:none;">
                      Activate your account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px; color:#5a6472; font-size:13px; line-height:1.6;">
                This link works once and expires in 7 days. If the button does not work, copy this address into your browser:
              </p>
              <p style="margin:0 0 20px; word-break:break-all;">
                <a href="${activationLink}" style="color:#14263f; font-size:12px;">${activationLink}</a>
              </p>
              <p style="margin:0 0 24px; color:#5a6472; font-size:13px; line-height:1.6;">
                If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e4e4e0; padding: 20px 40px 28px;">
              <p style="margin:0; color:#8a9099; font-size:11px; line-height:1.6;">
                A fictional roleplay platform. Not affiliated with the United States Government,
                the U.S. Department of Justice, Roblox Corporation or Discord.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `Welcome to The Department of Justice

You have been invited to join the Department of Justice roleplay community as a member of staff. Activate your account to choose a password and access the staff portal:

${activationLink}

This link works once and expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.

A fictional roleplay platform. Not affiliated with the United States Government, the U.S. Department of Justice, Roblox Corporation or Discord.`,
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error(
      `Email delivery failed: ${error.message}. Check RESEND_API_KEY and email address.`,
    );
  }
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  plainToken: string,
) {
  const resetLink = `${requireEnv("NEXT_PUBLIC_SITE_URL")}/auth/reset-password?token=${encodeURIComponent(plainToken)}`;

  const { error } = await resend.emails.send({
    from: SENDER_EMAIL,
    to: toEmail,
    subject: "Reset your password",
    html: `
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetLink}" style="background: #14263f; color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; text-decoration: none; display: inline-block;">
          Reset your password
        </a>
      </p>
      <p>
        Or copy this link into your browser:
        <br/>
        <code>${resetLink}</code>
      </p>
      <p>This link expires in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Email delivery failed. Please try again later.");
  }
}
