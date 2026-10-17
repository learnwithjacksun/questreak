import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(30, "Keep it under 30 characters"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const otpSchema = z.object({
  email,
  code: z.string().regex(/^\d{5}$/, "Enter the 5-digit code"),
});

export const newPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({
    email,
    code: z.string().regex(/^\d{5}$/, "Enter the 5-digit code"),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;

export type ResetInput = z.input<typeof resetSchema>;
