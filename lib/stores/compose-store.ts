import { create } from "zustand";

export type ComposeMedia = { id: string; url: string; resourceType: "image" | "video" };

type ComposeState = {
  postId: string | null;
  text: string;
  accountIds: string[];
  media: ComposeMedia[];
  /** `datetime-local` value in the viewer's timezone, or "". */
  scheduledFor: string;
  /** Text before the last AI replacement, for undo. */
  previousText: string | null;

  init: (initial: {
    postId?: string | null;
    text?: string;
    accountIds?: string[];
    media?: ComposeMedia[];
    scheduledFor?: string;
  }) => void;
  setText: (text: string) => void;
  applyAi: (text: string) => void;
  undoAi: () => void;
  toggleAccount: (id: string) => void;
  setMedia: (media: ComposeMedia[]) => void;
  removeMedia: (id: string) => void;
  setScheduledFor: (value: string) => void;
};

export const useComposeStore = create<ComposeState>((set, get) => ({
  postId: null,
  text: "",
  accountIds: [],
  media: [],
  scheduledFor: "",
  previousText: null,

  init: (initial) =>
    set({
      postId: initial.postId ?? null,
      text: initial.text ?? "",
      accountIds: initial.accountIds ?? [],
      media: initial.media ?? [],
      scheduledFor: initial.scheduledFor ?? "",
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
}));
