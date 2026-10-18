import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl border border-border bg-white/5">
        <HugeiconsIcon icon={icon} size={22} />
      </span>
      <h3 className="mt-5 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  delta?: { value: number; label?: string } | null;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg border border-border bg-white/5">
          <HugeiconsIcon icon={icon} size={17} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
        {delta && (
          <span
            className={cn(
              "font-medium tabular-nums",
              delta.value > 0 && "text-emerald-400",
              delta.value < 0 && "text-red-400",
            )}
          >
            {delta.value > 0 ? "+" : ""}
            {delta.value}
            {delta.label ?? ""}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

const tones = {
  neutral: "bg-white/5 text-muted border-border",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/5", className)} />;
}

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-white/10 font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

export function PlatformIcon({
  platform,
  size = 18,
  className,
}: {
  platform: PlatformKey;
  size?: number;
  className?: string;
}) {
  const p = PLATFORMS[platform];
  const box = size + 12;

  if (!p.logo) {
    // Networks without a logo file are drawn as a branded tile.
    return (
      <span
        title={p.name}
        className={cn("grid shrink-0 place-items-center rounded-lg", className)}
        style={{ width: box, height: box, backgroundColor: p.tile?.bg ?? "#52525b" }}
      >
        {p.tile && <HugeiconsIcon icon={p.tile.icon} size={size * 0.75} color="white" />}
      </span>
    );
  }

  return (
    <span
      title={p.name}
      className={cn("grid shrink-0 place-items-center", className)}
      style={{ width: box, height: box }}
    >
      <Image
        src={p.logo}
        alt={`${p.name} logo`}
        width={box}
        height={box}
        unoptimized={p.logo.endsWith(".svg")}
        className={cn(
          "size-full",
          p.shape === "square" && "rounded-lg",
          p.shape === "circle" && "rounded-full",
        )}
      />
    </span>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("card", className)}>{children}</div>;
}
