import Link from "next/link";
import { SITE } from "@/lib/site";
import { Logo } from "./navbar";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Platforms", href: "/#platforms" },
    ],
  },
  { title: "Company", links: [{ label: "Contact", href: `mailto:${SITE.supportEmail}` }] },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Data deletion", href: "/data-deletion" },
    ],
  },
];

export function Cta() {
  return (
    <section className="px-5 pb-24">
      <div className="bg-brand-gradient mx-auto max-w-6xl rounded-3xl px-6 py-16 text-center text-white">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready to post everywhere?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-white/85">
          Connect your accounts and publish your first cross-post in minutes.
        </p>
        <a
          href="/signup"
          className="mt-8 inline-block rounded-full bg-white px-7 py-3 font-medium text-black transition-opacity hover:opacity-90"
        >
          Start posting free
        </a>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-14">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            Write once, post everywhere. Cross-posting built on official APIs.
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold">{c.title}</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-12 max-w-6xl px-5 text-sm text-muted">
        © 2026 Questreak. All rights reserved.
      </p>
    </footer>
  );
}
