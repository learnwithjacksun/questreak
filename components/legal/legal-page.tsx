import type { ReactNode } from "react";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/cta-footer";
import { SITE } from "@/lib/site";

/** Plain long-form page used for the privacy policy, terms and data-deletion instructions. */
export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated {SITE.legalUpdated}</p>
        {intro && <p className="mt-6 text-lg leading-8 text-muted">{intro}</p>}
        <div className="mt-10 space-y-10 [&_a]:underline [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:leading-7 [&_p]:leading-7 [&_p]:text-muted [&_li]:text-muted [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_section>*+*]:mt-3">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
