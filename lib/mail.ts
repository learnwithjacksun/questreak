import "server-only";
import { otpEmail, welcomeEmail, type EmailContent } from "@/lib/emails/templates";

/** Sends one transactional email through Brevo. In dev without a key, prints it instead. */
async function sendEmail(to: string, content: EmailContent) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY is not set");
    }
    console.log(`\n[dev email] to: ${to}\nsubject: ${content.subject}\n\n${content.text}\n`);
    return;
  }
  const senderEmail = process.env.MAIL_FROM;
  if (!senderEmail) throw new Error("MAIL_FROM is not set");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Questreak", email: senderEmail },
      to: [{ email: to }],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo email failed (${res.status}): ${detail}`);
  }
}

export function sendOtpEmail(
  to: string,
  code: string,
  purpose: "verify" | "reset" = "verify",
) {
  return sendEmail(to, otpEmail(code, purpose));
}

export function sendWelcomeEmail(to: string, name: string) {
  return sendEmail(to, welcomeEmail(name));
}
