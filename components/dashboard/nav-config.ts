import { PencilEdit02Icon, Rocket01Icon } from "@hugeicons/core-free-icons";

export type NavLeaf = { label: string; href: string; description?: string };
export type NavLink = NavLeaf & { items?: undefined };
/** `icon` is used for the group title in the mobile menu only. */
export type NavGroup = {
  label: string;
  icon: typeof PencilEdit02Icon;
  items: NavLeaf[];
  href?: undefined;
};
export type NavEntry = NavLink | NavGroup;

export const NAV: NavEntry[] = [
  { label: "Overview", href: "/dashboard" },
  {
    label: "Publish",
    icon: PencilEdit02Icon,
    items: [
      { label: "Compose", href: "/dashboard/compose", description: "Write and schedule a new post" },
      { label: "Posts", href: "/dashboard/posts", description: "Published, scheduled and drafts" },
      { label: "Calendar", href: "/dashboard/calendar", description: "Your content at a glance" },
    ],
  },
  { label: "Accounts", href: "/dashboard/accounts" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Media", href: "/dashboard/media" },
  {
    label: "Growth",
    icon: Rocket01Icon,
    items: [
      { label: "Boost services", href: "/dashboard/growth/boost", description: "Followers, likes, views and more" },
      { label: "Buy accounts", href: "/dashboard/growth/accounts", description: "Ready-made social accounts" },
      { label: "My orders", href: "/dashboard/growth/orders", description: "Track boosts and purchases" },
    ],
  },
];

export const USER_MENU: NavLeaf[] = [
  { label: "Profile & settings", href: "/dashboard/settings" },
  { label: "Billing", href: "/dashboard/billing" },
];

export function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
