import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy – Questreak",
  description: "What Questreak collects, how it's used, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Questreak lets you write a post once and publish it to the social networks you connect. This page explains what information we handle to do that, and the choices you have."
    >
      <Section title="What we collect">
        <ul>
          <li>
            <strong className="text-foreground">Account details:</strong> your name or nickname, email address, and a hashed password (or
            your Google account identifier if you sign in with Google).
          </li>
          <li>
            <strong className="text-foreground">Connected social accounts:</strong> the profile name, handle and picture of each account you
            connect, and the access tokens the network gives us so we can publish on your behalf. Tokens are encrypted at rest. For Bluesky we store
            the app password you create, encrypted.
          </li>
          <li>
            <strong className="text-foreground">Your content:</strong> the posts, drafts, schedules and media you create in Questreak, and the
            result of each publish (for example the link to the published post, or an error message).
          </li>
          <li>
            <strong className="text-foreground">Orders:</strong> if you use boost services or buy accounts, the details of the order. Delivered
            login details are stored encrypted and are wiped when you delete your account.
          </li>
          <li>
            <strong className="text-foreground">Technical data:</strong> basic logs (such as errors and request times) used to keep the service
            running and secure.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To publish, schedule and track the posts you ask us to send, and only to the accounts you select.</li>
          <li>To keep your connections working, for example by renewing expiring access tokens.</li>
          <li>To send service emails: verification codes, password resets, and notices you have not turned off.</li>
          <li>To protect the service against abuse and fix problems.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use your content to train advertising or AI models.</p>
      </Section>

      <Section title="Information from social networks">
        <p>
          We only request the permissions needed to publish and to show the account you connected, such as creating posts, uploading media, and
          reading your basic profile. We use that information solely to provide the features you see in Questreak. You can disconnect any account
          at any time on the Accounts page, and you can also revoke Questreak&apos;s access from that network&apos;s own settings.
        </p>
        <p>
          Questreak&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Our use of data from Meta, TikTok, X, LinkedIn, Pinterest, Bluesky and Mastodon follows each
          network&apos;s platform terms.
        </p>
      </Section>

      <Section title="Service providers">
        <p>We rely on a small number of providers to run Questreak. They process data only to provide their service to us:</p>
        <ul>
          <li>Database hosting (MongoDB Atlas) for your account and posts.</li>
          <li>Media storage and delivery (Cloudinary) for images and videos you upload.</li>
          <li>Transactional email (Brevo) for verification and notification emails.</li>
          <li>
            AI writing assistance (Google Gemini). Text is sent to the model only when you choose to use the AI assistant, and only the text you
            ask it to work on.
          </li>
          <li>Suppliers fulfilling boost services or account purchases you order, which receive the details needed for that order.</li>
        </ul>
      </Section>

      <Section title="Retention and deletion">
        <p>
          We keep your information while your account is open. You can delete your account in Settings, which removes your profile, posts, media
          and connected accounts and wipes any stored delivered login details. See{" "}
          <a href="/data-deletion">how to delete your data</a>. Order records may be kept in a form that does not include delivered credentials,
          where needed for bookkeeping or legal reasons.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are hashed, access tokens and delivered credentials are encrypted, and connections use HTTPS. No system is perfectly secure,
          so please use a strong, unique password.
        </p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Access or correct your details in Settings.</li>
          <li>Turn email notifications on or off in Settings.</li>
          <li>Disconnect any social account, or delete your Questreak account, at any time.</li>
        </ul>
        <p>
          Depending on where you live you may have additional rights, such as asking for a copy of your data. Contact us and we will help.
        </p>
      </Section>

      <Section title="Children">
        <p>Questreak is not intended for people under 16, and we do not knowingly collect their information.</p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy and will change the date above when we do. Questions or requests:{" "}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
