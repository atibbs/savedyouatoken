import {
  CONTRACT_VERSION,
  ContractValidationFailure,
  contentIdentity,
  formatTokens,
  formatUsd,
  requireReportEnvelope,
  type BaselineDocument,
  type ReportEnvelope,
} from '@savedyouatoken/core';
import { readFileSync } from 'node:fs';
import { BASELINE_BUNDLE_SCHEMA, BASELINE_BUNDLE_VERSION, formatContractErrors, writeBaselineBundle } from '../contracts-io';
import {
  VERSION,
  analyzeFile,
  buildProvisionalReport,
  c,
  consumeAuditFlag,
  defaultAuditOptions,
  fail,
  gitRevision,
  requireKnownModel,
  type AuditOptions,
} from '../support';

const HELP = `savedyouatoken baseline create <file> [options]
savedyouatoken baseline create --from-report <path> [options]

Creates a committable, prompt-free baseline bundle: an immutable pointer to one report's content
identity, alongside the full report so later commands can compare against it. A baseline
represents exactly one workflow — pass one file, or one already-captured report.

OPTIONS
      --from-report <path>  Build the baseline from an existing versioned report (e.g. from the
                             SDK's portableReport) instead of auditing a file
      --workflow <id>       Workflow id (default: derived from the file name)
      --release <id>        Release or commit id (default: current git HEAD, else "unversioned")
      --out <path>          Where to write the bundle (default: ./savedyouatoken.baseline.json)
${AUDIT_OPTION_HELP()}
  -h, --help                 Show this help
`;

function AUDIT_OPTION_HELP(): string {
  return `  -m, --model <id>          Model to price against, when auditing a file
  -r, --requests <n>        Requests per day
  -o, --output-tokens <n>   Average response length
  -c, --cache-hit-rate <n>  Cache hit rate 0-100
  -t, --tools <file>        JSON file of tool/function definitions
      --aggressive          Also remove instructions duplicated elsewhere`;
}

export async function runBaseline(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === '-h' || sub === '--help') {
    process.stdout.write(HELP);
    return;
  }
  if (sub !== 'create') fail(`Unknown baseline command "${sub ?? ''}". Try \`savedyouatoken baseline create\`.`);
  await runCreate(rest);
}

async function runCreate(argv: string[]): Promise<void> {
  const audit: AuditOptions = defaultAuditOptions();
  const files: string[] = [];
  let fromReport: string | undefined;
  let workflowId: string | undefined;
  let releaseId: string | undefined;
  let out = 'savedyouatoken.baseline.json';

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
      case '--from-report':
        fromReport = next();
        break;
      case '--workflow':
        workflowId = next();
        break;
      case '--release':
        releaseId = next();
        break;
      case '--out':
        out = next();
        break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
        else files.push(arg);
    }
  }

  if (fromReport && files.length) fail('Pass either a file to audit or --from-report, not both.');
  if (!fromReport && files.length !== 1) {
    fail('baseline create takes exactly one file — a baseline represents exactly one workflow.');
  }

  let report: ReportEnvelope;
  let sources: string[] | undefined;

  if (fromReport) {
    try {
      report = requireReportEnvelope(JSON.parse(readFileSync(fromReport, 'utf8')));
    } catch (err) {
      if (err instanceof ContractValidationFailure) {
        fail(`${fromReport} is not a valid report:\n${formatContractErrors(err.errors)}`);
      }
      fail(`Cannot read ${fromReport}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (workflowId || releaseId) {
      report = { ...report, workflow: workflowId ? { ...report.workflow, id: workflowId } : report.workflow, release: releaseId ? { ...report.release, id: releaseId } : report.release };
    }
  } else {
    requireKnownModel(audit);
    const file = files[0]!;
    const result = analyzeFile(file, audit);
    report = buildProvisionalReport(result, {
      workflow: { id: workflowId ?? file },
      release: releaseId ? { id: releaseId } : undefined,
    });
    sources = [file];
  }

  await writeBundle(report, sources, out);
}

async function writeBundle(report: ReportEnvelope, sources: string[] | undefined, out: string): Promise<void> {
  const reportId = await contentIdentity(report);
  const baseline: BaselineDocument = {
    contract: { kind: 'baseline', version: { ...CONTRACT_VERSION } },
    provenance: { producer: 'savedyouatoken', producerVersion: VERSION, generatedAt: new Date().toISOString() },
    reportId,
    workflow: report.workflow,
    release: report.release,
  };

  await writeBaselineBundle(out, {
    schema: BASELINE_BUNDLE_SCHEMA,
    version: { ...BASELINE_BUNDLE_VERSION },
    baseline,
    report,
    sources,
    sourceRevision: gitRevision(),
  });

  process.stdout.write(
    `${c.green('✓')} Baseline written to ${c.bold(out)}\n` +
      `  workflow  ${report.workflow.id}\n` +
      `  release   ${report.release.id}\n` +
      `  reportId  ${c.dim(reportId)}\n` +
      `  tokens    ${formatTokens(report.analysis.inputTokens)} input · ${formatUsd(report.analysis.monthlyNow)}/month\n` +
      `\nCommit this file to establish a regression baseline for \`compare\` and \`policy check\`.\n`,
  );
}
