"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Logout01Icon,
  Settings02Icon,
  CreditCardIcon,
} from "@hugeicons/core-free-icons";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/landing/navbar";
import { MenuButton } from "@/components/ui/menu-button";
import { MobileMenu } from "@/components/ui/mobile-menu";
import { Popover, menuItemClass } from "@/components/ui/popover";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { NAV, USER_MENU, isActive } from "./nav-config";

export type HeaderUser = { name: string; email: string; avatar?: string | null };

const chevron = (open: boolean) => (
  <HugeiconsIcon
    icon={ArrowDown01Icon}
    size={14}
    className={cn("transition-transform", open && "rotate-180")}
  />
);

export function DashboardHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  // The menu is open only for the pathname it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenAt(fn(open) ? pathname : null);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-colors",
          open
            ? "border-transparent bg-background"
            : "border-border bg-background/70 backdrop-blur-xl",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Logo href="/dashboard" />

          <nav aria-label="Main" className="ml-10 hidden items-center gap-1 lg:flex">
            {NAV.map((entry) => {
              const active = entry.items
                ? entry.items.some((i) => isActive(pathname, i.href))
                : isActive(pathname, entry.href);
              const linkClass = cn(
                "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "text-foreground" : "text-muted hover:text-foreground",
              );
              const indicator = active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute inset-x-3 -bottom-[17px] h-0.5 rounded-full bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              );

              if (!entry.items) {
                return (
                  <Link key={entry.href} href={entry.href} className={linkClass}>
                    {entry.label}
                    {indicator}
                  </Link>
                );
              }
              return (
                <Popover
                  key={entry.label}
                  openOnHover
                  panelClassName="w-72"
                  trigger={(props, isOpen) => (
                    <button type="button" className={linkClass} {...props}>
                      {entry.label}
                      {chevron(isOpen)}
                      {indicator}
                    </button>
                  )}
                >
                  {(close) =>
                    entry.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={close}
                        className={cn(menuItemClass, "flex-col items-start gap-0.5")}
                      >
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted">{item.description}</span>
                        )}
                      </Link>
                    ))
                  }
                </Popover>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Popover
              align="right"
              className="hidden lg:block"
              panelClassName="w-64"
              trigger={(props, isOpen) => (
                <button
                  type="button"
                  className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-white/5"
                  {...props}
                >
                  <Avatar name={user.name} src={user.avatar} size={30} />
                  <span className="max-w-28 truncate text-sm font-medium">{user.name}</span>
                  {chevron(isOpen)}
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="border-b border-border px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <div className="py-1.5">
                    {USER_MENU.map((item, i) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={close}
                        className={menuItemClass}
                      >
                        <HugeiconsIcon
                          icon={i === 0 ? Settings02Icon : CreditCardIcon}
                          size={17}
                          className="text-muted"
                        />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <form action={signOut} className="border-t border-border pt-1.5">
                    <button type="submit" role="menuitem" className={menuItemClass}>
                      <HugeiconsIcon icon={Logout01Icon} size={17} className="text-muted" />
                      Sign out
                    </button>
                  </form>
                </>
              )}
            </Popover>
            <MenuButton
              open={open}
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden"
            />
          </div>
        </div>
      </header>

      <MobileMenu open={open} className="lg:hidden">
        <nav aria-label="Mobile" className="flex-1">
          <ul className="flex flex-col gap-1">
            {NAV.map((entry, i) => (
              <motion.li
                key={entry.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.04 }}
              >
                {entry.items ? (
                  <div className="py-2">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
                      <HugeiconsIcon icon={entry.icon} size={15} />
                      {entry.label}
                    </p>
                    <ul className="mt-1">
                      {entry.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "block py-2 text-2xl font-semibold tracking-tight",
                              isActive(pathname, item.href) ? "text-foreground" : "text-foreground/80",
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <Link
                    href={entry.href}
                    className="block py-2.5 text-3xl font-semibold tracking-tight"
                  >
                    {entry.label}
                  </Link>
                )}
              </motion.li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} src={user.avatar} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {USER_MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-border px-4 py-3 text-center text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-[#1a1a24]"
            >
              Sign out
            </button>
          </form>
        </div>
      </MobileMenu>
    </>
  );
}
