import { escapeHtml } from "./shared";

const appTitle = "Social Media Scheduler";
const appDescription = "A private workspace for planning and reviewing social posts across personal projects.";

interface HomePageOptions {
  backupConfigured: boolean;
  user: {
    name: string;
    role: string;
  };
}

export function renderHomePage({ backupConfigured, user }: HomePageOptions): string {
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
    <main class="mx-auto w-[min(64rem,calc(100vw-2rem))] py-10 sm:py-14">
      <article class="overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-panel">
        <section class="border-b border-app-line px-5 py-8 sm:px-8 sm:py-10">
          <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div class="max-w-3xl">
              <h1 class="max-w-[11ch] text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-6xl">${escapeHtml(appTitle)}</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">${escapeHtml(appDescription)}</p>
            </div>
            <div class="rounded-xl border border-app-line/80 bg-app-canvas/70 px-4 py-4 md:min-w-64">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-soft">Session</p>
              <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(user.name)}</p>
              <p class="text-sm text-app-text-soft">${escapeHtml(user.role)}</p>
              <form class="mt-4" method="post" action="/logout">
                <button class="w-full rounded-xl border border-app-line bg-white px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-canvas" type="submit">Sign out</button>
              </form>
            </div>
          </div>
        </section>
        <div class="grid gap-4 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section class="rounded-xl border border-app-line bg-white p-6">
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Workspace</h2>
            <p class="mt-3 leading-7 text-app-text-soft">Use this space to organize drafts, connected channels, and future publishing schedules for your personal projects.</p>
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6">
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Backups</h2>
            <p class="mt-3 leading-7 text-app-text-soft">${escapeHtml(backupStatus)}</p>
          </section>
          <section class="rounded-xl border border-app-line bg-white p-6 lg:col-span-2">
            <h2 class="text-lg font-semibold tracking-[-0.02em]">Account</h2>
            <p class="mt-3 leading-7 text-app-text-soft">You are signed in as <span class="font-medium text-app-text">${escapeHtml(user.name)}</span> with <span class="font-medium text-app-text">${escapeHtml(user.role)}</span> access.</p>
          </section>
        </div>
      </article>
    </main>
  </body>
</html>`;
}
