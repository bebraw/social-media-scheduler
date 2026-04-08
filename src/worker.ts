import { createHealthResponse } from "./api/health";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getSessionUser,
  isReadonlyUser,
  resolveAuthState,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifyLoginCredentials,
} from "./auth";
import type { Env, ScheduledControllerLike } from "./app-env";
import { normalizeBackupRetentionDays, runAutomatedBackup } from "./backup";
import {
  ChannelConnectionValidationError,
  createChannelConnection,
  deleteChannelConnection,
  getDefaultChannelConnectionDraft,
  listConfiguredProviders,
  loadChannelConnections,
  rotateChannelConnectionCredentials,
} from "./channels";
import { loadSentPostHistory } from "./history";
import {
  countQueuedPostsPublishingToday,
  deleteQueuedPost,
  deleteQueuedPostsForConnection,
  loadQueuedPosts,
  publishDueQueuedPosts,
  QueueValidationError,
  queuePost,
} from "./publishing";
import { listAppRoutes } from "./app-routes";
import { CHANNEL_CONSTRAINTS } from "./queue/constraints";
import {
  buildPostingSchedule,
  getDefaultPostingSchedules,
  loadPostingSchedules,
  PostingScheduleValidationError,
  savePostingSchedules,
} from "./schedule";
import { renderComposePage } from "./views/compose";
import { renderHistoryPage } from "./views/history";
import { HOME_PAGE_SCRIPT, renderQueuePage } from "./views/home";
import { renderLoginPage } from "./views/login";
import { renderNotFoundPage } from "./views/not-found";
import { renderSettingsPage } from "./views/settings";
import { cssResponse, htmlResponse, javascriptResponse, redirectResponse } from "./views/shared";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await handleRequest(request, env);
  },
  async scheduled(controller: ScheduledControllerLike, env: Env): Promise<void> {
    try {
      await handleScheduledTasks(controller, env);
    } catch (error) {
      console.error("Scheduled task failed", error);
      throw error;
    }
  },
};

