import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

export function PaymentNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-white/[0.03] p-4 text-sm">
      <HugeiconsIcon icon={InformationCircleIcon} size={18} className="mt-0.5 shrink-0 text-sky-400" />
      <p className="text-muted">
        Online payments aren&apos;t live yet. You can place an order now and it will be saved as{" "}
        <span className="text-foreground">awaiting payment</span>. Nothing is charged or started until payment is available.
      </p>
    </div>
  );
}
