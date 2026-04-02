import { renderButton } from "./components";
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
    ? `<p class="rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">${escapeHtml(error)}</p>`
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
    <main class="mx-auto flex min-h-screen w-[min(30rem,calc(100vw-2rem))] items-center py-10">
      <section class="w-full rounded-2xl border border-app-line bg-app-surface p-6 shadow-panel sm:p-8">
        <p class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">Private Access</p>
        <h1 class="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Sign in</h1>
        <p class="mt-4 text-base leading-7 text-app-text-soft">Sign in to access your scheduler workspace.</p>
        <div class="mt-6 rounded-xl border border-app-line/80 bg-app-canvas/80 px-4 py-3">
          <p class="text-sm leading-6 text-app-text-soft">${escapeHtml(helperCopy)}</p>
        </div>
        <div class="mt-6 grid gap-4">
          ${errorMarkup}
          <form class="grid gap-4" method="post" action="/login">
            <label class="grid gap-2 text-sm font-medium">
              <span class="text-app-text">Name</span>
              <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-base outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" name="name" type="text" autocomplete="username">
            </label>
            <label class="grid gap-2 text-sm font-medium">
              <span class="text-app-text">Password</span>
              <input class="rounded-xl border border-app-line bg-white px-4 py-3 text-base outline-none transition placeholder:text-app-text-soft/70 focus:border-app-accent focus:ring-2 focus:ring-app-accent/10" name="password" type="password" autocomplete="current-password" required>
            </label>
            ${renderButton({ className: "mt-2", label: "Sign in", type: "submit", variant: "primary" })}
          </form>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
