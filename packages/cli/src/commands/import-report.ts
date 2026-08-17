import { ContractValidationFailure, formatTokens, formatUsd, requireReportEnvelope } from '@savedyouatoken/core';
import { readFileSync } from 'node:fs';
import { formatContractErrors } from '../contracts-io';
import { c, fail } from '../support';

const HELP = `savedyouatoken import-report <path> [options]

Validates a versioned report — typically the SDK's \`event.portableReport\`, redirected to a
file — and prints its workflow, maturity, and totals. Use it to confirm a report is compatible
and mature before handing it to \`baseline create --from-report\` or \`policy generate --from-report\`.

OPTIONS
      --json   Emit the validated, parsed report as JSON
  -h, --help    Show this help
`;

export function runImportReport(argv: string[]): void {
  const [path, ...rest] = argv;
  let json = false;
  for (const arg of rest) {
    if (arg === '--json') json = true;
    else if (arg === '-h' || arg === '--help') {
      process.stdout.write(HELP);
      return;
    } else fail(`Unknown option: ${arg}`);
  }
  if (!path || path === '-h' || path === '--help') {
    process.stdout.write(HELP);
    return;
  }

  let report;
  try {
    report = requireReportEnvelope(JSON.parse(readFileSync(path, 'utf8')));
  } catch (err) {
    if (err instanceof ContractValidationFailure) {
      fail(`${path} is not a valid report:\n${formatContractErrors(err.errors)}`);
    }
    fail(`Cannot read ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  const maturityTint = report.maturity.state === 'mature' ? c.green : c.yellow;
  process.stdout.write(
    `${c.green('✓')} Valid report (contract v${report.contract.version.major}.${report.contract.version.minor})\n` +
      `  workflow    ${report.workflow.id}${report.workflow.environment ? ` (${report.workflow.environment})` : ''}\n` +
      `  release     ${report.release.id}\n` +
      `  maturity    ${maturityTint(report.maturity.state)} — ${report.maturity.observations} observation(s)\n` +
      `  model       ${report.analysis.modelId}\n` +
      `  tokens      ${formatTokens(report.analysis.inputTokens)} input\n` +
      `  cost        ${formatUsd(report.analysis.monthlyNow)}/month\n`,
  );
  if (report.maturity.state !== 'mature') {
    process.stdout.write(
      c.dim('\nProvisional evidence — this report can seed a baseline, but policy generate --from-report\nwill refuse it unless you pass --allow-provisional.\n'),
    );
  }
}
