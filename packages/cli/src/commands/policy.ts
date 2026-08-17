import {
  CONTRACT_VERSION,
  ContractValidationFailure,
  diffReports,
  evaluatePolicy,
  formatTokens,
  formatUsd,
  requireReportEnvelope,
  type EnforcementSeverity,
  type PolicyBudgets,
  type PolicyDocument,
  type ReportEnvelope,
} from '@savedyouatoken/core';
import { readFileSync } from 'node:fs';
import { formatContractErrors, readBaselineBundle, readPolicyDocument, writePolicyDocument } from '../contracts-io';
import {
  VERSION,
  analyzeFile,
  buildProvisionalReport,
  c,
  consumeAuditFlag,
  defaultAuditOptions,
  fail,
  requireKnownModel,
  type AuditOptions,
} from '../support';

export const POLICY_CHECK_SCHEMA = 'savedyouatoken.cli/policy-check';
export const POLICY_CHECK_SCHEMA_VERSION = { major: 1, minor: 0 } as const;

const DEFAULT_REGRESSION_PERCENT = 10;
const HEADROOM = 1.1;

const GENERATE_HELP = `savedyouatoken policy generate <file>|--baseline <path>|--from-report <path> [options]

Generates a reviewable policy document. Absolute budgets default to 10% headroom over the
source report's own totals; regression budgets default to 10% and require --baseline. All
defaults are suggestions — review the written file before committing it.

OPTIONS
      --baseline <path>                    Source report + enables regression budgets
      --from-report <path>                 Source report (must be mature, unless --allow-provisional)
      --allow-provisional                  Allow --from-report to seed a policy from a provisional report
      --workflow <id>                      Override the target workflow id
      --max-input-tokens <n>               Absolute token budget (default: 10% over the source)
      --max-monthly-cost <usd>             Absolute cost budget (default: 10% over the source)
      --max-token-regression-percent <n>   Regression budget (default: 10 when --baseline is set)
      --max-cost-regression-percent <n>    Regression budget (default: 10 when --baseline is set)
      --enforcement <warn|fail>            Breach severity (default: warn)
      --out <path>                         Where to write the policy (default: ./savedyouatoken.policy.json)
  -h, --help                                Show this help
`;

const CHECK_HELP = `savedyouatoken policy check <file> --policy <path> [--baseline <path>] [options]

Evaluates one file against a committed policy and exits 0 (pass or warn) or 1 (fail), the
contract for CI. Regression budgets require --baseline and it must match policy.baselineId.

OPTIONS
      --policy <path>     Policy document from \`policy generate\` (required)
      --baseline <path>   Baseline bundle, required if the policy has regression budgets
      --json              Emit a schema-versioned JSON document instead of a report
  -q, --quiet             Only print breaches
  -h, --help               Show this help
`;

export async function runPolicy(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === 'generate') return runGenerate(rest);
  if (sub === 'check') return runCheck(rest);
  if (sub === '-h' || sub === '--help' || sub == null) {
    process.stdout.write(GENERATE_HELP + '\n' + CHECK_HELP);
    return;
  }
  fail(`Unknown policy command "${sub}". Try \`policy generate\` or \`policy check\`.`);
}

// ------------------------------------------------------------------------------------ generate

