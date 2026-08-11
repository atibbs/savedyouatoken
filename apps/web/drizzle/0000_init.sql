-- Initial schema for savedyouatoken Pro data.
-- Apply with:  npm run db:push   (drizzle-kit, using DATABASE_URL)
-- or run this file directly against the database.

CREATE TABLE IF NOT EXISTS "saved_prompts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "prompt" text NOT NULL,
  "tools" text DEFAULT '' NOT NULL,
  "model_id" text NOT NULL,
  "requests_per_day" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "saved_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_prompts_user_idx" ON "saved_prompts" ("user_id");

CREATE TABLE IF NOT EXISTS "entitlements" (
  "user_id" text PRIMARY KEY NOT NULL,
  "plan" text DEFAULT 'free' NOT NULL,
  "status" text DEFAULT 'none' NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "current_period_end" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
