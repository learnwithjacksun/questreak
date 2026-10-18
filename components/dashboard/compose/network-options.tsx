"use client";

import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { getPinterestBoards, getTikTokCreatorInfo } from "@/app/actions/connections";
import { Field } from "@/components/auth/form-parts";
import { Avatar, PlatformIcon, Skeleton } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AccountDTO } from "@/lib/data/types";
import { toTitle } from "@/lib/publishing/text";
import { useComposeStore } from "@/lib/stores/compose-store";
import type { PostOptions } from "@/models/post";

type TikTokSettings = NonNullable<PostOptions["tiktok"]>[string];

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

/** Per-network settings that only appear when a selected account needs them. */
export function NetworkOptions({
  accounts,
  text,
  hasVideo,
  tiktokAudited,
}: {
  accounts: AccountDTO[];
  text: string;
  hasVideo: boolean;
  tiktokAudited: boolean;
}) {
  const youtube = accounts.filter((a) => a.platform === "youtube");
  const pinterest = accounts.filter((a) => a.platform === "pinterest");
  const tiktok = accounts.filter((a) => a.platform === "tiktok");
  if (!youtube.length && !pinterest.length && !tiktok.length) return null;

  return (
    <section className="card divide-y divide-border">
      {youtube.length > 0 && <YouTubeOptions text={text} />}
      {pinterest.length > 0 && <PinterestOptions accounts={pinterest} text={text} />}
      {tiktok.map((a) => (
        <TikTokOptions key={a.id} account={a} hasVideo={hasVideo} audited={tiktokAudited} />
      ))}
    </section>
  );
}

function Heading({ platform, children }: { platform: AccountDTO["platform"]; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <PlatformIcon platform={platform} size={14} />
      <h3 className="text-sm font-medium">{children}</h3>
    </div>
  );
}

