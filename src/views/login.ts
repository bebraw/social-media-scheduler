import { escapeHtml } from "./shared";

interface LoginPageOptions {
  error?: string;
  userCount: number;
}

export function renderLoginPage({ error, userCount }: LoginPageOptions): string {
  const helperCopy =
    userCount === 1
      ? "Exactly one account exists, so the username field can be left blank during local testing."
      : "Use an account created with npm run account:create.";
  const errorMarkup = error
    ? `<p class="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">${escapeHtml(error)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign In | Social Media Scheduler</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="mx-auto flex min-h-screen w-[min(32rem,calc(100vw-2rem))] items-center py-12">
      <section class="w-full rounded-[1.5rem] border border-app-line/80 bg-app-surface/95 p-6 shadow-panel backdrop-blur sm:p-8">
        <p class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-app-accent">Private Access</p>
        <h1 class="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Sign in</h1>
        <p class="mt-4 text-base leading-7 text-app-text-soft">This scheduler is intentionally private. Sign in with a local D1-backed account before working on adapters or UI.</p>
        <p class="mt-3 text-sm leading-6 text-app-text-soft">${escapeHtml(helperCopy)}</p>
        <div class="mt-6 grid gap-4">
          ${errorMarkup}
          <form class="grid gap-4" method="post" action="/login">
            <label class="grid gap-2 text-sm font-medium">
              <span>Name</span>
              <input class="rounded-2xl border border-app-line bg-white px-4 py-3 text-base outline-none ring-0 transition placeholder:text-app-text-soft/70 focus:border-app-accent" name="name" type="text" autocomplete="username">
            </label>
            <label class="grid gap-2 text-sm font-medium">
              <span>Password</span>
              <input class="rounded-2xl border border-app-line bg-white px-4 py-3 text-base outline-none ring-0 transition placeholder:text-app-text-soft/70 focus:border-app-accent" name="password" type="password" autocomplete="current-password" required>
            </label>
            <button class="mt-2 rounded-full bg-app-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-20px_rgba(179,77,0,0.7)] transition hover:bg-app-accent-strong" type="submit">Sign in</button>
          </form>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
