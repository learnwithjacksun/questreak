import { PLATFORM_LIST } from "@/lib/platforms";

export const platforms = PLATFORM_LIST.map((p) => ({
  key: p.key,
  name: p.key === "x" ? "X/Twitter" : p.name,
  live: p.priority,
}));
