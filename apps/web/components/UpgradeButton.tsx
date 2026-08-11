'use client';

import { useEffect, useState } from 'react';

/*
  The Pro call-to-action. It reflects real state read from /api/me and degrades honestly:
  - billing not configured  -> "Checkout not connected" (disabled), with the same note as
    before, so the deployed-but-unkeyed state never offers a button that cannot work;
  - not signed in           -> "Sign in to upgrade";
  - signed in, free         -> "Upgrade to Pro" (creates a Checkout session);
  - already Pro             -> "Manage subscription" (opens the Stripe customer portal).
*/

interface Me {
  authenticated: boolean;
  plan: 'free' | 'pro';
  billingConfigured?: boolean;
}

export function UpgradeButton() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((r) => r.json() as Promise<Me>)
      .then((d) => active && setMe(d))
      .catch(() => active && setMe({ authenticated: false, plan: 'free', billingConfigured: false }));
    return () => {
      active = false;
    };
  }, []);

  async function go(endpoint: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? 'Something went wrong.');
    } catch {
      setError('Could not reach the billing service.');
    } finally {
      setBusy(false);
    }
  }

  const primary =
    'mt-6 w-full border-[1.5px] border-line-strong bg-orange px-3 py-2 text-[13px] font-bold text-[#171713] transition-colors hover:bg-acid disabled:cursor-not-allowed disabled:opacity-50';
  const disabled =
    'mt-6 w-full cursor-not-allowed border border-line-strong bg-raised px-3 py-2 text-[13px] text-faint';

  // Until /api/me resolves, mirror the disabled state to avoid a flash of the wrong CTA.
  if (!me || !me.billingConfigured) {
    return (
      <>
        <button type="button" disabled className={disabled}>
          Checkout not connected
        </button>
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          Billing is wired up in the codebase but not activated on this deployment — it needs a
          Stripe key to go live (see <code className="font-mono">.env.example</code> and{' '}
          <code className="font-mono">docs/monetization.md</code>). Nothing here charges anyone.
        </p>
      </>
    );
  }

  if (!me.authenticated) {
    return (
      <a href="/api/auth/signin?callbackUrl=/pricing" className={primary.replace('disabled:cursor-not-allowed disabled:opacity-50', '') + ' inline-flex items-center justify-center'}>
        Sign in to upgrade
      </a>
    );
  }

  if (me.plan === 'pro') {
    return (
      <>
        <button type="button" onClick={() => go('/api/billing/portal')} disabled={busy} className={primary}>
          {busy ? 'Opening…' : 'Manage subscription'}
        </button>
        {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={() => go('/api/checkout')} disabled={busy} className={primary}>
        {busy ? 'Redirecting…' : 'Upgrade to Pro — $19/mo'}
      </button>
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </>
  );
}
