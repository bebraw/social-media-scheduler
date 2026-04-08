const BASE_APP_ROUTES = [
  { path: "/", purpose: "Protected queue view for authenticated users" },
  { path: "/compose", purpose: "Protected post composer for authenticated users" },
  { path: "/compose/queue", purpose: "Protected queued-post creation endpoint" },
  { path: "/history", purpose: "Protected sent-post history for authenticated users" },
  { path: "/queue/delete", purpose: "Protected queued-post deletion endpoint" },
  { path: "/settings", purpose: "Protected channel settings view for authenticated users" },
  { path: "/settings/channels", purpose: "Protected per-connection channel setup endpoint" },
  { path: "/posting-schedule", purpose: "Protected per-channel posting schedule update endpoint" },
  { path: "/login", purpose: "Sign in with a D1-backed local account" },
  { path: "/api/health", purpose: "JSON health endpoint for tooling and smoke tests" },
] as const;

export function listAppRoutes(): Array<{ path: string; purpose: string }> {
  return [...BASE_APP_ROUTES];
}
