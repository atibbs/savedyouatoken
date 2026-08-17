import { readFileSync, writeFileSync } from 'node:fs';
import { canonicalStringify, type EnforcementSeverity, type PolicyBudgets } from '@savedyouatoken/core';
import { buildExportedPolicy } from '../workbench/policy';
import { startWorkbenchServer } from '../workbench/server';
import { deleteStore, exportStore, getReport, ingestReport, recordBaselineApproval, resolveDataDir } from '../workbench/store';
import { c, fail } from '../support';

const HELP = `savedyouatoken workbench start [--port <n>] [--data-dir <path>]
savedyouatoken workbench import <report.json...> [--data-dir <path>]
savedyouatoken workbench approve --report <id> [--enforcement warn|fail] [--acknowledge-provisional]
                                  [--max-input-tokens N] [--max-monthly-cost N]
                                  [--max-token-regression-percent N] [--max-cost-regression-percent N]
                                  [--data-dir <path>]
savedyouatoken workbench export --workflow <id> --out <path> [--data-dir <path>]
savedyouatoken workbench delete [--data-dir <path>] [--yes]

A local, account-free, loopback-only history of versioned reports: import files or point the
SDK's local sink at a running workbench, browse workflow/release history and maturity, compare
before/after, approve a baseline, and export it as a CLI-compatible policy. See
docs/local-monitoring-workbench.md.

OPTIONS
      --data-dir <path>   Override the local data directory
                           (default: $SAVEDYOUATOKEN_WORKBENCH_DIR, else ~/.savedyouatoken/workbench)
  -h, --help               Show this help
`;

export async function runWorkbench(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === 'start') return runStart(rest);
  if (sub === 'import') return runImport(rest);
  if (sub === 'approve') return runApprove(rest);
  if (sub === 'export') return runExport(rest);
  if (sub === 'delete') return runDelete(rest);
  if (sub === '-h' || sub === '--help' || sub == null) {
    process.stdout.write(HELP);
    return;
  }
  fail(`Unknown workbench command "${sub}". Try start, import, approve, export, or delete.`);
}

function extractDataDirFlag(argv: string[]): { dataDir: string | undefined; rest: string[] } {
  const rest: string[] = [];
  let dataDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data-dir') {
      dataDir = argv[++i];
      if (dataDir == null) fail('Missing value for --data-dir');
    } else {
      rest.push(argv[i]!);
    }
  }
  return { dataDir, rest };
}

async function runStart(argv: string[]): Promise<void> {
  const { dataDir, rest } = extractDataDirFlag(argv);
  let port: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === '--port') {
      const value = rest[++i];
      if (value == null) fail('Missing value for --port');
      port = Number(value);
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(HELP);
      return;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  const server = await startWorkbenchServer({ port, dataDir });
  process.stdout.write(
    `${c.green('✓')} Workbench running at ${c.bold(server.url)}\n` +
      `  data directory   ${server.dataDir}\n` +
      `  ingestion token  ${c.dim(server.token)}\n` +
      `\nPoint an SDK local sink at this server with this token, or import files with\n` +
      `\`savedyouatoken workbench import <file>\`. Press Ctrl+C to stop.\n`,
  );

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write('\nShutting down…\n');
    server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep the process alive until a signal arrives; startWorkbenchServer's http.Server already
  // does this on its own via its open socket, so there is nothing further to await here.
}

async function runImport(argv: string[]): Promise<void> {
  const { dataDir: dataDirFlag, rest } = extractDataDirFlag(argv);
  const files = rest.filter((a) => {
    if (a === '-h' || a === '--help') {
      process.stdout.write(HELP);
      return false;
    }
    if (a.startsWith('-')) fail(`Unknown option: ${a}`);
    return true;
  });
  if (!files.length) fail('workbench import requires at least one report file.');

  const dataDir = resolveDataDir(dataDirFlag);
  let imported = 0;
  let skipped = 0;
  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch {
      fail(`Cannot read ${file}`);
    }
    const result = await ingestReport(dataDir, raw);
    if (!result.ok) {
      fail(`${file} is not a valid report:\n${result.errors.map((e) => `  ${e.path}: ${e.message} [${e.code}]`).join('\n')}`);
    }
    if (result.isNew) imported++;
    else skipped++;
    process.stdout.write(`  ${result.isNew ? c.green('imported') : c.dim('already stored')}  ${file}  (${result.id})\n`);
  }
  process.stdout.write(`\n${c.green('✓')} ${imported} imported, ${skipped} already present. Data directory: ${dataDir}\n`);
}

