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
    subject: "Activate your Department of Justice account",
    html: `
      <p>You have been invited to join the Department of Justice roleplay platform.</p>
      <p>
        <a href="${activationLink}" style="background: #14263f; color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; text-decoration: none; display: inline-block;">
          Activate your account
        </a>
      </p>
      <p>
        Or copy this link into your browser:
        <br/>
        <code>${activationLink}</code>
      </p>
      <p>This link expires in 7 days.</p>
      <hr/>
      <p style="font-size: 0.875rem; color: #666;">
        This is a fictional roleplay platform. Not affiliated with the United States Government, 
        the U.S. Department of Justice, Roblox Corporation or Discord.
      </p>
    `,
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
