import "server-only";
import { processDuePosts, refreshExpiringAccounts } from "./engine";

/**
 * In-process scheduler for self-hosted deployments (a long-running Node server or Docker).
 * On serverless hosts use the cron routes instead (see vercel.json). Both are safe to run at
 * once: posts are claimed atomically, so nothing is ever published twice.
 */

type Handle = { timer: NodeJS.Timeout; busy: boolean; lastRefresh: number };
const key = "__questreakScheduler";
const g = globalThis as unknown as Record<string, Handle | undefined>;

export function startScheduler() {
  if (g[key]) return; // survives dev hot reloads
  const state: Handle = { timer: undefined as unknown as NodeJS.Timeout, busy: false, lastRefresh: 0 };

  const tick = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      const res = await processDuePosts();
      if (res.due || res.recovered) console.log("[scheduler] due posts:", res);
      if (Date.now() - state.lastRefresh > 6 * 60 * 60 * 1000) {
        state.lastRefresh = Date.now();
        const r = await refreshExpiringAccounts();
        if (r.checked) console.log("[scheduler] token refresh:", r);
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    } finally {
      state.busy = false;
    }
  };

  state.timer = setInterval(tick, 60_000);
  state.timer.unref?.();
  g[key] = state;
  console.log("[scheduler] started (checks every minute)");
  void tick();
}
