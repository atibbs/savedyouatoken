import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { entitlements } from './db/schema';

/*
  Entitlement is read from the database, never from the client. If there is no database, or
  no row, or the subscription is not active, the user is free. This is the only place that
  decides who is Pro; the Stripe webhook is the only place that writes it.
*/

export type Plan = 'free' | 'pro';

export interface Entitlement {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
}

const FREE: Entitlement = { plan: 'free', status: 'none', currentPeriodEnd: null };

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function getEntitlement(userId: string | null | undefined): Promise<Entitlement> {
  if (!userId || !db) return FREE;

  const rows = await db
    .select()
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return FREE;

  const active = row.plan === 'pro' && ACTIVE_STATUSES.has(row.status);
  return {
    plan: active ? 'pro' : 'free',
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd ?? null,
  };
}

export async function isPro(userId: string | null | undefined): Promise<boolean> {
  return (await getEntitlement(userId)).plan === 'pro';
}
