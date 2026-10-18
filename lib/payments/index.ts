import "server-only";
import { PaymentsUnavailableError, type PaymentProvider } from "./types";

export * from "./types";

/** Placeholder adapter used until a payment aggregator is chosen. */
const unconfigured: PaymentProvider = {
  name: "unconfigured",
  async createCheckout() {
    throw new PaymentsUnavailableError();
  },
  async verifyWebhook() {
    return null;
  },
  async getStatus() {
    return "pending";
  },
};

/** Selects the active provider from `PAYMENT_PROVIDER`. Register new adapters here. */
export function getPaymentProvider(): PaymentProvider {
  switch (process.env.PAYMENT_PROVIDER) {
    // case "paystack": return paystack;
    default:
      return unconfigured;
  }
}

export function paymentsEnabled() {
  return getPaymentProvider().name !== "unconfigured";
}
