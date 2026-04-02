import { buildPostImagePath, MAX_POST_IMAGE_ALT_TEXT_LENGTH, MAX_POST_IMAGE_ATTACHMENTS, type PostImageAttachment } from "../media";

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function cssResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function javascriptResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function redirectResponse(location: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("location", location);

  return new Response(null, {
    ...init,
    status: init.status ?? 303,
    headers,
  });
}

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderWorkspaceNav(options: { activePath: "/" | "/history" | "/demo"; demoAvailable?: boolean }): string {
  const links: Array<{ href: "/" | "/history" | "/demo"; label: string }> = [
    { href: "/", label: "Workspace" },
    { href: "/history", label: "Sent history" },
  ];
  if (options.demoAvailable) {
    links.push({ href: "/demo", label: "Demo mode" });
  }

  return `<nav class="mt-6 flex flex-wrap gap-2" aria-label="Workspace pages">
    ${links
      .map((link) => {
        const isActive = link.href === options.activePath;
        return `<a class="${
          isActive ? "border-app-accent bg-app-accent text-white" : "border-app-line bg-white/80 text-app-text hover:bg-app-canvas"
        } rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/20" href="${link.href}">${link.label}</a>`;
      })
      .join("")}
  </nav>`;
}

export function renderSessionPanel(user: { name: string; role: string }): string {
  return `<div class="rounded-xl border border-app-line/80 bg-app-canvas/70 px-4 py-4 md:min-w-64">
    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-app-text-soft">Session</p>
    <p class="mt-2 text-sm font-medium text-app-text">${escapeHtml(user.name)}</p>
    <p class="text-sm text-app-text-soft">${escapeHtml(user.role)}</p>
    <form class="mt-4" method="post" action="/logout">
      <button class="w-full rounded-xl border border-app-line bg-white px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-canvas" type="submit">Sign out</button>
    </form>
  </div>`;
}

export function renderAttachmentComposer(options: { channelName: string; serverMode: boolean }): string {
  return `<section class="rounded-xl border border-app-line bg-app-canvas/40 px-4 py-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Images</p>
        <p class="mt-2 text-sm leading-6 text-app-text-soft">Attach up to ${escapeHtml(String(MAX_POST_IMAGE_ATTACHMENTS))} uploaded images and add alt text for each one before queueing.</p>
      </div>
      <span class="text-sm font-medium text-app-text" data-attachment-count>0 / ${escapeHtml(String(MAX_POST_IMAGE_ATTACHMENTS))}</span>
    </div>
    <label class="mt-4 grid gap-2 text-sm font-medium">
      <span>${escapeHtml(options.channelName)} images</span>
      <input class="block w-full rounded-xl border border-app-line bg-white px-4 py-3 text-sm text-app-text file:mr-4 file:rounded-lg file:border-0 file:bg-app-accent/10 file:px-3 file:py-2 file:font-semibold file:text-app-accent-strong focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/10" type="file" ${options.serverMode ? 'name="attachments"' : ""} data-attachment-input accept="image/png,image/jpeg,image/webp,image/gif" multiple>
    </label>
    <div class="mt-4 grid gap-3" data-attachment-list></div>
    <p class="rounded-xl border border-dashed border-app-line bg-white/70 px-4 py-3 text-sm text-app-text-soft" data-attachment-empty>No images attached yet.</p>
  </section>`;
}

export function renderPostImageAttachments(attachments: PostImageAttachment[]): string {
  if (attachments.length === 0) {
    return "";
  }

  return `<section class="mt-4 rounded-xl border border-app-line bg-app-canvas/40 p-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-app-text-soft">Attached images</p>
      <p class="text-xs font-medium text-app-text-soft">${escapeHtml(String(attachments.length))} attached</p>
    </div>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      ${attachments
        .map(
          (attachment) => `<article class="overflow-hidden rounded-xl border border-app-line bg-white">
            <img class="aspect-[4/3] w-full bg-app-canvas object-cover" src="${escapeHtml(buildPostImagePath(attachment.objectKey))}" alt="${escapeHtml(
              attachment.altText,
            )}">
            <div class="grid gap-2 px-4 py-3">
              <p class="text-sm font-medium text-app-text">${escapeHtml(attachment.fileName)}</p>
              <p class="text-sm leading-6 text-app-text-soft">${escapeHtml(attachment.altText)}</p>
            </div>
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

export function getPostImageAltTextLimit(): number {
  return MAX_POST_IMAGE_ALT_TEXT_LENGTH;
}
