/** Public facts about the product, used by legal pages and emails. */
export const SITE = {
  name: "Questreak",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@questlabs.cc",
  /** Date the policies were last updated. Bump when the text changes. */
  legalUpdated: "18 October 2026",
};
