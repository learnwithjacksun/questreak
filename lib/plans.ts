export type PlanKey = "free" | "pro" | "team";

export const PLANS: Record<
  PlanKey,
  { name: string; price: number; accounts: number | null; scheduled: number | null; blurb: string; features: string[] }
> = {
  free: {
    name: "Free",
    price: 0,
    accounts: 3,
    scheduled: 10,
    blurb: "For trying things out.",
    features: ["3 social accounts", "10 scheduled posts / month", "Basic post tracking"],
  },
  pro: {
    name: "Pro",
    price: 12,
    accounts: 10,
    scheduled: null,
    blurb: "For creators and freelancers.",
    features: ["10 social accounts", "Unlimited scheduled posts", "Per-platform adaptation", "Analytics"],
  },
  team: {
    name: "Team",
    price: 39,
    accounts: null,
    scheduled: null,
    blurb: "For brands and agencies.",
    features: ["Unlimited accounts", "Team members & roles", "Approval workflows", "Priority support"],
  },
};
