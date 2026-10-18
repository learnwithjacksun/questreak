/** Starts the in-process scheduler on self-hosted servers when ENABLE_IN_PROCESS_SCHEDULER=true. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_IN_PROCESS_SCHEDULER !== "true") return;
  const { startScheduler } = await import("./lib/publishing/scheduler");
  startScheduler();
}
