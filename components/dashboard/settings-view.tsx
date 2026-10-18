"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { changePassword, deleteAccount, updateNotificationPrefs, updateProfile } from "@/app/actions/settings";
import { Field, PasswordField } from "@/components/auth/form-parts";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { changePasswordSchema, profileSchema, type ChangePasswordInput } from "@/lib/validators/dashboard";
import { getUploadSignature, uploadFile } from "@/lib/upload";
import { LocalTime } from "./local-time";

type Tab = "profile" | "security" | "notifications" | "danger";
type Prefs = { productUpdates: boolean; publishAlerts: boolean; orderUpdates: boolean };

export type SettingsUser = {
  name: string;
  email: string;
  avatar: string | null;
  hasPassword: boolean;
  createdAt: string;
  notificationPrefs: Prefs;
};

export function SettingsView({ user }: { user: SettingsUser }) {
  const [tab, setTab] = useState<Tab>("profile");
  return (
    <div className="mx-auto max-w-2xl">
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: "profile", label: "Profile" },
          { value: "security", label: "Security" },
          { value: "notifications", label: "Notifications" },
          { value: "danger", label: "Danger zone" },
        ]}
      />
      {tab === "profile" && <ProfileTab user={user} />}
      {tab === "security" && <SecurityTab hasPassword={user.hasPassword} />}
      {tab === "notifications" && <NotificationsTab initial={user.notificationPrefs} />}
      {tab === "danger" && <DangerTab hasPassword={user.hasPassword} />}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileTab({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<{ name: string }>({
    resolver: zodResolver(profileSchema.pick({ name: true })),
    defaultValues: { name: user.name },
  });
  const name = useWatch({ control, name: "name" });

  async function pickAvatar(f: File) {
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) {
      toast.error("Choose an image under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const sign = await getUploadSignature();
      const r = await uploadFile(f, sign, () => undefined);
      setAvatar(String(r.secure_url));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(values: { name: string }) {
    startTransition(async () => {
      const res = await updateProfile({ name: values.name, avatar });
      if (res.ok) {
        toast.success("Profile updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Section title="Profile" description="How you appear across Questreak.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.name} src={avatar} size={64} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" loading={uploading} onClick={() => file.current?.click()}>
              Change photo
            </Button>
            {avatar && (
              <Button variant="ghost" size="sm" type="button" onClick={() => setAvatar("")}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload profile photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <Field label="First name or nickname" autoComplete="given-name" error={errors.name?.message} {...register("name")} />
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <input
            value={user.email}
            readOnly
            className="h-12 w-full cursor-not-allowed rounded-xl border border-border bg-white/[0.03] px-4 text-base text-muted outline-none"
          />
          <p className="mt-1.5 text-xs text-muted">
            Member since <LocalTime iso={user.createdAt} variant="date" />
          </p>
        </div>
        <Button type="submit" loading={pending} disabled={!isDirty && avatar === (user.avatar ?? "")}>
          Save changes
        </Button>
      </form>
    </Section>
  );
}

function SecurityTab({ hasPassword }: { hasPassword: boolean }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const res = await changePassword(values);
      if (res.ok) {
        toast.success(hasPassword ? "Password changed" : "Password set");
        reset();
        return;
      }
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(field as keyof ChangePasswordInput, { message });
      }
      toast.error(res.error);
    });
  }

  return (
    <Section
      title={hasPassword ? "Change password" : "Set a password"}
      description={
        hasPassword
          ? "Use at least 8 characters with a letter and a number."
          : "You signed in with Google. Add a password to also sign in with your email."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {hasPassword && (
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register("currentPassword")}
          />
        )}
        <PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" loading={pending}>
          {hasPassword ? "Update password" : "Set password"}
        </Button>
      </form>
    </Section>
  );
}

const prefRows: { key: keyof Prefs; title: string; text: string }[] = [
  { key: "publishAlerts", title: "Publishing alerts", text: "Know when a scheduled post goes out or fails." },
  { key: "orderUpdates", title: "Order updates", text: "Status changes for boost orders and account purchases." },
  { key: "productUpdates", title: "Product news", text: "New features and occasional tips." },
];

function NotificationsTab({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [, startTransition] = useTransition();

  function toggle(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startTransition(async () => {
      const res = await updateNotificationPrefs(next);
      if (!res.ok) {
        setPrefs(previous);
        toast.error(res.error);
      }
    });
  }

  return (
    <Section title="Email notifications" description="Choose what we email you about. Changes save automatically.">
      <ul className="divide-y divide-border">
        {prefRows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="mt-0.5 text-sm text-muted">{r.text}</p>
            </div>
            <Switch checked={prefs[r.key]} label={r.title} onChange={(v) => toggle(r.key, v)} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DangerTab({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      // On success the action redirects to the landing page.
      const res = await deleteAccount({ confirm, password });
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-6">
        <h2 className="font-semibold text-red-400">Delete account</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Permanently removes your profile, posts, media and connected accounts. Delivered login details from past
          purchases are wiped too. This can&apos;t be undone.
        </p>
        <Button className="mt-5" variant="danger" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?" description="This is permanent.">
        <div className="space-y-4">
          <div>
            <label htmlFor="confirm" className="mb-2 block text-sm font-medium">
              Type <span className="font-mono">DELETE</span> to confirm
            </label>
            <input
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-border bg-background/60 px-4 text-base outline-none focus:border-white/40"
            />
          </div>
          {hasPassword && (
            <PasswordField label="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} disabled={confirm !== "DELETE" || (hasPassword && !password)} onClick={submit}>
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