function YouTubeOptions({ text }: { text: string }) {
  const { options, patchOptions } = useComposeStore();
  const yt = options.youtube ?? {};
  const patch = (p: NonNullable<PostOptions["youtube"]>) => patchOptions((o) => ({ ...o, youtube: { ...o.youtube, ...p } }));

  return (
    <div className="p-5">
      <Heading platform="youtube">YouTube video</Heading>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field
          label="Title"
          maxLength={100}
          placeholder={toTitle(text, 100) || "Defaults to the first line of your post"}
          value={yt.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <Select
          label="Visibility"
          value={yt.privacy ?? "public"}
          onChange={(privacy) => patch({ privacy })}
          options={[
            { value: "public", label: "Public" },
            { value: "unlisted", label: "Unlisted" },
            { value: "private", label: "Private" },
          ]}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        The rest of your post becomes the video description. New YouTube API projects keep uploads private until they pass
        YouTube&apos;s audit.
      </p>
    </div>
  );
}

function PinterestOptions({ accounts, text }: { accounts: AccountDTO[]; text: string }) {
  const { options, patchOptions } = useComposeStore();
  const pin = options.pinterest ?? {};
  const patch = (p: NonNullable<PostOptions["pinterest"]>) => patchOptions((o) => ({ ...o, pinterest: { ...o.pinterest, ...p } }));
  const single = accounts.length === 1 ? accounts[0] : null;

  const boards = useQuery({
    queryKey: ["pinterest-boards", single?.id],
    queryFn: () => getPinterestBoards(single!.id),
    enabled: !!single,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="p-5">
      <Heading platform="pinterest">Pinterest pin</Heading>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          maxLength={100}
          placeholder={toTitle(text, 100) || "Defaults to the first line of your post"}
          value={pin.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <Field
          label="Destination link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={pin.link ?? ""}
          onChange={(e) => patch({ link: e.target.value })}
        />
        {single ? (
          boards.isLoading ? (
            <Skeleton className="h-11 self-end" />
          ) : boards.data?.ok && boards.data.boards.length ? (
            <Select
              label="Board"
              value={pin.boardId ?? boards.data.selected ?? boards.data.boards[0].id}
              options={boards.data.boards.map((b) => ({ value: b.id, label: b.name }))}
              onChange={(boardId) => patch({ boardId })}
            />
          ) : (
            <p className="self-end text-xs text-amber-400">
              {boards.data && !boards.data.ok ? boards.data.error : "No boards found. Create one on Pinterest first."}
            </p>
          )
        ) : (
          <p className="self-end text-xs text-muted">Each selected account posts to its default board.</p>
        )}
      </div>
    </div>
  );
}

function TikTokOptions({ account, hasVideo, audited }: { account: AccountDTO; hasVideo: boolean; audited: boolean }) {
  const { options, patchOptions } = useComposeStore();
  const t: TikTokSettings = options.tiktok?.[account.id] ?? {};
  const patch = (p: TikTokSettings) =>
    patchOptions((o) => ({ ...o, tiktok: { ...o.tiktok, [account.id]: { ...o.tiktok?.[account.id], ...p } } }));

  // TikTok requires the creator's current settings every time this form is shown.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tiktok-creator", account.id],
    queryFn: () => getTikTokCreatorInfo(account.id),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const branded = !!t.commercial && !!t.brandedContent;
  const consent = branded
    ? { links: [["Branded Content Policy", "https://www.tiktok.com/legal/page/global/bc-policy/en"], ["Music Usage Confirmation", "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"]] as const }
    : { links: [["Music Usage Confirmation", "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"]] as const };

  return (
    <div className="p-5">
      <Heading platform="tiktok">TikTok post</Heading>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
        </div>
      ) : !data?.ok ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="text-amber-400">{data?.error ?? "Couldn't load this TikTok account."}</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-xs underline">
            Try again
          </button>
        </div>
      ) : (
        (() => {
          const info = data.info;
          const options = info.privacy_level_options.map((value) => ({
            value,
            label: PRIVACY_LABELS[value] ?? value,
            // Unreviewed apps can only post privately, and branded content can never be private.
            disabled: (!audited && value !== "SELF_ONLY") || (branded && value === "SELF_ONLY"),
            description:
              !audited && value !== "SELF_ONLY"
                ? "Available after TikTok approves the app"
                : branded && value === "SELF_ONLY"
                  ? "Branded content can't be private"
                  : undefined,
          }));
          return (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-3">
                <Avatar name={info.creator_nickname} src={info.creator_avatar_url ?? account.avatar} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{info.creator_nickname}</p>
                  <p className="text-xs text-muted">Posting to this TikTok account</p>
                </div>
              </div>

              {!audited && (
                <p className="flex items-start gap-2 text-xs leading-5 text-muted">
                  <HugeiconsIcon icon={InformationCircleIcon} size={15} className="mt-0.5 shrink-0" />
                  Until TikTok approves this app, posts are limited to &ldquo;Only me&rdquo; and the TikTok account must be private.
                </p>
              )}

              <Select
                label="Who can view this video"
                placeholder="Select visibility"
                value={t.privacy ?? null}
                options={options}
                onChange={(privacy) => patch({ privacy })}
              />

              <div>
                <p className="mb-2 text-sm font-medium">Allow users to</p>
                <ul className="space-y-2.5">
                  {[
                    { key: "comment" as const, label: "Comment", off: info.comment_disabled, show: true },
                    { key: "duet" as const, label: "Duet", off: info.duet_disabled, show: hasVideo },
                    { key: "stitch" as const, label: "Stitch", off: info.stitch_disabled, show: hasVideo },
                  ]
                    .filter((i) => i.show)
                    .map((i) => (
                      <li key={i.key} className="flex items-center justify-between gap-4">
                        <span className={i.off ? "text-sm text-muted" : "text-sm"}>
                          {i.label}
                          {i.off && <span className="ml-2 text-xs">Turned off in your TikTok settings</span>}
                        </span>
                        <Switch label={i.label} checked={!i.off && !!t[i.key]} disabled={i.off} onChange={(v) => patch({ [i.key]: v })} />
                      </li>
                    ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Disclose commercial content</p>
                    <p className="text-xs text-muted">Turn on if this post promotes a brand, product or service.</p>
                  </div>
                  <Switch
                    label="Disclose commercial content"
                    checked={!!t.commercial}
                    onChange={(commercial) =>
                      patch({ commercial, ...(commercial ? {} : { yourBrand: false, brandedContent: false }) })
                    }
                  />
                </div>
                {t.commercial && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-border bg-background/60 p-3.5">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={!!t.yourBrand}
                        onChange={(e) => patch({ yourBrand: e.target.checked })}
                        className="mt-0.5 size-4 accent-white"
                      />
                      <span>
                        Your brand <span className="block text-xs text-muted">You&apos;re promoting yourself or your own business.</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={!!t.brandedContent}
                        onChange={(e) => {
                          patch({ brandedContent: e.target.checked });
                          // Branded content can't be private, so drop a private choice.
                          if (e.target.checked && t.privacy === "SELF_ONLY") patch({ brandedContent: true, privacy: undefined });
                        }}
                        className="mt-0.5 size-4 accent-white"
                      />
                      <span>
                        Branded content <span className="block text-xs text-muted">You&apos;re promoting another brand or a third party.</span>
                      </span>
                    </label>
                    {!t.yourBrand && !t.brandedContent ? (
                      <p className="text-xs text-amber-400">
                        Select at least one option to continue: it must say if you promote yourself, a third party, or both.
                      </p>
                    ) : (
                      <p className="text-xs text-muted">
                        {t.brandedContent ? "Your video will be labelled “Paid partnership”." : "Your video will be labelled “Promotional content”."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs leading-5 text-muted">
                By posting, you agree to TikTok&apos;s{" "}
                {consent.links.map(([label, href], i) => (
                  <span key={href}>
                    {i > 0 && " and "}
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                      {label}
                    </a>
                  </span>
                ))}
                . Processing can take a few minutes before the post appears on your profile.
              </p>
            </div>
          );
        })()
      )}
    </div>
  );
}
