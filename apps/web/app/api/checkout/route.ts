import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe, stripeConfigured, PRO_PRICE_ID } from '@/lib/stripe';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * Start a Pro subscription. Creates a Stripe Checkout session for the signed-in user and
 * returns its URL. The userId is stamped onto the session and the subscription so the
 * webhook can attribute the entitlement back to the right account.
 */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!stripeConfigured || !stripe) {
    return NextResponse.json({ error: 'billing_not_configured' }, { status: 501 });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    client_reference_id: userId,
    customer_email: session.user.email ?? undefined,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/pricing?upgraded=1`,
    cancel_url: `${SITE_URL}/pricing`,
  });

  if (!checkout.url) {
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
  }
  return NextResponse.json({ url: checkout.url });
}
