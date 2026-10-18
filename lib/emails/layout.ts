/**
 * Plain, single-column transactional email layout.
 * Table-based with inline styles so it renders the same in Gmail, Outlook and Apple Mail.
 */

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";

export function paragraph(html: string) {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:26px;color:${INK};">${html}</p>`;
}

export function link(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="color:${INK};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

/** A solid, bulletproof button (works without images or CSS support). */
export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${INK};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function codeBox(code: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="padding:16px 24px;border:1px solid ${LINE};border-radius:8px;background:#fafafa;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${INK};">${escapeHtml(code)}</td></tr></table>`;
}

/** Numbered list rendered as plain lines, no bullets or icons. */
export function steps(items: { title: string; text: string }[]) {
  return items
    .map(
      (it, i) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td valign="top" style="width:28px;font-size:16px;line-height:24px;font-weight:600;color:${MUTED};">${i + 1}.</td><td style="font-size:16px;line-height:24px;color:${INK};"><strong>${escapeHtml(it.title)}</strong><br><span style="color:${MUTED};">${escapeHtml(it.text)}</span></td></tr></table>`,
    )
    .join("");
}

export function renderEmail({
  preheader,
  heading,
  body,
  footer,
}: {
  preheader: string;
  heading: string;
  body: string;
  footer?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONT};">
<tr><td style="padding:0 4px 20px;font-size:18px;font-weight:700;letter-spacing:-0.2px;color:${INK};">Questreak</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:36px 32px;">
<h1 style="margin:0 0 20px;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.3px;color:${INK};">${escapeHtml(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:13px;line-height:20px;color:${MUTED};">${footer ?? ""}<br>© 2026 Questreak</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
