/**
 * savedyouatoken CLI.
 *
 * Runs the same analysis as the website against files on disk, so prompts never leave the
 * machine. `savedyouatoken <file...>` audits directly; `discover`, `baseline`, `compare`,
 * `policy`, and `import-report` turn that into a repository-wide regression workflow — see
 * docs/cli-regression-workflow.md.
 */

import { runAudit } from './commands/audit';
import { runBaseline } from './commands/baseline';
import { runCompare } from './commands/compare';
import { runDiscover } from './commands/discover';
import { runImportReport } from './commands/import-report';
import { runPolicy } from './commands/policy';

const SUBCOMMANDS = new Set(['discover', 'baseline', 'compare', 'policy', 'import-report']);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [first, ...rest] = argv;

  if (first != null && SUBCOMMANDS.has(first)) {
    switch (first) {
      case 'discover':
        return runDiscover(rest);
      case 'baseline':
        return runBaseline(rest);
      case 'compare':
        return runCompare(rest);
      case 'policy':
        return runPolicy(rest);
      case 'import-report':
        return runImportReport(rest);
    }
  }

  return runAudit(argv);
}

// Every expected failure already exits the process directly via support.ts's fail() (exit 2,
// message only, no stack trace — a usage/configuration problem). This handler only ever sees a
// genuine unexpected bug, so unlike fail() it keeps the full stack trace on stderr and exits 1
// (Node's ordinary uncaught-exception code), rather than being misreported as a usage error.
main().catch((err: unknown) => {
  process.stderr.write('savedyouatoken: unexpected error\n');
  process.stderr.write((err instanceof Error ? (err.stack ?? err.message) : String(err)) + '\n');
  process.exit(1);
});
