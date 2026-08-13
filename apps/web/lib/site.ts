export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://savedyouatoken.com';
export const SITE_NAME = 'savedyouatoken';
export const TAGLINE = 'Find the waste in your LLM prompts before your invoice does.';

/**
 * The pay-what-you-want product page for the downloadable agent kit (Gumroad). Public,
 * so it lives in config rather than a secret. Empty until the product is created and set,
 * in which case the /kit page and its CTAs show a "coming soon" state instead of a link.
 */
export const KIT_URL = process.env.NEXT_PUBLIC_KIT_URL ?? '';

export const RESOURCE_NAV = [
  { href: '/waste', label: 'Waste patterns', short: 'Waste', smallScreen: true },
  { href: '/models', label: 'Model prices', short: 'Prices', smallScreen: true },
  { href: '/pricing', label: 'Pricing', short: 'Pricing', smallScreen: false },
  { href: '/methodology', label: 'Methodology', short: 'Method', smallScreen: false },
];
