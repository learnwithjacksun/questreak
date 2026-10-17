"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { signUp } from "@/app/actions/auth";
import { signUpSchema, type SignUpInput } from "@/lib/validators/auth";
import { Divider, Field, GoogleButton, PasswordField, SubmitButton } from "./form-parts";

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  function onSubmit(values: SignUpInput) {
    startTransition(async () => {
      const res = await signUp(values);
      // On success the action redirects to /verify.
      if (res && !res.ok) {
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
          setError(field as keyof SignUpInput, { message });
        }
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-muted">Start posting everywhere in minutes.</p>

      <div className="mt-8">
        <GoogleButton label="Sign up with Google" />
        <Divider />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field
            label="First name or nickname"
            autoComplete="given-name"
            placeholder="Jack"
            error={errors.name?.message}
            {...register("name")}
          />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <div className="pt-2">
            <SubmitButton pending={pending}>Create account</SubmitButton>
          </div>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
