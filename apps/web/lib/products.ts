export type ProductAvailability = 'available' | 'planned';

export type Product = {
  id: 'web' | 'sdk' | 'cli' | 'kit' | 'monitor';
  name: string;
  navLabel: string;
  shortLabel: string;
  job: string;
  description: string;
  href: string | null;
  packageName: string | null;
  action: string;
  availability: ProductAvailability;
};

export const PRODUCTS = [
  {
    id: 'web',
    name: 'Web analyser',
    navLabel: 'Paste audit',
    shortLabel: 'Audit',
    job: 'Audit one prompt in your browser',
    description: 'Paste a prompt and get an immediate, private cost and waste report.',
    href: '/',
    packageName: null,
    action: 'Open the analyser',
    availability: 'available',
  },
  {
    id: 'sdk',
    name: 'Runtime SDK',
    navLabel: 'Runtime SDK',
    shortLabel: 'SDK',
    job: 'Observe assembled production requests',
    description: 'Audit the system prompt and tools your application actually sends at runtime.',
    href: '/sdk',
    packageName: '@savedyouatoken/sdk',
    action: 'Integrate the SDK',
    availability: 'available',
  },
  {
    id: 'cli',
    name: 'CLI',
    navLabel: 'CLI · files/CI',
    shortLabel: 'CLI + CI',
    job: 'Audit files and enforce budgets in CI',
    description: 'Run deterministic audits over prompt files from a terminal or build pipeline.',
    href: '/cli',
    packageName: 'savedyouatoken',
    action: 'Run the CLI',
    availability: 'available',
  },
  {
    id: 'kit',
    name: 'Agent kit',
    navLabel: 'Agent kit',
    shortLabel: 'Kit',
    job: 'Let a coding agent run the CLI',
    description: 'Give Claude Code, Cursor, or another coding agent instructions for invoking the CLI.',
    href: '/kit',
    packageName: 'savedyouatoken',
    action: 'Get the agent kit',
    availability: 'available',
  },
  {
    id: 'monitor',
    name: 'Monitor',
    navLabel: 'Monitor',
    shortLabel: 'Monitor',
    job: 'Track cost and regressions over time',
    description: 'Historical reporting and regression alerts for teams are planned, not yet available.',
    href: null,
    packageName: null,
    action: 'Planned',
    availability: 'planned',
  },
] as const satisfies readonly Product[];

export type ProductId = (typeof PRODUCTS)[number]['id'];

export const PRODUCT_NAV = PRODUCTS.filter(
  (product): product is (typeof PRODUCTS)[number] & { href: string } =>
    product.availability === 'available' && product.href !== null,
);

export function getProduct(id: ProductId) {
  const product = PRODUCTS.find((candidate) => candidate.id === id);
  if (!product) throw new Error(`Unknown product: ${id}`);
  return product;
}
