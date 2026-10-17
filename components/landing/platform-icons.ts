import {
  Facebook01Icon,
  InstagramIcon,
  Linkedin01Icon,
  NewTwitterIcon,
  PinterestIcon,
  ThreadsIcon,
  TiktokIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";

export const platforms = [
  { name: "Facebook", icon: Facebook01Icon, color: "#1877f2", live: true },
  { name: "X", icon: NewTwitterIcon, color: "#e7e7ea", live: true },
  { name: "Instagram", icon: InstagramIcon, color: "#e4405f", live: true },
  { name: "LinkedIn", icon: Linkedin01Icon, color: "#0a66c2", live: true },
  { name: "Threads", icon: ThreadsIcon, color: "#f4f4f8", live: false },
  { name: "TikTok", icon: TiktokIcon, color: "#25f4ee", live: false },
  { name: "YouTube", icon: YoutubeIcon, color: "#ff0033", live: false },
  { name: "Pinterest", icon: PinterestIcon, color: "#e60023", live: false },
] as const;
