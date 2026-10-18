/** Full-page navigation, used for OAuth redirects (API routes must not be client-routed). */
export function hardNavigate(path: string) {
  window.location.assign(new URL(path, window.location.origin).href);
}
