"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { requestPasswordReset } from "@/app/actions/auth";
import { forgotSchema } from "@/lib/validators/auth";
import { Field, SubmitButton } from "./form-parts";

type Values = { email: string };

export function ForgotForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema) });

  function onSubmit({ email }: Values) {
    startTransition(async () => {
      const res = await requestPasswordReset(email);
      // On success the action redirects to /reset-password.
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        Forgot your password?
      </h1>
      <p className="mt-2 text-muted">
        Enter your email and we&apos;ll send you a 5-digit code to reset it.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 space-y-4"
      >
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="pt-2">
          <SubmitButton pending={pending}>Send reset code</SubmitButton>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
