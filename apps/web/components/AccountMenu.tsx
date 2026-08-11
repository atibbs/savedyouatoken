'use client';

import { useEffect, useState } from 'react';

/*
  A light client island in the header. It reads /api/me rather than pulling in a session
  context provider, so the mostly-static content pages ship no auth runtime and only make
  one small request. Sign-in and sign-out use Auth.js's built-in pages.
*/

interface Me {
  authenticated: boolean;
  user?: { name: string | null; email: string | null };
  plan: 'free' | 'pro';
}

export function AccountMenu() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/me')
      .then((r) => r.json() as Promise<Me>)
      .then((d) => active && setMe(d))
      .catch(() => active && setMe({ authenticated: false, plan: 'free' }));
    return () => {
      active = false;
    };
  }, []);

  // Reserve nothing until we know — avoids a sign-in/name flash on load.
  if (!me) return null;

  if (!me.authenticated) {
    return (
      <a
        href="/api/auth/signin?callbackUrl=/"
        className="border border-line-strong bg-panel px-2.5 py-1 text-[12px] font-bold text-ink transition-colors hover:bg-raised"
      >
        Sign in
      </a>
    );
  }

  const label = me.user?.name || me.user?.email || 'Account';
  return (
    <span className="flex items-center gap-1.5">
      {me.plan === 'pro' ? (
        <span className="border border-[#171713] bg-acid px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#171713]">
          PRO
        </span>
      ) : null}
      <a
        href="/api/auth/signout?callbackUrl=/"
        title={`${label} — sign out`}
        className="max-w-[9rem] truncate text-[12px] font-bold text-muted hover:text-ink"
      >
        {label}
      </a>
    </span>
  );
}
