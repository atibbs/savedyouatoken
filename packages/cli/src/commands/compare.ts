import {
  ContractValidationFailure,
  diffReports,
  formatTokens,
  formatUsd,
  requireReportEnvelope,
  type DeltaField,
  type ReportDiff,
  type ReportEnvelope,
} from '@savedyouatoken/core';
import { readFileSync } from 'node:fs';
import { formatContractErrors, readBaselineBundle } from '../contracts-io';
import {
  analyzeFile,
  buildProvisionalReport,
  c,
  consumeAuditFlag,
  defaultAuditOptions,
  fail,
  requireKnownModel,
  type AuditOptions,
} from '../support';

export const COMPARE_SCHEMA = 'savedyouatoken.cli/compare';
export const COMPARE_SCHEMA_VERSION = { major: 1, minor: 0 } as const;

const HELP = `savedyouatoken compare <file> --baseline <path> [options]
savedyouatoken compare --from-report <path> --baseline <path> [options]

Prices the change between the current result and a committed baseline: token, cache, and
monthly-cost deltas plus which findings are new, resolved, or changed. Does not enforce a
policy — see \`savedyouatoken policy check\` for pass/warn/fail exit behavior.

OPTIONS
      --baseline <path>     Baseline bundle from \`baseline create\` (required)
      --from-report <path>  Compare an existing report instead of auditing a file
      --json                Emit a schema-versioned JSON document instead of a report
  -q, --quiet                Only print the summary line
  -h, --help                  Show this help
`;

export async function runCompare(argv: string[]): Promise<void> {
  const audit: AuditOptions = defaultAuditOptions();
  const files: string[] = [];
  let fromReport: string | undefined;
  let baselinePath: string | undefined;
  let json = false;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (value == null) fail(`Missing value for ${arg}`);
      return value;
    };
    if (consumeAuditFlag(arg, next, audit)) continue;
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return;
      case '--baseline':
        baselinePath = next();
        break;
      case '--from-report':
        fromReport = next();
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
        else files.push(arg);
    }
  }

  if (!baselinePath) fail('compare requires --baseline <path>.');
  if (fromReport && files.length) fail('Pass either a file to audit or --from-report, not both.');
  if (!fromReport && files.length !== 1) fail('compare takes exactly one current file, or --from-report.');

  const bundle = await readBaselineBundle(baselinePath);

  let current: ReportEnvelope;
  if (fromReport) {
    try {
      current = requireReportEnvelope(JSON.parse(readFileSync(fromReport, 'utf8')));
    } catch (err) {
      if (err instanceof ContractValidationFailure) {
        fail(`${fromReport} is not a valid report:\n${formatContractErrors(err.errors)}`);
      }
      fail(`Cannot read ${fromReport}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    requireKnownModel(audit);
    const file = files[0]!;
    const result = analyzeFile(file, audit);
    current = buildProvisionalReport(result, {
      workflow: bundle.report.workflow,
      release: bundle.report.release,
    });
  }

  const diff = diffReports(bundle.report, current);

  if (json) {
    process.stdout.write(
      JSON.stringify({ schema: COMPARE_SCHEMA, version: COMPARE_SCHEMA_VERSION, workflow: current.workflow, diff }, null, 2) + '\n',
    );
  } else {
    printHuman(diff, quiet);
  }

  if (diff.compatibility.status === 'invalid') {
    process.exitCode = 2;
  }
}

function printHuman(diff: ReportDiff, quiet: boolean): void {
  if (diff.compatibility.status === 'invalid') {
    process.stderr.write(
      `${c.red('Cannot compare:')} incompatible with the baseline (${diff.compatibility.reasons.join(', ')}).\n`,
    );
    return;
  }
  if (diff.compatibility.status === 'approximate' && !quiet) {
    process.stdout.write(c.yellow(`Approximate comparison: ${diff.compatibility.reasons.join(', ')}\n`));
  }

  const { tokens, cost, findings } = diff;
  if (!tokens || !cost || !findings) return; // unreachable when compatibility is not invalid

  const line = (label: string, field: DeltaField, format: (n: number) => string) => {
    const sign = field.delta > 0 ? '+' : '';
    const tint = field.delta > 0 ? c.red : field.delta < 0 ? c.green : c.dim;
    const pct = field.percent == null ? '' : ` (${sign}${field.percent.toFixed(1)}%)`;
    return `  ${label.padEnd(20)} ${format(field.baseline)} → ${format(field.current)}  ${tint(`${sign}${format(field.delta)}`)}${pct}`;
  };

  process.stdout.write(`\n${c.bold('Input tokens')}\n`);
  process.stdout.write(line('input tokens', tokens.inputTokens, formatTokens) + '\n');
  process.stdout.write(`\n${c.bold('Monthly cost')}\n`);
  process.stdout.write(line('current pricing', cost.monthlyNow, formatUsd) + '\n');
  process.stdout.write(line('after rewrite', cost.monthlyAfterRewrite, formatUsd) + '\n');

  if (!quiet) {
    const changed = findings.filter((f) => f.status !== 'unchanged');
    if (changed.length) {
      process.stdout.write(`\n${c.bold('Finding changes')}\n`);
      for (const f of changed) {
        const tint = f.status === 'new' ? c.red : f.status === 'resolved' ? c.green : c.yellow;
        process.stdout.write(`  ${tint(f.status.padEnd(9))} ${f.ruleId}\n`);
      }
    }
  }
  process.stdout.write('\n');
}
