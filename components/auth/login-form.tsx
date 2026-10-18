"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { signIn } from "@/app/actions/auth";
import { signInSchema, type SignInInput } from "@/lib/validators/auth";
import { Divider, Field, GoogleButton, PasswordField, SubmitButton } from "./form-parts";

const queryErrors: Record<string, string> = {
  google_failed: "Google sign-in failed. Please try again.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unavailable: "Google sign-in isn't configured yet.",
};

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const params = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  useEffect(() => {
    const code = params.get("error");
    if (code && queryErrors[code]) (code === "google_cancelled" ? toast.info : toast.error)(queryErrors[code]);
    if (params.get("passwordReset")) {
      toast.success("Password updated. Sign in with your new password.");
    }
  }, [params]);

  function onSubmit(values: SignInInput) {
    startTransition(async () => {
      const res = await signIn(values);
      // On success the action redirects, so we only get here on failure.
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to your Questreak account.</p>

      <div className="mt-8">
        <GoogleButton label="Continue with Google" />
        <Divider />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="-mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <div className="pt-2">
            <SubmitButton pending={pending}>Sign in</SubmitButton>
          </div>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        New to Questreak?{" "}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