async function runGenerate(argv: string[]): Promise<void> {
  const audit: AuditOptions = defaultAuditOptions();
  const files: string[] = [];
  let baselinePath: string | undefined;
  let fromReport: string | undefined;
  let allowProvisional = false;
  let workflowId: string | undefined;
  let maxInputTokens: number | undefined;
  let maxMonthlyCost: number | undefined;
  let maxTokenRegressionPercent: number | undefined;
  let maxCostRegressionPercent: number | undefined;
  let enforcement: EnforcementSeverity = 'warn';
  let out = 'savedyouatoken.policy.json';

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
        process.stdout.write(GENERATE_HELP);
        return;
      case '--baseline':
        baselinePath = next();
        break;
      case '--from-report':
        fromReport = next();
        break;
      case '--allow-provisional':
        allowProvisional = true;
        break;
      case '--workflow':
        workflowId = next();
        break;
      case '--max-input-tokens':
        maxInputTokens = Number(next());
        break;
      case '--max-monthly-cost':
        maxMonthlyCost = Number(next());
        break;
      case '--max-token-regression-percent':
        maxTokenRegressionPercent = Number(next());
        break;
      case '--max-cost-regression-percent':
        maxCostRegressionPercent = Number(next());
        break;
      case '--enforcement':
        enforcement = requireEnforcement(next());
        break;
      case '--out':
        out = next();
        break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
        else files.push(arg);
    }
  }

  if (files.length > 1) fail('policy generate takes at most one file — a policy represents exactly one workflow.');
  const sourceCount = [baselinePath, fromReport, files.length > 0].filter(Boolean).length;
  if (sourceCount !== 1) fail('policy generate needs exactly one source: a file, --baseline, or --from-report.');

  let report: ReportEnvelope;
  let baselineId: string | undefined;

  if (baselinePath) {
    const bundle = await readBaselineBundle(baselinePath);
    report = bundle.report;
    baselineId = bundle.baseline.reportId;
  } else if (fromReport) {
    try {
      report = requireReportEnvelope(JSON.parse(readFileSync(fromReport, 'utf8')));
    } catch (err) {
      if (err instanceof ContractValidationFailure) {
        fail(`${fromReport} is not a valid report:\n${formatContractErrors(err.errors)}`);
      }
      fail(`Cannot read ${fromReport}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (report.maturity.state !== 'mature' && !allowProvisional) {
      fail(
        `${fromReport} is provisional (${report.maturity.observations} observation(s)). Seeding a policy ` +
          `from provisional evidence is unreliable — wait for a mature report, or pass --allow-provisional.`,
      );
    }
  } else {
    requireKnownModel(audit);
    const file = files[0]!;
    const result = analyzeFile(file, audit);
    report = buildProvisionalReport(result, { workflow: { id: workflowId ?? file } });
  }

  if ((maxTokenRegressionPercent != null || maxCostRegressionPercent != null) && !baselineId) {
    fail('Regression budgets require --baseline.');
  }

  const budgets: PolicyBudgets = {
    maxInputTokens: maxInputTokens ?? Math.ceil(report.analysis.inputTokens * HEADROOM),
    maxMonthlyCost: maxMonthlyCost ?? round2(report.analysis.monthlyNow * HEADROOM),
  };
  if (baselineId) {
    budgets.maxTokenRegressionPercent = maxTokenRegressionPercent ?? DEFAULT_REGRESSION_PERCENT;
    budgets.maxCostRegressionPercent = maxCostRegressionPercent ?? DEFAULT_REGRESSION_PERCENT;
  }

  const policy: PolicyDocument = {
    contract: { kind: 'policy', version: { ...CONTRACT_VERSION } },
    provenance: { producer: 'savedyouatoken', producerVersion: VERSION, generatedAt: new Date().toISOString() },
    target: { id: workflowId ?? report.workflow.id, ...(report.workflow.environment ? { environment: report.workflow.environment } : {}) },
    ...(baselineId ? { baselineId } : {}),
    budgets,
    pricing: { currency: 'USD', modelId: report.analysis.modelId, catalogueDate: report.catalogue.modelCatalogueDate },
    enforcement,
  };

  writePolicyDocument(out, policy);
  process.stdout.write(
    `${c.green('✓')} Policy written to ${c.bold(out)} (${enforcement} on breach)\n` +
      `  target             ${policy.target.id}\n` +
      `  max input tokens   ${formatTokens(budgets.maxInputTokens!)}\n` +
      `  max monthly cost   ${formatUsd(budgets.maxMonthlyCost!)}\n` +
      (budgets.maxTokenRegressionPercent != null
        ? `  max token regress. ${budgets.maxTokenRegressionPercent}%\n  max cost regress.  ${budgets.maxCostRegressionPercent}%\n`
        : '') +
      `\nThese are suggested starting budgets — review them before committing this file.\n`,
  );
}

function requireEnforcement(value: string): EnforcementSeverity {
  if (value !== 'warn' && value !== 'fail') fail(`--enforcement must be "warn" or "fail", got "${value}".`);
  return value;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --------------------------------------------------------------------------------------- check

async function runCheck(argv: string[]): Promise<void> {
  const audit: AuditOptions = defaultAuditOptions();
  const files: string[] = [];
  let policyPath: string | undefined;
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
        process.stdout.write(CHECK_HELP);
        return;
      case '--policy':
        policyPath = next();
        break;
      case '--baseline':
        baselinePath = next();
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

  if (!policyPath) fail('policy check requires --policy <path>.');
  if (files.length !== 1) fail('policy check takes exactly one file — one report evaluates against one policy target.');

  const policy = readPolicyDocument(policyPath);
  const baseline = baselinePath ? await readBaselineBundle(baselinePath) : undefined;

  if (policy.baselineId && !baseline) {
    fail(`Policy ${policyPath} has regression budgets and requires --baseline.`);
  }
  // The baseline-identity mismatch check itself now lives in evaluatePolicy (core), so every
  // caller gets it — not just this command.

  requireKnownModel(audit);
  const file = files[0]!;
  const result = analyzeFile(file, audit);
  const report = buildProvisionalReport(result, { workflow: policy.target });

  let evaluation;
  try {
    evaluation = evaluatePolicy(policy, report, baseline?.report, baseline?.baseline.reportId);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const diff = baseline ? diffReports(baseline.report, report) : undefined;

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          schema: POLICY_CHECK_SCHEMA,
          version: POLICY_CHECK_SCHEMA_VERSION,
          target: policy.target,
          enforcement: policy.enforcement,
          outcome: evaluation.outcome,
          breaches: evaluation.breaches,
          diff,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    printCheckResult(policy.target.id, evaluation, quiet);
  }

  if (evaluation.outcome === 'fail') process.exitCode = 1;
}

function printCheckResult(
  target: string,
  evaluation: { outcome: 'pass' | 'warn' | 'fail'; breaches: Array<{ budget: string; actual: number; limit: number }> },
  quiet: boolean,
): void {
  const tint = evaluation.outcome === 'fail' ? c.red : evaluation.outcome === 'warn' ? c.yellow : c.green;
  if (!quiet || evaluation.outcome !== 'pass') {
    process.stdout.write(`${tint(evaluation.outcome.toUpperCase())}  ${target}\n`);
  }
  for (const breach of evaluation.breaches) {
    process.stdout.write(c.dim(`  ${breach.budget}: ${breach.actual} exceeds limit ${breach.limit}\n`));
  }
}
