import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { db, dbConfigured } from '@/lib/db/client';
import { entitlements } from '@/lib/db/schema';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';

/** Open the Stripe customer portal so a Pro user can update or cancel their subscription. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!stripeConfigured || !stripe) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
  }
  if (!dbConfigured || !db) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 501 });
  }

  const rows = await db
    .select({ customerId: entitlements.stripeCustomerId })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1);

  const customerId = rows[0]?.customerId;
  if (!customerId) return NextResponse.json({ error: 'no_customer' }, { status: 404 });

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/pricing`,
  });

  return NextResponse.json({ url: portal.url });
}
