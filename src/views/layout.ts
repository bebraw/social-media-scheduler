import { escapeHtml, renderSessionPanel, renderWorkspaceNav } from "./shared";

export interface SessionUser {
  name: string;
  role: string;
}

export type WorkspacePath = "/" | "/compose" | "/history" | "/settings" | "/demo";

interface WorkspacePageOptions {
  activePath: WorkspacePath;
  content: string;
  demoAvailable: boolean;
  description: string;
  title: string;
  user: SessionUser;
  width?: "base" | "wide";
}

export function renderWorkspacePage({
  activePath,
  content,
  demoAvailable,
  description,
  title,
  user,
  width = "wide",
}: WorkspacePageOptions): string {
  const pageWidthClass = width === "base" ? "w-[min(64rem,calc(100vw-2rem))]" : "w-[min(72rem,calc(100vw-2rem))]";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Social Media Scheduler</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="module" src="/home.js"></script>
  </head>
  <body class="min-h-screen bg-app-canvas text-app-text antialiased">
    <main class="mx-auto ${pageWidthClass} py-10 sm:py-14">
      <article class="overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-panel">
        <section class="border-b border-app-line px-5 py-8 sm:px-8 sm:py-10">
          <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">Social Media Scheduler</p>
              <h1 class="mt-3 text-4xl leading-none font-semibold tracking-[-0.04em] sm:text-5xl">${escapeHtml(title)}</h1>
              <p class="mt-4 max-w-2xl text-base leading-7 text-app-text-soft sm:text-lg">${escapeHtml(description)}</p>
              ${renderWorkspaceNav({ activePath, demoAvailable })}
            </div>
            ${renderSessionPanel(user)}
          </div>
        </section>
        ${content}
      </article>
    </main>
  </body>
</html>`;
}
