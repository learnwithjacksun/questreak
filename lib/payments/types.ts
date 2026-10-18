/**
 * Payment aggregator contract. Pick a provider later (Paystack, Flutterwave, Stripe...),
 * implement this interface in `lib/payments/<provider>.ts`, register it in `index.ts`,
 * and add its webhook at `app/api/payments/webhook/route.ts`. Nothing else changes.
 */
export type CheckoutRequest = {
  orderId: string;
  amountNgn: number;
  email: string;
  description: string;
  /** Where the provider should send the customer after payment. */
  returnUrl: string;
};

export type CheckoutSession = {
  provider: string;
  reference: string;
  /** Hosted checkout page the customer is redirected to. */
  url: string;
};

export type PaymentStatus = "pending" | "paid" | "failed";

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutSession>;
  /** Verify a webhook signature and return the order/payment it refers to, or null if invalid. */
  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<{ reference: string; orderId: string; status: PaymentStatus } | null>;
  getStatus(reference: string): Promise<PaymentStatus>;
}

export class PaymentsUnavailableError extends Error {
  constructor() {
    super("Online payments aren't available yet.");
  }
}
