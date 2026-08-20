'use client';

import { track } from '@vercel/analytics/react';
import { KIT_URL } from '@/lib/site';

/*
  The "Get the kit" call to action. A plain outbound link to the Gumroad product — no
  third-party overlay script, preserving the site's no-third-party-script property. Until
  the product URL is configured it renders a "coming soon" state rather than a dead link.

  The click fires a `kit_click` analytics event (the one conversion that matters); Gumroad
  is still the source of truth for actual purchases.

  `tone="onOrange"` is for the orange footer, where the default orange button would vanish.
*/
export function GetTheKit({
  className = '',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'onOrange';
}) {
  const base = 'inline-flex items-center gap-2 border-[1.5px] px-4 py-2.5 font-bold transition-colors';

  if (!KIT_URL) {
    const disabled =
      tone === 'onOrange'
        ? 'cursor-not-allowed border-[#171713] bg-[#171713]/10 text-[#171713]/60'
        : 'cursor-not-allowed border-line-strong bg-raised text-faint';
    return (
      <span aria-disabled="true" className={`${base} ${disabled} ${className}`}>
        Get the kit — coming soon
      </span>
    );
  }

  const live =
    tone === 'onOrange'
      ? 'border-[#171713] bg-[#171713] text-[#f6f4ed] hover:bg-acid hover:text-[#171713]'
      : 'border-line-strong bg-orange text-[#171713] hover:bg-acid';
  return (
    <a
      href={KIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('kit_click')}
      className={`${base} ${live} ${className}`}
    >
      Get the kit — name your price <span aria-hidden>↗</span>
    </a>
  );
}
