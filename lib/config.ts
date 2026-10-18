import "server-only";

/** Server-side commercial settings read from env with safe defaults. */
export const config = {
  get markupPercent() {
    const n = Number(process.env.MARKUP_PERCENT ?? 30);
    return Number.isFinite(n) && n >= 0 ? n : 30;
  },
  get usdNgnRate() {
    const n = Number(process.env.USD_NGN_RATE ?? 1600);
    return Number.isFinite(n) && n > 0 ? n : 1600;
  },
};
