import {
  button,
  codeBox,
  link,
  paragraph,
  renderEmail,
  steps,
} from "./layout";

export type EmailContent = { subject: string; html: string; text: string };

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function otpEmail(code: string, purpose: "verify" | "reset"): EmailContent {
  const reset = purpose === "reset";
  const heading = reset ? "Reset your password" : "Verify your email";
  const lead = reset
    ? "Use this code to choose a new password for your Questreak account."
    : "Enter this code to finish creating your Questreak account.";

  const html = renderEmail({
    preheader: `${code} is your Questreak ${reset ? "password reset" : "verification"} code`,
    heading,
    body:
      paragraph(lead) +
      codeBox(code) +
      paragraph("The code expires in 10 minutes."),
    footer: reset
      ? "If you didn&rsquo;t ask to reset your password, you can ignore this email. Your password won&rsquo;t change."
      : "If you didn&rsquo;t create a Questreak account, you can ignore this email.",
  });

  const text = [
    heading,
    "",
    lead,
    "",
    `Your code: ${code}`,
    "It expires in 10 minutes.",
    "",
    reset
      ? "If you didn't ask to reset your password, ignore this email. Your password won't change."
      : "If you didn't create a Questreak account, ignore this email.",
  ].join("\n");

  return {
    subject: `${code} is your Questreak ${reset ? "password reset code" : "verification code"}`,
    html,
    text,
  };
}

export function welcomeEmail(name: string): EmailContent {
  const dashboard = `${appUrl()}/dashboard`;
  const accounts = `${appUrl()}/dashboard/accounts`;
  const boost = `${appUrl()}/dashboard/growth/boost`;
  const market = `${appUrl()}/dashboard/growth/accounts`;

  const stepItems = [
    { title: "Connect your accounts", text: "Link the networks you post to, using each one's official sign-in." },
    { title: "Write a post", text: "Write it once, pick where it goes, and preview it for each network." },
    { title: "Publish or schedule", text: "Send it now or pick a time. You can track every post from one place." },
  ];

  const html = renderEmail({
    preheader: "Your email is verified. Here's how to get started.",
    // renderEmail escapes the heading, so pass the raw name here.
    heading: `Welcome to Questreak, ${name}`,
    body:
      paragraph("Your email is verified and your account is ready. Questreak lets you write a post once and send it to all your social accounts.") +
      paragraph("Here&rsquo;s the quickest way to get going:") +
      steps(stepItems) +
      button(dashboard, "Go to your dashboard") +
      paragraph(
        `Want to grow faster? You can also browse ${link(boost, "boost services")} and ${link(market, "ready-made accounts")} from the Growth menu.`,
      ) +
      paragraph(`You can connect your first account any time from the ${link(accounts, "Accounts page")}.`),
    footer: "You&rsquo;re getting this because you just created a Questreak account.",
  });

  const text = [
    `Welcome to Questreak, ${name}`,
    "",
    "Your email is verified and your account is ready. Questreak lets you write a post once and send it to all your social accounts.",
    "",
    "The quickest way to get going:",
    ...stepItems.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`),
    "",
    `Go to your dashboard: ${dashboard}`,
    "",
    `Boost services: ${boost}`,
    `Ready-made accounts: ${market}`,
    `Connect your first account: ${accounts}`,
    "",
    "You're getting this because you just created a Questreak account.",
  ].join("\n");

  return { subject: "Welcome to Questreak", html, text };
}
