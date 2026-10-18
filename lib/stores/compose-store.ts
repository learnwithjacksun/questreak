import { create } from "zustand";
import type { PostOptions } from "@/models/post";

export type ComposeMedia = { id: string; url: string; resourceType: "image" | "video" };

type ComposeState = {
  postId: string | null;
  text: string;
  accountIds: string[];
  media: ComposeMedia[];
  /** `datetime-local` value in the viewer's timezone, or "". */
  scheduledFor: string;
  /** Per-network settings (YouTube title, TikTok privacy...). */
  options: PostOptions;
  /** Text before the last AI replacement, for undo. */
  previousText: string | null;

  init: (initial: {
    postId?: string | null;
    text?: string;
    accountIds?: string[];
    media?: ComposeMedia[];
    scheduledFor?: string;
    options?: PostOptions;
  }) => void;
  setText: (text: string) => void;
  applyAi: (text: string) => void;
  undoAi: () => void;
  toggleAccount: (id: string) => void;
  setMedia: (media: ComposeMedia[]) => void;
  removeMedia: (id: string) => void;
  setScheduledFor: (value: string) => void;
  patchOptions: (patch: (current: PostOptions) => PostOptions) => void;
};

export const useComposeStore = create<ComposeState>((set, get) => ({
  postId: null,
  text: "",
  accountIds: [],
  media: [],
  scheduledFor: "",
  options: {},
  previousText: null,

  init: (initial) =>
    set({
      postId: initial.postId ?? null,
      text: initial.text ?? "",
      accountIds: initial.accountIds ?? [],
      media: initial.media ?? [],
      scheduledFor: initial.scheduledFor ?? "",
      options: initial.options ?? {},
      previousText: null,
    }),
  setText: (text) => set({ text }),
  applyAi: (text) => set({ previousText: get().text, text }),
  undoAi: () => {
    const prev = get().previousText;
    if (prev !== null) set({ text: prev, previousText: null });
  },
  toggleAccount: (id) =>
    set((s) => ({
      accountIds: s.accountIds.includes(id)
        ? s.accountIds.filter((a) => a !== id)
        : [...s.accountIds, id],
    })),
  setMedia: (media) => set({ media }),
  removeMedia: (id) => set((s) => ({ media: s.media.filter((m) => m.id !== id) })),
  setScheduledFor: (scheduledFor) => set({ scheduledFor }),
  patchOptions: (patch) => set((s) => ({ options: patch(s.options) })),
}));
