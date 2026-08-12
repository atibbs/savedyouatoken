export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://savedyouatoken.com';
export const SITE_NAME = 'savedyouatoken';
export const TAGLINE = 'Find the waste in your LLM prompts before your invoice does.';

/**
 * The pay-what-you-want product page for the downloadable agent kit (Gumroad). Public,
 * so it lives in config rather than a secret. Empty until the product is created and set,
 * in which case the /kit page and its CTAs show a "coming soon" state instead of a link.
 */
export const KIT_URL = process.env.NEXT_PUBLIC_KIT_URL ?? '';

/**
 * `short` is used below the `sm` breakpoint, where the full labels overflow a 375px
 * viewport. `smallScreen: false` drops an item from the mobile bar entirely — it is still
 * reachable from the footer.
 */
export const NAV = [
  { href: '/', label: 'Analyser', short: 'Analyse', smallScreen: true },
  { href: '/waste', label: 'Waste patterns', short: 'Waste', smallScreen: true },
  { href: '/models', label: 'Model prices', short: 'Prices', smallScreen: true },
  { href: '/cli', label: 'CLI', short: 'CLI', smallScreen: true },
  { href: '/kit', label: 'Kit', short: 'Kit', smallScreen: false },
  { href: '/pricing', label: 'Pricing', short: 'Pricing', smallScreen: false },
];
