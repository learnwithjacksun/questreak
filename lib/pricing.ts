/** Pure pricing helpers (safe to import on the client). */

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function applyMarkup(cost: number, markupPercent: number) {
  return round2(cost * (1 + markupPercent / 100));
}

export function formatNgn(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(n);
}

/** SMM rates are quoted per 1,000 units. */
export function smmTotal(ratePer1000: number, quantity: number) {
  return round2((ratePer1000 * quantity) / 1000);
}
