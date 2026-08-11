export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://savedyouatoken.com';
export const SITE_NAME = 'savedyouatoken';
export const TAGLINE = 'Find the waste in your LLM prompts before your invoice does.';

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
  { href: '/pricing', label: 'Pricing', short: 'Pricing', smallScreen: false },
];
