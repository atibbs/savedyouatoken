/**
 * savedyouatoken CLI.
 *
 * Runs the same analysis as the website against files on disk, so prompts never leave the
 * machine and so a token budget can be enforced in continuous integration. Exits non-zero
 * when a budget is breached, which is the whole point of the CI mode.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_WORKLOAD,
  MODELS,
  PRICES_VERIFIED_ON,
  PROVIDER_LABELS,
  ANALYSIS_ENGINE_VERSION,
  RULESET_ID,
  analyze,
  canonicalStringify,
  createCounterFromO200k,
  formatTokens,
  formatUsd,
  getModel,
  toReportEnvelope,
  type AnalysisResult,
} from '@savedyouatoken/core';

// Replaced at build time by tsup `define` with the package.json version. The fallback covers
// running the TypeScript source directly (npm run cli), where the define is not applied.
declare const __CLI_VERSION__: string;
const VERSION = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '0.0.0-dev';

interface Options {
  model: string;
  requestsPerDay: number;
  outputTokens: number;
  cacheHitRate: number;
  toolsFile?: string;
  maxTokens?: number;
  maxMonthly?: number;
  aggressive: boolean;
  fix: boolean;
  json: boolean;
  contractJson: boolean;
  workflowId?: string;
  releaseId?: string;
  quiet: boolean;
}

const HELP = `savedyouatoken ${VERSION} — find the waste in your LLM prompts

USAGE
  savedyouatoken <file...> [options]
  savedyouatoken models

OPTIONS
  -m, --model <id>          Model to price against (default: ${DEFAULT_MODEL_ID})
  -r, --requests <n>        Requests per day (default: ${DEFAULT_WORKLOAD.requestsPerDay})
  -o, --output-tokens <n>   Average response length (default: ${DEFAULT_WORKLOAD.outputTokens})
  -c, --cache-hit-rate <n>  Cache hit rate 0-100 (default: 0)
  -t, --tools <file>        JSON file of tool/function definitions
      --max-tokens <n>      Fail if any prompt exceeds this token count
      --max-monthly <usd>   Fail if projected monthly cost exceeds this
      --aggressive          Also remove instructions duplicated elsewhere
      --fix                 Write the rewritten prompt back to the file
      --json                Emit JSON instead of a report
      --contract-json       Emit canonical versioned report JSON (one document per line)
      --workflow <id>       Stable workflow id for contract output
      --release <id>        Release or commit id for contract output
  -q, --quiet               Only print failures
  -h, --help                Show this help
  -v, --version             Show version

CI EXAMPLE
  savedyouatoken prompts/*.txt --model claude-sonnet-5 --requests 20000 --max-tokens 4000

  Exits 1 when a budget is breached, so a pull request that inflates a prompt
  fails the build instead of surprising you on the invoice.

Prices last verified ${PRICES_VERIFIED_ON}. Nothing is uploaded; no model is called.
`;

function parseArgs(argv: string[]): { files: string[]; options: Options; command?: string } {
  const files: string[] = [];
  const options: Options = {
    model: DEFAULT_MODEL_ID,
    requestsPerDay: DEFAULT_WORKLOAD.requestsPerDay,
    outputTokens: DEFAULT_WORKLOAD.outputTokens,
    cacheHitRate: 0,
    aggressive: false,
    fix: false,
    json: false,
    contractJson: false,
    quiet: false,
  };
  let command: string | undefined;

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
        process.exit(0);
        break;
      case '-v':
      case '--version':
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
        break;
      case '-m':
      case '--model':
        options.model = next();
        break;
      case '-r':
      case '--requests':
        options.requestsPerDay = Number(next());
        break;
      case '-o':
      case '--output-tokens':
        options.outputTokens = Number(next());
        break;
      case '-c':
      case '--cache-hit-rate':
        options.cacheHitRate = Number(next()) / 100;
        break;
      case '-t':
      case '--tools':
        options.toolsFile = next();
        break;
      case '--max-tokens':
        options.maxTokens = Number(next());
        break;
      case '--max-monthly':
        options.maxMonthly = Number(next());
        break;
      case '--aggressive':
        options.aggressive = true;
        break;
      case '--fix':
        options.fix = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--contract-json':
        options.contractJson = true;
        break;
      case '--workflow':
        options.workflowId = next();
        break;
      case '--release':
        options.releaseId = next();
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option: ${arg}`);
        else if (arg === 'models' && !command && files.length === 0) command = 'models';
        else files.push(arg);
    }
  }

  return { files, options, command };
}

function fail(message: string): never {
  process.stderr.write(`savedyouatoken: ${message}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- formatting

const supportsColour = process.stdout.isTTY && process.env.NO_COLOR == null;
const c = {
  dim: (s: string) => (supportsColour ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (supportsColour ? `\x1b[1m${s}\x1b[0m` : s),
  green: (s: string) => (supportsColour ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColour ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (supportsColour ? `\x1b[31m${s}\x1b[0m` : s),
};

const severityColour = { high: c.red, medium: c.yellow, low: c.dim } as const;

function printReport(file: string, result: AnalysisResult, options: Options) {
  const out: string[] = [];
  out.push('');
  out.push(c.bold(basename(file)));
  out.push(
    c.dim(
      `  ${formatTokens(result.inputTokens)} input tokens · ${formatUsd(result.costNow.perRequest)}/request · ${formatUsd(result.costNow.perMonth)}/month on ${result.model.name}`,
    ),
  );
  if (result.tokenizer.accuracy === 'estimated') {
    out.push(c.dim(`  token count estimated for the ${result.tokenizer.familyLabel} tokenizer`));
  }

  if (!result.findings.length) {
    out.push(c.green('  Nothing to flag.'));
    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  out.push('');
  for (const finding of result.findings) {
    const tint = severityColour[finding.severity];
    const money = finding.monthlySaving > 0 ? c.green(`${formatUsd(finding.monthlySaving)}/mo`) : '';
    out.push(`  ${tint(finding.severity.padEnd(6))} ${finding.title} ${money}`);
    out.push(c.dim(`         ${finding.detail}`));
  }

  out.push('');
  if (result.tokensRemoved > 0) {
    out.push(
      `  Safe rewrite: ${c.green(`−${formatTokens(result.tokensRemoved)} tokens`)} (${result.percentRemoved.toFixed(1)}%), worth ${c.green(formatUsd(result.monthlyRewriteSaving))} a month.`,
    );
    if (!options.fix) out.push(c.dim('  Pass --fix to write it back.'));
  }
  if (result.topOpportunity) {
    out.push(
      `  Biggest opportunity: ${result.topOpportunity.title} — ${c.green(formatUsd(result.topOpportunity.monthlySaving))} a month.`,
    );
  }

  process.stdout.write(out.join('\n') + '\n');
}

// --------------------------------------------------------------------- main

function main() {
  const { files, options, command } = parseArgs(process.argv.slice(2));

  if (command === 'models') {
    for (const [provider, models] of [
      ['anthropic', MODELS.filter((m) => m.provider === 'anthropic')],
      ['openai', MODELS.filter((m) => m.provider === 'openai')],
      ['google', MODELS.filter((m) => m.provider === 'google')],
    ] as const) {
      process.stdout.write(`\n${c.bold(PROVIDER_LABELS[provider])}\n`);
      for (const m of models) {
        process.stdout.write(
          `  ${m.id.padEnd(24)} ${c.dim(`$${m.pricing.input} in / $${m.pricing.output} out`)}${m.legacy ? c.dim('  superseded') : ''}\n`,
        );
      }
    }
    process.stdout.write(c.dim(`\nPrices last verified ${PRICES_VERIFIED_ON}.\n`));
    return;
  }

  if (!files.length) {
    process.stdout.write(HELP);
    process.exit(files.length ? 0 : 1);
  }

  if (!getModel(options.model)) {
    fail(`Unknown model "${options.model}". Run \`savedyouatoken models\` for the list.`);
  }
  if (options.json && options.contractJson) fail('Choose either --json or --contract-json, not both.');

  const counter = createCounterFromO200k((text) => encode(text), 'o200k_base');
  const toolsSource = options.toolsFile ? readFileSync(options.toolsFile, 'utf8') : '';

  const results: Array<{ file: string; result: AnalysisResult }> = [];
  const failures: string[] = [];

  for (const file of files) {
    let prompt: string;
    try {
      prompt = readFileSync(file, 'utf8');
    } catch {
      fail(`Cannot read ${file}`);
    }

    const result = analyze({
      prompt,
      toolsSource,
      modelId: options.model,
      aggressive: options.aggressive,
      counter,
      workload: {
        requestsPerDay: options.requestsPerDay,
        outputTokens: options.outputTokens,
        cacheHitRate: options.cacheHitRate,
        cacheTtl: '5m',
        batch: false,
      },
    });
    results.push({ file, result });

    if (options.maxTokens != null && result.inputTokens > options.maxTokens) {
      failures.push(
        `${file}: ${formatTokens(result.inputTokens)} tokens exceeds the budget of ${formatTokens(options.maxTokens)}`,
      );
    }
    if (options.maxMonthly != null && result.costNow.perMonth > options.maxMonthly) {
      failures.push(
        `${file}: ${formatUsd(result.costNow.perMonth)}/month exceeds the budget of ${formatUsd(options.maxMonthly)}`,
      );
    }

    if (options.fix && result.tokensRemoved > 0) {
      writeFileSync(file, result.optimizedPrompt, 'utf8');
    }
  }

  if (options.contractJson) {
    const generatedAt = new Date().toISOString();
    for (const [index, { result }] of results.entries()) {
      const workflowId = options.workflowId
        ? (results.length === 1 ? options.workflowId : `${options.workflowId}:${index + 1}`)
        : `cli-audit:${index + 1}`;
      const report = toReportEnvelope(result, {
        workflow: { id: workflowId },
        release: { id: options.releaseId ?? 'unversioned' },
        provenance: { producer: 'savedyouatoken', producerVersion: VERSION, generatedAt },
        maturity: { state: 'provisional', observations: 1 },
        window: { startedAt: generatedAt, endedAt: generatedAt, requests: 1 },
        engineVersion: ANALYSIS_ENGINE_VERSION,
        rulesetId: RULESET_ID,
      });
      process.stdout.write(canonicalStringify(report) + '\n');
    }
  } else if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          model: options.model,
          pricesVerifiedOn: PRICES_VERIFIED_ON,
          files: results.map(({ file, result }) => ({
            file,
            inputTokens: result.inputTokens,
            promptTokens: result.promptTokens,
            toolTokens: result.toolTokens,
            optimizedTokens: result.optimizedTokens,
            tokensRemoved: result.tokensRemoved,
            costPerRequest: result.costNow.perRequest,
            costPerMonth: result.costNow.perMonth,
            rewriteSavingPerMonth: result.monthlyRewriteSaving,
            findings: result.findings.map((f) => ({
              id: f.ruleId,
              title: f.title,
              severity: f.severity,
              occurrences: f.occurrences,
              tokensSaved: f.tokensSaved,
              monthlySaving: f.monthlySaving,
              detail: f.detail,
            })),
          })),
          failures,
        },
        null,
        2,
      ) + '\n',
    );
  } else if (!options.quiet) {
    for (const { file, result } of results) printReport(file, result, options);

    if (results.length > 1) {
      const total = results.reduce((sum, r) => sum + r.result.costNow.perMonth, 0);
      const saving = results.reduce((sum, r) => sum + r.result.monthlyRewriteSaving, 0);
      process.stdout.write(
        `\n${c.bold('Total')}  ${formatUsd(total)}/month across ${results.length} prompts, ${c.green(formatUsd(saving))} recoverable by safe rewrite.\n`,
      );
    }
  }

  if (failures.length) {
    process.stderr.write('\n' + failures.map((f) => c.red(`FAIL  ${f}`)).join('\n') + '\n');
    process.exit(1);
  }
}

main();
