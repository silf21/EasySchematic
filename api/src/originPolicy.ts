const STATIC_ALLOWED_ORIGINS = [
  "https://easyschematic.live",
  "https://www.easyschematic.live",
  "https://beta.easyschematic.live",
  "https://devices.easyschematic.live",
  "https://easyschematic.silvanfrei.synology.me",
];

// Any loopback origin, on any port. Self-hosters run the Docker image on arbitrary
// ports (prod image defaults to 8080, dev to 5173) and need to read the public
// community library — a fixed port allowlist silently broke that and fell the app
// back to the bundled device subset. Loopback is the user's own machine, so echoing
// it back (even with credentials, for login/cloud) is safe.
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** CORS origin resolver: echoes an origin back iff it's an official host or loopback. */
export function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return origin;
  if (LOOPBACK_ORIGIN.test(origin)) return origin;
  return null;
}

export function isAllowedOrigin(url: string): boolean {
  try { return corsOrigin(new URL(url).origin) !== null; }
  catch { return false; }
}

