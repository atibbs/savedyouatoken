import { loadDiscoveryConfig, scan } from '../discovery/scan';
import type { AssetCandidate, AssetStatus } from '../discovery/types';
import { c, fail } from '../support';

export const DISCOVER_SCHEMA = 'savedyouatoken.cli/discovery';
export const DISCOVER_SCHEMA_VERSION = { major: 1, minor: 0 } as const;

const HELP = `savedyouatoken discover [roots...] [options]

Scans the repository for supported prompt, agent-instruction, and tool-schema assets. Only
known filenames and extensions are considered — see docs/cli-regression-workflow.md — so this
never audits arbitrary source text.

OPTIONS
      --config <path>   Discovery config (default: ./savedyouatoken.discovery.json if present)
      --json            Emit a schema-versioned JSON document instead of a report
  -q, --quiet           Only print a summary line
  -h, --help            Show this help
`;

export function runDiscover(argv: string[]): void {
  const roots: string[] = [];
  let configPath: string | undefined;
  let json = false;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (value == null) fail(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return;
      case '--config':
        configPath = next();
        break;
      case '--json':
        json = true;
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
        else roots.push(arg);
    }
  }

  const config = loadDiscoveryConfig(configPath);
  if (roots.length) config.roots = roots;
  const result = scan(config);

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          schema: DISCOVER_SCHEMA,
          version: DISCOVER_SCHEMA_VERSION,
          config: result.config,
          candidates: result.candidates,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  const byStatus = groupBy(result.candidates);
  if (quiet) {
    process.stdout.write(summaryLine(byStatus) + '\n');
    return;
  }

  printGroup('Included', byStatus.included, c.green);
  printGroup('Ambiguous', byStatus.ambiguous, c.yellow);
  printGroup('Unsupported', byStatus.unsupported, c.dim);
  printGroup('Excluded', byStatus.excluded, c.dim);
  process.stdout.write('\n' + summaryLine(byStatus) + '\n');
}

function groupBy(candidates: AssetCandidate[]): Record<AssetStatus, AssetCandidate[]> {
  const groups: Record<AssetStatus, AssetCandidate[]> = {
    included: [],
    ambiguous: [],
    unsupported: [],
    excluded: [],
  };
  for (const candidate of candidates) groups[candidate.status].push(candidate);
  return groups;
}

function printGroup(label: string, candidates: AssetCandidate[], tint: (s: string) => string): void {
  if (!candidates.length) return;
  process.stdout.write(`\n${c.bold(label)} (${candidates.length})\n`);
  for (const candidate of candidates) {
    const classLabel = candidate.assetClass ? ` [${candidate.assetClass}]` : '';
    process.stdout.write(`  ${tint(candidate.path)}${classLabel}\n`);
    process.stdout.write(c.dim(`    ${candidate.reason}\n`));
  }
}

function summaryLine(byStatus: Record<AssetStatus, AssetCandidate[]>): string {
  return `${byStatus.included.length} included, ${byStatus.ambiguous.length} ambiguous, ${byStatus.unsupported.length} unsupported, ${byStatus.excluded.length} excluded`;
}
