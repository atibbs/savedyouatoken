import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/*
  The database exists only for signed-in Pro features. The free tier is entirely
  client-side (localStorage) and touches none of this, which is what keeps free usage at
  zero marginal cost — every row here belongs to someone who is paying or is about to.
*/

/** A prompt saved to a user's account, with the workload it was analysed at. */
export const savedPrompts = pgTable(
  'saved_prompts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    tools: text('tools').notNull().default(''),
    modelId: text('model_id').notNull(),
    requestsPerDay: integer('requests_per_day').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    savedTokens: integer('saved_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('saved_prompts_user_idx').on(t.userId)],
);

/**
 * One row per user, written by the Stripe webhook. The presence of an active 'pro' row is
 * the single source of truth for entitlement — nothing client-side is trusted for it.
 */
export const entitlements = pgTable('entitlements', {
  userId: text('user_id').primaryKey(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('none'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SavedPromptRow = typeof savedPrompts.$inferSelect;
export type EntitlementRow = typeof entitlements.$inferSelect;
