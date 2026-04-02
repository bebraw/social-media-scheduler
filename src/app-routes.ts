const BASE_APP_ROUTES = [
  { path: "/", purpose: "Protected queue view for authenticated users" },
  { path: "/compose", purpose: "Protected post composer for authenticated users" },
  { path: "/history", purpose: "Protected sent-post history for authenticated users" },
  { path: "/posting-schedule", purpose: "Protected per-channel posting schedule update endpoint" },
  { path: "/login", purpose: "Sign in with a D1-backed local account" },
  { path: "/api/health", purpose: "JSON health endpoint for tooling and smoke tests" },
] as const;

const DEMO_ROUTE = { path: "/demo", purpose: "Development-only demo workspace for local scheduling experiments" } as const;

export function listAppRoutes(options: { includeDemo?: boolean } = {}): Array<{ path: string; purpose: string }> {
  return options.includeDemo ? [...BASE_APP_ROUTES, DEMO_ROUTE] : [...BASE_APP_ROUTES];
}
