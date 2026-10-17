import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Forgot password – Questreak" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
