import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, ACTIVE_SUBSCRIPTION_STATUSES } from '@/lib/stripe';
import { db, dbConfigured } from '@/lib/db/client';
import { entitlements } from '@/lib/db/schema';

export const runtime = 'nodejs';

/*
  Stripe webhook — the only place entitlement is written. It verifies the signature against
  STRIPE_WEBHOOK_SECRET, then reflects subscription state into the entitlements table. The
  userId travels on the subscription metadata (stamped at checkout), so each event can be
  attributed to an account without trusting anything client-side.
*/

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId || !db) return;

  const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status);
  // The renewal timestamp lives on the subscription item in current Stripe API versions,
  // with the top-level field kept for older ones — read whichever is present, without
  // depending on the SDK's exact shape (it has moved across API versions).
  const shape = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const periodEnd = shape.items?.data?.[0]?.current_period_end ?? shape.current_period_end ?? null;

  const row = {
    userId,
    plan: isActive ? 'pro' : 'free',
    status: sub.status,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    updatedAt: new Date(),
  };

  await db
    .insert(entitlements)
    .values(row)
    .onConflictDoUpdate({ target: entitlements.userId, set: row });
}

export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    // A failed signature check is the expected outcome for forged or malformed requests.
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (!dbConfigured || !db) {
    // Acknowledge so Stripe stops retrying, but there is nowhere to record entitlement.
    return NextResponse.json({ received: true, stored: false });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertFromSubscription(event.data.object);
      break;
    default:
      // Other events are acknowledged and ignored.
      break;
  }

  return NextResponse.json({ received: true });
}