async function runApprove(argv: string[]): Promise<void> {
  const { dataDir: dataDirFlag, rest } = extractDataDirFlag(argv);
  let reportId: string | undefined;
  let enforcement: EnforcementSeverity = 'warn';
  let acknowledgeProvisional = false;
  const tolerance: PolicyBudgets = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    const next = () => {
      const value = rest[++i];
      if (value == null) fail(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--report':
        reportId = next();
        break;
      case '--enforcement':
        enforcement = next() === 'fail' ? 'fail' : 'warn';
        break;
      case '--acknowledge-provisional':
        acknowledgeProvisional = true;
        break;
      case '--max-input-tokens':
        tolerance.maxInputTokens = Number(next());
        break;
      case '--max-monthly-cost':
        tolerance.maxMonthlyCost = Number(next());
        break;
      case '--max-token-regression-percent':
        tolerance.maxTokenRegressionPercent = Number(next());
        break;
      case '--max-cost-regression-percent':
        tolerance.maxCostRegressionPercent = Number(next());
        break;
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return;
      default:
        fail(`Unknown option: ${arg}`);
    }
  }
  if (!reportId) fail('workbench approve requires --report <id>.');

  const dataDir = resolveDataDir(dataDirFlag);
  const report = getReport(dataDir, reportId);
  if (!report) fail(`No stored report with id ${reportId}. Run \`savedyouatoken workbench import\` first.`);

  if (report.maturity.state !== 'mature' && !acknowledgeProvisional) {
    fail(
      `This report is provisional (${report.maturity.observations} observation(s)). Approving it as a ` +
        'baseline requires --acknowledge-provisional.',
    );
  }

  recordBaselineApproval(dataDir, {
    reportId,
    workflowId: report.workflow.id,
    approvedAt: new Date().toISOString(),
    acknowledgedProvisional: report.maturity.state !== 'mature',
    tolerance,
    enforcement,
  });
  process.stdout.write(`${c.green('✓')} Approved ${reportId} as the baseline for ${c.bold(report.workflow.id)}.\n`);
}

async function runExport(argv: string[]): Promise<void> {
  const { dataDir: dataDirFlag, rest } = extractDataDirFlag(argv);
  let workflowId: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === '--workflow') workflowId = rest[++i];
    else if (arg === '--out') out = rest[++i];
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write(HELP);
      return;
    } else fail(`Unknown option: ${arg}`);
  }
  if (!workflowId) fail('workbench export requires --workflow <id>.');
  if (!out) fail('workbench export requires --out <path>.');

  const dataDir = resolveDataDir(dataDirFlag);
  const result = buildExportedPolicy(dataDir, workflowId);
  if (!result.ok) fail(result.error);

  writeFileSync(out, canonicalStringify(result.policy) + '\n', 'utf8');
  process.stdout.write(`${c.green('✓')} Policy written to ${c.bold(out)}\n`);
}

async function runDelete(argv: string[]): Promise<void> {
  const { dataDir: dataDirFlag, rest } = extractDataDirFlag(argv);
  let confirmed = false;
  for (const arg of rest) {
    if (arg === '--yes' || arg === '-y') confirmed = true;
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write(HELP);
      return;
    } else fail(`Unknown option: ${arg}`);
  }
  const dataDir = resolveDataDir(dataDirFlag);
  if (!confirmed) {
    fail(`This permanently deletes all workbench data at ${dataDir}. Re-run with --yes to confirm.`);
  }
  deleteStore(dataDir);
  process.stdout.write(`${c.green('✓')} Deleted ${dataDir}\n`);
}

// Exported for the CLI's own --help text and for tests that want to inspect a store without a
// running server.
export { exportStore };
