import type { R2BucketLike } from "./backup";
import type { D1Database } from "./db-core";

export interface Env {
  DB?: D1Database;
  BACKUP_BUCKET?: R2BucketLike;
  BACKUP_PREFIX?: string;
  APP_ENCRYPTION_SECRET?: string;
  DEMO_MODE?: string;
  MEDIA_BUCKET?: R2BucketLike;
  SESSION_SECRET?: string;
}

export interface ScheduledControllerLike {
  cron: string;
}
