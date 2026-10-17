import "server-only";

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: "verify" | "reset" = "verify",
) {
  const intro =
    purpose === "reset"
      ? "Use this code to reset your Questreak password:"
      : "Your Questreak verification code is:";
  const subjectText =
    purpose === "reset" ? "password reset code" : "verification code";
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BREVO_API_KEY is not set");
    }
    console.log(`
[dev] Questreak verification code for ${to}: ${code}
`);
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
      subject: `${code} is your Questreak ${subjectText}`,
      htmlContent: `<div style="font-family:sans-serif"><p>${intro}</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo email failed (${res.status}): ${detail}`);
  }
}