export async function handleRequest(request: Request, env: Env = {}): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/styles.css") {
    return cssResponse(await loadStylesheet());
  }

  if (url.pathname === "/home.js") {
    return javascriptResponse(HOME_PAGE_SCRIPT);
  }

  if (url.pathname === "/api/health") {
    return createHealthResponse(listAppRoutes().map((route) => route.path));
  }

  const authState = await resolveAuthState(env);
  if (!env.SESSION_SECRET) {
    return new Response("SESSION_SECRET must be configured.", { status: 500 });
  }

  const sessionUser = await getSessionUser(request, env.SESSION_SECRET, SESSION_COOKIE);

  if (url.pathname === "/login" && request.method === "GET") {
    if (sessionUser) {
      return redirectResponse("/");
    }

    return htmlResponse(
      renderLoginPage({
        error: authState.error,
        userCount: authState.users.length,
      }),
      authState.error ? 500 : 200,
    );
  }

  if (url.pathname === "/login" && request.method === "POST") {
    if (authState.error) {
      return htmlResponse(
        renderLoginPage({
          error: authState.error,
          userCount: authState.users.length,
        }),
        500,
      );
    }

    const formData = await request.formData();
    const enteredName = String(formData.get("name") || "").trim();
    const password = String(formData.get("password") || "");
    const result = await verifyLoginCredentials(env, request, authState, enteredName, password);

    if (result.status === "authenticated") {
      const token = await createSessionToken(env.SESSION_SECRET, SESSION_TTL_SECONDS, result.user);
      const headers = new Headers();
      headers.append(
        "set-cookie",
        buildSessionCookie(token, request.url, {
          cookieName: SESSION_COOKIE,
          ttlSeconds: SESSION_TTL_SECONDS,
        }),
      );
      return redirectResponse("/", {
        headers,
      });
    }

    const errorByStatus: Record<typeof result.status, string> = {
      invalid: "Invalid credentials.",
      password_reset: "This account password hash must be rewritten with the latest account:create script.",
      rate_limited: "Too many failed login attempts. Try again later.",
    };

    return htmlResponse(
      renderLoginPage({
        error: errorByStatus[result.status],
        userCount: authState.users.length,
      }),
      result.status === "rate_limited" ? 429 : 401,
    );
  }

  if (url.pathname === "/logout" && request.method === "POST") {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      clearSessionCookie(request.url, {
        cookieName: SESSION_COOKIE,
        ttlSeconds: SESSION_TTL_SECONDS,
      }),
    );
    return redirectResponse("/login", {
      headers,
    });
  }

  if (!sessionUser) {
    return redirectResponse("/login");
  }

  if (url.pathname === "/") {
    const postingSchedules = env.DB ? await loadPostingSchedules(env.DB) : getDefaultPostingSchedules();
    const connections = env.DB ? await loadChannelConnections(env.DB) : [];
    const queuedPosts = env.DB ? await loadQueuedPosts(env.DB) : [];

    return htmlResponse(
      renderQueuePage({
        configuredConnections: connections.length,
        connections,
        publishingTodayCount: countQueuedPostsPublishingToday(queuedPosts, postingSchedules, new Date()),
        postingSchedules,
        queuedPosts,
        queueSaved: url.searchParams.get("queue") === "queued",
        scheduleSaved: url.searchParams.get("schedule") === "updated",
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/posting-schedule" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot change posting schedules.", { status: 403 });
    }

    const formData = await request.formData();
    const connections = await loadChannelConnections(env.DB);
    const configuredProviders = listConfiguredProviders(connections);

    if (configuredProviders.length === 0) {
      const postingSchedules = await loadPostingSchedules(env.DB);

      return htmlResponse(
        renderQueuePage({
          configuredConnections: 0,
          connections,
          postingSchedules,
          scheduleError: "Add at least one channel connection before editing the posting schedule.",
          user: sessionUser,
        }),
        400,
      );
    }

    try {
      const schedules = CHANNEL_CONSTRAINTS.filter((constraint) => configuredProviders.includes(constraint.id)).map((constraint) =>
        buildPostingSchedule({
          channel: constraint.id,
          time: String(formData.get(`${constraint.id}-time`) || ""),
          weekdays: formData.getAll(`${constraint.id}-weekday`).map((value) => String(value)),
        }),
      );

      await savePostingSchedules(env.DB, schedules);
      return redirectResponse("/?schedule=updated");
    } catch (error) {
      const message = error instanceof PostingScheduleValidationError ? error.message : "Unable to save the posting schedule.";
      const postingSchedules = await loadPostingSchedules(env.DB);

      return htmlResponse(
        renderQueuePage({
          configuredConnections: connections.length,
          connections,
          postingSchedules,
          scheduleError: message,
          user: sessionUser,
        }),
        error instanceof PostingScheduleValidationError ? 400 : 500,
      );
    }
  }

  if (url.pathname === "/settings" && request.method === "GET") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }

    return htmlResponse(
      renderSettingsPage({
        canEdit: !isReadonlyUser(sessionUser),
        connections: await loadChannelConnections(env.DB),
        deleted: url.searchParams.get("channel") === "deleted",
        rotated: url.searchParams.get("channel") === "rotated",
        saved: url.searchParams.get("channel") === "connected",
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/settings/channels" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot change channel settings.", { status: 403 });
    }

    const formData = await request.formData();
    const draft = {
      ...getDefaultChannelConnectionDraft(),
      channel: String(formData.get("channel") || ""),
      label: String(formData.get("label") || ""),
      accountHandle: String(formData.get("accountHandle") || ""),
      accessToken: String(formData.get("accessToken") || ""),
      refreshToken: String(formData.get("refreshToken") || ""),
    };

    if (isE2ESeededStateOnlyConfigured(env)) {
      return htmlResponse(
        renderSettingsPage({
          canEdit: true,
          connections: await loadChannelConnections(env.DB),
          draft,
          error:
            "The Playwright e2e server uses seeded channel connections only. Update npm run e2e:prepare fixtures instead of creating live provider connections in browser tests.",
          user: sessionUser,
        }),
        409,
      );
    }

    try {
      await createChannelConnection(env.DB, env, draft);
      return redirectResponse("/settings?channel=connected");
    } catch (error) {
      const message = error instanceof ChannelConnectionValidationError ? error.message : "Unable to save the channel connection.";

      return htmlResponse(
        renderSettingsPage({
          canEdit: true,
          connections: await loadChannelConnections(env.DB),
          draft,
          error: message,
          user: sessionUser,
        }),
        error instanceof ChannelConnectionValidationError ? 400 : 500,
      );
    }
  }

  if (url.pathname === "/settings/channels/rotate" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot change channel settings.", { status: 403 });
    }

    if (isE2ESeededStateOnlyConfigured(env)) {
      return htmlResponse(
        renderSettingsPage({
          canEdit: true,
          connections: await loadChannelConnections(env.DB),
          error:
            "The Playwright e2e server uses seeded channel connections only. Update npm run e2e:prepare fixtures instead of rotating live provider connections in browser tests.",
          user: sessionUser,
        }),
        409,
      );
    }

    const formData = await request.formData();

    try {
      await rotateChannelConnectionCredentials(env.DB, env, {
        accessToken: String(formData.get("accessToken") || ""),
        clearRefreshToken: String(formData.get("clearRefreshToken") || "").trim().length > 0,
        connectionId: String(formData.get("connectionId") || ""),
        refreshToken: String(formData.get("refreshToken") || ""),
      });
      return redirectResponse("/settings?channel=rotated");
    } catch (error) {
      const message = error instanceof ChannelConnectionValidationError ? error.message : "Unable to rotate channel credentials.";

      return htmlResponse(
        renderSettingsPage({
          canEdit: true,
          connections: await loadChannelConnections(env.DB),
          error: message,
          user: sessionUser,
        }),
        error instanceof ChannelConnectionValidationError ? 400 : 500,
      );
    }
  }

  if (url.pathname === "/settings/channels/delete" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot change channel settings.", { status: 403 });
    }

    const formData = await request.formData();
    const connectionId = String(formData.get("connectionId") || "").trim();
    if (connectionId) {
      await deleteChannelConnection(env.DB, connectionId);
      await deleteQueuedPostsForConnection(env.DB, connectionId);
    }

    return redirectResponse("/settings?channel=deleted");
  }

  if (url.pathname === "/compose") {
    const postingSchedules = env.DB ? await loadPostingSchedules(env.DB) : getDefaultPostingSchedules();
    const connections = env.DB ? await loadChannelConnections(env.DB) : [];
    const queuedPosts = env.DB ? await loadQueuedPosts(env.DB) : [];

    return htmlResponse(
      renderComposePage({
        connections,
        postingSchedules,
        publishingTodayCount: countQueuedPostsPublishingToday(queuedPosts, postingSchedules, new Date()),
        queueSaved: url.searchParams.get("queue") === "queued",
        queuedPosts,
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/compose/queue" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot queue posts.", { status: 403 });
    }

    const postingSchedules = await loadPostingSchedules(env.DB);
    const connections = await loadChannelConnections(env.DB);
    const queuedPosts = await loadQueuedPosts(env.DB);
    const formData = await request.formData();

    try {
      await queuePost(env.DB, connections, {
        body: String(formData.get("body") || ""),
        connectionId: String(formData.get("connectionId") || ""),
      });
      return redirectResponse("/compose?queue=queued");
    } catch (error) {
      const message = error instanceof QueueValidationError ? error.message : "Unable to queue the post.";

      return htmlResponse(
        renderComposePage({
          connections,
          postingSchedules,
          publishingTodayCount: countQueuedPostsPublishingToday(queuedPosts, postingSchedules, new Date()),
          queueError: message,
          queuedPosts,
          user: sessionUser,
        }),
        error instanceof QueueValidationError ? 400 : 500,
      );
    }
  }

  if (url.pathname === "/queue/delete" && request.method === "POST") {
    if (!env.DB) {
      return new Response("D1 binding is missing.", { status: 500 });
    }
    if (isReadonlyUser(sessionUser)) {
      return new Response("Readonly users cannot change queued posts.", { status: 403 });
    }

    const formData = await request.formData();
    const queuedPostId = String(formData.get("queuedPostId") || "").trim();
    if (queuedPostId) {
      await deleteQueuedPost(env.DB, queuedPostId);
    }

    const referer = request.headers.get("referer");
    if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.pathname === "/compose") {
        return redirectResponse("/compose");
      }
    }

    return redirectResponse("/");
  }

  if (url.pathname === "/history") {
    const sentHistory = env.DB ? await loadSentPostHistory(env.DB) : [];
    const connections = env.DB ? await loadChannelConnections(env.DB) : [];

    return htmlResponse(
      renderHistoryPage({
        connections,
        sentHistory,
        user: sessionUser,
      }),
    );
  }

  return htmlResponse(renderNotFoundPage(url.pathname), 404);
}

