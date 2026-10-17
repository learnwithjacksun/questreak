"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { resendResetCode, resetPassword } from "@/app/actions/auth";
import { newPasswordSchema, type ResetInput } from "@/lib/validators/auth";
import { OtpInput } from "./otp-input";
import { PasswordField, SubmitButton } from "./form-parts";

const RESEND_SECONDS = 30;

type Values = Pick<ResetInput, "password" | "confirmPassword">;

export function ResetForm() {
  const email = useSearchParams().get("email") ?? "";
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(newPasswordSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function onSubmit(values: Values) {
    if (code.length !== 5) {
      setCodeError("Enter the 5-digit code");
      return;
    }
    startTransition(async () => {
      const res = await resetPassword({ email, code, ...values });
      // On success the action redirects to /login.
      if (res && !res.ok) {
        if (res.fieldErrors?.code) setCodeError(res.fieldErrors.code);
        else setCodeError(res.error);
        toast.error(res.error);
      }
    });
  }

  function resend() {
    startResend(async () => {
      const res = await resendResetCode(email);
      if (res.ok) {
        toast.success("A new code is on its way.");
        setCooldown(RESEND_SECONDS);
        setCode("");
        setCodeError(undefined);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (!email) {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-muted">
          Start from{" "}
          <Link href="/forgot-password" className="text-foreground underline">
            forgot password
          </Link>{" "}
          to get a reset code.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="mt-2 text-muted">
        If an account exists for{" "}
        <span className="font-medium text-foreground">{email}</span>, we sent a
        5-digit code. Enter it below with your new password.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 space-y-5"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">Reset code</label>
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeError(undefined);
            }}
            disabled={pending}
            error={!!codeError}
          />
          {codeError && (
            <p className="mt-1.5 text-sm text-red-400">{codeError}</p>
          )}
        </div>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <div className="pt-2">
          <SubmitButton pending={pending}>Reset password</SubmitButton>
        </div>
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
        <Link href="/login" className="hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
