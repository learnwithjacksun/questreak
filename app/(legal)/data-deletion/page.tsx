import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Delete your data – Questreak",
  description: "How to delete your Questreak account and the data connected to it.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Delete your data"
      intro="You can remove your Questreak account and everything connected to it at any time. This page explains how, and what happens."
    >
      <Section title="Delete your account yourself">
        <ul>
          <li>Sign in and open <strong className="text-foreground">Settings</strong>.</li>
          <li>Go to the <strong className="text-foreground">Danger zone</strong> tab and choose <strong className="text-foreground">Delete my account</strong>.</li>
          <li>Type DELETE (and your password, if your account has one) to confirm.</li>
        </ul>
      </Section>

      <Section title="What gets deleted">
        <ul>
          <li>Your profile and sign-in details.</li>
          <li>All posts, drafts and schedules, and the publish history.</li>
          <li>Your media library and the files stored for it.</li>
          <li>Every connected social account, including the access tokens we stored for it.</li>
          <li>Login details delivered with any account purchase.</li>
        </ul>
        <p>
          Basic order records may be kept without any delivered credentials, where needed for bookkeeping or legal reasons. Deletion happens
          immediately in our systems; backups are overwritten on their normal schedule.
        </p>
      </Section>

      <Section title="Remove only a social network connection">
        <p>
          To stop Questreak accessing a single account, open <strong className="text-foreground">Accounts</strong> and choose Disconnect on that
          account. You can also remove Questreak from the connected apps or security settings of the network itself (for example Facebook&apos;s
          &ldquo;Apps and websites&rdquo;, TikTok&apos;s app permissions, or Google&apos;s account permissions).
        </p>
      </Section>

      <Section title="Can&apos;t sign in?">
        <p>
          Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from the address on your account with the subject
          &ldquo;Delete my data&rdquo;, and we will confirm and complete the deletion.
        </p>
      </Section>
    </LegalPage>
  );
}