async function loadStylesheet(): Promise<string> {
  try {
    const styles = await import("../.generated/styles.css");
    if (typeof styles.default === "string" && styles.default.trim().length > 0) {
      return styles.default;
    }
  } catch (error) {
    // `nodejs_compat` can expose `process` in the Worker runtime, but the served
    // stylesheet still needs to come from the bundled text module there.
    if (typeof process === "undefined" || process.release?.name !== "node") {
      throw error;
    }
  }

  if (typeof process === "undefined" || process.release?.name !== "node") {
    throw new Error("Generated stylesheet module did not provide CSS content.");
  }

  const { readFile } = await import("node:fs/promises");
  return await readFile(new URL("../.generated/styles.css", import.meta.url), "utf8");
}

async function handleScheduledTasks(controller: ScheduledControllerLike, env: Env): Promise<void> {
  if (!env.DB) {
    console.warn("Skipping scheduled work because the D1 binding is missing.");
    return;
  }

  const publishResult = await publishDueQueuedPosts(env.DB, env);
  if (!publishResult.skipped) {
    console.log(`Scheduled publishing processed: ${publishResult.published} published, ${publishResult.failed} failed`);
  }

  if (controller.cron !== "30 1 * * *") {
    return;
  }

  if (!env.BACKUP_BUCKET) {
    console.warn("Skipping automated backup because the R2 BACKUP_BUCKET binding is missing.");
    return;
  }

  const result = await runAutomatedBackup(env.DB, env.BACKUP_BUCKET, {
    backupPrefix: env.BACKUP_PREFIX,
    cron: controller.cron,
    retentionDays: normalizeBackupRetentionDays(env.BACKUP_RETENTION_DAYS),
  });

  if (result.skipped) {
    const matchedManifestMessage = result.matchedManifestKey ? `: ${result.matchedManifestKey}` : "";
    console.log(`Automated backup skipped because exported data is unchanged${matchedManifestMessage}`);
    return;
  }

  console.log(`Automated backup completed: ${result.manifestKey}`);
}

function isE2ESeededStateOnlyConfigured(env: Env): boolean {
  const value = (env.E2E_SEEDED_STATE_ONLY || "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
