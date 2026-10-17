"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { resendOtp, verifyOtp } from "@/app/actions/auth";
import { OtpInput } from "./otp-input";
import { SubmitButton } from "./form-parts";

const RESEND_SECONDS = 30;

export function VerifyForm() {
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = useState("");
  const [hasError, setHasError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function submit(value: string) {
    if (value.length !== 5 || pending) return;
    startTransition(async () => {
      const res = await verifyOtp({ email, code: value });
      // On success the action redirects to /dashboard.
      if (res && !res.ok) {
        setHasError(true);
        setCode("");
        toast.error(res.error);
      }
    });
  }

  function handleChange(value: string) {
    setHasError(false);
    setCode(value);
    if (value.length === 5) submit(value);
  }

  function resend() {
    startResend(async () => {
      const res = await resendOtp(email);
      if (res.ok) {
        toast.success("A new code is on its way.");
        setCooldown(RESEND_SECONDS);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!email) {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Nothing to verify</h1>
        <p className="mt-2 text-muted">
          Start by{" "}
          <Link href="/signup" className="text-foreground underline">
            creating an account
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-muted">
        We sent a 5-digit code to{" "}
        <span className="font-medium text-foreground">{email}</span>. It expires
        in 10 minutes.
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
      >
        <OtpInput
          value={code}
          onChange={handleChange}
          disabled={pending}
          error={hasError}
        />
        <SubmitButton pending={pending}>Verify</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="font-medium text-foreground hover:underline disabled:text-muted disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        <Link href="/signup" className="hover:text-foreground">
          Use a different email
        </Link>
      </p>
    </>
  );
}
