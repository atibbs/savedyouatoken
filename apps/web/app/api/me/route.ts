import { NextResponse } from 'next/server';
import { auth, authConfigured } from '@/auth';
import { getEntitlement } from '@/lib/entitlements';
import { stripeConfigured } from '@/lib/stripe';

// Lets the client learn who it is and which plan it has, so the UI can lift the free
// saved-prompt limit and show account state. Entitlement is still enforced server-side on
// every write; this endpoint is only for presentation.
export async function GET() {
  // Free, static deployment (no sign-in configured): never touch the auth machinery.
  if (!authConfigured) {
    return NextResponse.json({
      authenticated: false,
      plan: 'free' as const,
      authConfigured: false,
      billingConfigured: stripeConfigured,
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({
      authenticated: false,
      plan: 'free' as const,
      authConfigured: true,
      billingConfigured: stripeConfigured,
    });
  }
  const entitlement = await getEntitlement(session.user.id);
  return NextResponse.json({
    authenticated: true,
    user: { name: session.user.name ?? null, email: session.user.email ?? null },
    plan: entitlement.plan,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    authConfigured: true,
    billingConfigured: stripeConfigured,
  });
}
