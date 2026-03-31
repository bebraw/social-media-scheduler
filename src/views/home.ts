import { escapeHtml } from "./shared";

const appTitle = "Social Media Scheduler";
const appDescription =
  "A private Cloudflare Worker foundation for scheduling posts across personal project channels one adapter at a time.";

interface HomePageOptions {
  backupConfigured: boolean;
  routes: Array<{ path: string; purpose: string }>;
  user: {
    name: string;
    role: string;
  };
}

export function renderHomePage({ backupConfigured, routes, user }: HomePageOptions): string {
  const routeList = routes
    .map(
      (route) =>
        `<li class="flex items-baseline gap-3 rounded-2xl border border-app-line/70 bg-white/70 px-4 py-3 shadow-[0_12px_30px_-26px_rgba(30,26,22,0.35)]">
          <code class="rounded-full bg-app-accent/10 px-3 py-1 text-sm font-semibold text-app-accent-strong">${escapeHtml(route.path)}</code>
          <span>${escapeHtml(route.purpose)}</span>
        </li>`,
    )
    .join("");
  const backupStatus = backupConfigured
    ? "R2 backup binding detected. Scheduled backups can write manifests and exports."
    : "R2 backup binding is not configured yet. Auth works locally without it, but scheduled backups will skip.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(appTitle)}</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="mx-auto w-[min(56rem,calc(100vw-2rem))] px-0 py-16">
      <article class="overflow-hidden rounded-[1.5rem] border border-app-line/80 bg-app-surface/95 shadow-panel backdrop-blur">
        <section class="border-b border-app-line/80 px-5 py-10 sm:px-8">
          <p class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-app-accent">Application Foundation</p>
          <h1 class="max-w-[12ch] text-5xl leading-none font-semibold tracking-[-0.04em] sm:text-7xl">${escapeHtml(appTitle)}</h1>
          <p class="mt-4 max-w-2xl text-lg leading-8 text-app-text-soft">${escapeHtml(appDescription)}</p>
          <p class="mt-6 inline-flex rounded-full border border-app-line/80 bg-white/80 px-4 py-2 text-sm font-medium text-app-text-soft">
            Signed in as ${escapeHtml(user.name)} (${escapeHtml(user.role)})
          </p>
        </section>
        <div class="grid gap-6 px-5 py-8 sm:px-8 sm:py-10">
          <section class="rounded-[1rem] border border-app-line/70 bg-white/72 p-6 shadow-[0_16px_40px_-30px_rgba(30,26,22,0.3)]">
            <h2 class="mb-3 text-lg font-semibold tracking-[-0.02em]">What is ready now</h2>
            <p class="leading-7 text-app-text-soft">D1-backed local accounts, signed session cookies, login rate limiting, and an automated backup path that can write scheduler exports to R2 on a cron trigger.</p>
          </section>
          <section class="rounded-[1rem] border border-app-line/70 bg-white/72 p-6 shadow-[0_16px_40px_-30px_rgba(30,26,22,0.3)]">
            <h2 class="mb-3 text-lg font-semibold tracking-[-0.02em]">Operational status</h2>
            <p class="leading-7 text-app-text-soft">${escapeHtml(backupStatus)}</p>
            <form class="mt-5" method="post" action="/logout">
              <button class="rounded-full bg-app-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_-20px_rgba(179,77,0,0.7)] transition hover:bg-app-accent-strong" type="submit">Sign out</button>
            </form>
          </section>
          <section class="rounded-[1rem] border border-app-line/70 bg-white/72 p-6 shadow-[0_16px_40px_-30px_rgba(30,26,22,0.3)]">
            <h2 class="mb-3 text-lg font-semibold tracking-[-0.02em]">Available routes</h2>
            <ul class="grid gap-3 text-app-text-soft">${routeList}</ul>
          </section>
          <section class="rounded-[1rem] border border-app-line/70 bg-white/72 p-6 shadow-[0_16px_40px_-30px_rgba(30,26,22,0.3)]">
            <h2 class="mb-3 text-lg font-semibold tracking-[-0.02em]">Next steps</h2>
            <p class="leading-7 text-app-text-soft">Keep the scheduler model abstract for now, then add channel adapters and scheduling workflows on top of the auth and backup foundation already in place.</p>
            <p class="mt-4 leading-7 text-app-text-soft">Health probe: <a class="font-semibold text-app-accent-strong underline decoration-app-accent/30 underline-offset-4" href="/api/health">/api/health</a></p>
          </section>
        </div>
      </article>
    </main>
  </body>
</html>`;
}
