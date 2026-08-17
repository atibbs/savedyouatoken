export type AssetClass = 'prompt-text' | 'agent-instructions' | 'tool-schema';
export type AssetStatus = 'included' | 'excluded' | 'ambiguous' | 'unsupported';

export interface AssetCandidate {
  /** Stable, repository-relative POSIX path. Never an absolute path or a content hash. */
  id: string;
  path: string;
  assetClass?: AssetClass;
  status: AssetStatus;
  reason: string;
}

export interface DiscoveryConfig {
  roots: string[];
  ignore: string[];
}

export interface DiscoveryResult {
  config: DiscoveryConfig;
  candidates: AssetCandidate[];
}

export const DEFAULT_IGNORE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.turbo/**',
];

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  roots: ['.'],
  ignore: DEFAULT_IGNORE,
};
