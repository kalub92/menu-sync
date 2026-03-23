-- Sync Jobs: queue-based sync processing
CREATE TABLE IF NOT EXISTS "sync_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "platform_connections"("id") ON DELETE CASCADE,
  "menu_id" uuid NOT NULL REFERENCES "menus"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "trigger" text DEFAULT 'manual' NOT NULL,
  "attempt" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "external_job_id" text,
  "error" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "next_retry_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Sync Snapshots: last-synced menu state per connection
CREATE TABLE IF NOT EXISTS "sync_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "platform_connections"("id") ON DELETE CASCADE,
  "menu_id" uuid NOT NULL REFERENCES "menus"("id") ON DELETE CASCADE,
  "snapshot" jsonb NOT NULL,
  "checksum" text NOT NULL,
  "sync_job_id" uuid REFERENCES "sync_jobs"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "sync_snapshots_connection_menu_idx" ON "sync_snapshots" ("connection_id", "menu_id");

-- Sync History: audit log of all sync operations
CREATE TABLE IF NOT EXISTS "sync_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "platform_connections"("id") ON DELETE CASCADE,
  "menu_id" uuid NOT NULL REFERENCES "menus"("id") ON DELETE CASCADE,
  "sync_job_id" uuid REFERENCES "sync_jobs"("id") ON DELETE SET NULL,
  "status" text NOT NULL,
  "trigger" text DEFAULT 'manual' NOT NULL,
  "platform" text NOT NULL,
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "changes_summary" jsonb,
  "external_job_id" text,
  "error" text,
  "duration_ms" integer,
  "started_at" timestamp NOT NULL,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "sync_history_connection_idx" ON "sync_history" ("connection_id");
CREATE INDEX "sync_history_restaurant_idx" ON "sync_history" ("restaurant_id");
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs" ("status");
CREATE INDEX "sync_jobs_connection_idx" ON "sync_jobs" ("connection_id");
