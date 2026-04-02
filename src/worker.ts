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
import { runAutomatedBackup } from "./backup";
import { canAccessDemo, getDemoDrafts, getDemoSentHistory, loadDemoQueuedPosts, scheduleDemoPost } from "./demo";
import { loadSentPostHistory } from "./history";
import { listAppRoutes } from "./app-routes";
import { renderComposePage } from "./views/compose";
import { renderDemoPage } from "./views/demo";
import { renderHistoryPage } from "./views/history";
import { HOME_PAGE_SCRIPT, renderQueuePage } from "./views/home";
import { renderLoginPage } from "./views/login";
import { renderNotFoundPage } from "./views/not-found";
import { cssResponse, htmlResponse, javascriptResponse, redirectResponse } from "./views/shared";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await handleRequest(request, env);
  },
  async scheduled(controller: ScheduledControllerLike, env: Env): Promise<void> {
    try {
      await handleScheduledBackup(controller, env);
    } catch (error) {
      console.error("Scheduled backup failed", error);
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
    return createHealthResponse(listAppRoutes({ includeDemo: canAccessDemo(request, env) }).map((route) => route.path));
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
    return htmlResponse(
      renderQueuePage({
        demoAvailable: canAccessDemo(request, env),
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/compose") {
    return htmlResponse(
      renderComposePage({
        demoAvailable: canAccessDemo(request, env),
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/history") {
    const sentHistory = env.DB ? await loadSentPostHistory(env.DB) : [];

    return htmlResponse(
      renderHistoryPage({
        demoAvailable: canAccessDemo(request, env),
        sentHistory,
        user: sessionUser,
      }),
    );
  }

  if (url.pathname === "/demo" || url.pathname === "/demo/queue") {
    if (!canAccessDemo(request, env)) {
      return htmlResponse(renderNotFoundPage(url.pathname), 404);
    }

    if (url.pathname === "/demo/queue" && request.method === "POST") {
      if (!env.DB) {
        return new Response("D1 binding is missing.", { status: 500 });
      }
      if (isReadonlyUser(sessionUser)) {
        return new Response("Readonly users cannot schedule demo posts.", { status: 403 });
      }

      const formData = await request.formData();
      const channel = String(formData.get("channel") || "");
      const body = String(formData.get("body") || "");
      const slot = String(formData.get("slot") || "");
      if (channel !== "linkedin" && channel !== "x" && channel !== "bluesky") {
        return new Response("Unsupported demo channel.", { status: 400 });
      }
      await scheduleDemoPost(env.DB, {
        channel,
        body,
        slot,
      });

      return redirectResponse("/demo");
    }

    if (url.pathname === "/demo" && request.method === "GET") {
      const queuedPosts = env.DB ? await loadDemoQueuedPosts(env.DB) : [];

      return htmlResponse(
        renderDemoPage({
          drafts: getDemoDrafts(),
          queuedPosts,
          sentHistory: getDemoSentHistory(),
          user: sessionUser,
        }),
      );
    }
  }

  return htmlResponse(renderNotFoundPage(url.pathname), 404);
}

async function loadStylesheet(): Promise<string> {
  if (typeof process !== "undefined" && process.release?.name === "node") {
    const { readFile } = await import("node:fs/promises");
    return await readFile(new URL("../.generated/styles.css", import.meta.url), "utf8");
  }

  const styles = await import("../.generated/styles.css");
  return styles.default;
}

async function handleScheduledBackup(controller: ScheduledControllerLike, env: Env): Promise<void> {
  if (!env.DB) {
    console.warn("Skipping automated backup because the D1 binding is missing.");
    return;
  }

  if (!env.BACKUP_BUCKET) {
    console.warn("Skipping automated backup because the R2 BACKUP_BUCKET binding is missing.");
    return;
  }

  const result = await runAutomatedBackup(env.DB, env.BACKUP_BUCKET, {
    backupPrefix: env.BACKUP_PREFIX,
    cron: controller.cron,
  });

  if (result.skipped) {
    const matchedManifestMessage = result.matchedManifestKey ? `: ${result.matchedManifestKey}` : "";
    console.log(`Automated backup skipped because exported data is unchanged${matchedManifestMessage}`);
    return;
  }

  console.log(`Automated backup completed: ${result.manifestKey}`);
}
