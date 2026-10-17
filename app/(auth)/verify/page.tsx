import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Verify email – Questreak" };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
