import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service – Questreak",
  description: "The rules for using Questreak.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms are an agreement between you and Questreak. By creating an account or using the service, you agree to them."
    >
      <Section title="The service">
        <p>
          Questreak lets you compose posts and publish or schedule them to social media accounts you connect, manage media, and optionally order
          third-party growth services. Features and supported networks can change over time.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>You must provide accurate information and keep your password and connected accounts secure.</li>
          <li>You are responsible for activity under your account.</li>
          <li>You must be at least 16 and able to form a binding agreement.</li>
        </ul>
      </Section>

      <Section title="Your content and connected accounts">
        <p>
          You keep ownership of what you post. You give us permission to process it so we can publish it to the networks you choose. You confirm
          you have the right to post it and the right to use each account you connect.
        </p>
        <p>
          Each social network has its own terms and rules, and they apply to everything you post through Questreak. We are not responsible for a
          network rejecting, limiting or removing content, or for changes to a network&apos;s features, limits or availability.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul>
          <li>Don&apos;t post anything unlawful, deceptive, abusive, infringing or harmful.</li>
          <li>Don&apos;t use Questreak to spam, or to get around a network&apos;s limits or rules.</li>
          <li>Don&apos;t attempt to disrupt, reverse engineer or gain unauthorised access to the service.</li>
        </ul>
        <p>We may limit or suspend accounts that break these rules or put the service or other users at risk.</p>
      </Section>

      <Section title="Growth services and account purchases">
        <p>
          Boost services and ready-made accounts are optional extras fulfilled by third-party suppliers. We don&apos;t guarantee results, delivery
          times, retention or account longevity. Using them may be against the rules of some social networks and may lead to the affected accounts
          being limited or removed. You are responsible for how you use them and accept that risk.
        </p>
        <p>
          Prices are shown before you order. Payment terms, including any refund conditions, will be shown at checkout when online payments are
          available.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          We work to keep Questreak available but can&apos;t promise it will be uninterrupted or error-free. Scheduled posts depend on the
          networks&apos; services being available at the time. We may change or discontinue features, and we&apos;ll give notice of material
          changes where we reasonably can.
        </p>
      </Section>

      <Section title="Ending your use">
        <p>
          You can stop using Questreak and delete your account at any time in Settings. We may suspend or end access if you breach these terms.
          Sections that should reasonably survive ending (such as liability limits) do.
        </p>
      </Section>

      <Section title="Disclaimers and liability">
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties of any kind, to the extent the law allows. To the extent the law allows,
          Questreak is not liable for indirect or consequential losses, lost profits, or loss of data, and our total liability for any claim is
          limited to the amount you paid us in the 12 months before the claim.
        </p>
      </Section>

      <Section title="Changes to these terms and contact">
        <p>
          We may update these terms and will change the date above when we do; continuing to use the service means you accept the update.
          Questions: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. See also our <a href="/privacy">Privacy Policy</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
