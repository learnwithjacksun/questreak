import Image from "next/image";
import { Logo } from "@/components/landing/navbar";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12 min-h-dvh">
        <div className="stick md:relative top-0 md:top-auto">
          <Logo href="/" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </div>

      <div className="sticky top-0 lg:h-dvh">
        <aside className="relative hidden h-full lg:block">
          <Image
            src="/images/auth.jpg"
            alt="Hands holding a phone showing a social media feed"
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="absolute bottom-12 left-16 right-12">
            <p className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
              One post. Every place your audience is.
            </p>
            <p className="mt-3 text-sm text-white/70">
              Write once and publish to all your social accounts with Questreak.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
