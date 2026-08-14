/**
 * Verify the PACKED SDK's declarations from a clean consumer's point of view, under the strict
 * `moduleResolution: NodeNext` — the setting that exposes both failure modes this package has hit:
 * a bare `@savedyouatoken/core` import (TS2307) and extensionless relative ESM specifiers (TS2834).
 *
 *   node verify-packed-types.mjs [tarball]
 *
 * With no argument it runs `npm pack` (→ prepack build) and verifies that fresh tarball —
 * the mode CI-on-PR and `npm run verify:sdk-types` use. Given a tarball path it verifies THOSE
 * exact bytes, so the release workflow can verify the very artifact it is about to publish.
 *
 * Either way it extracts into a throwaway consumer project that has ONLY the SDK (no core, no
 * workspace resolution) and type-checks a small program touching the public API — with
 * `skipLibCheck: false`, so every shipped `.d.ts` is checked. Exits non-zero on any type error.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdkRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const providedTarball = process.argv[2] ? resolve(process.argv[2]) : undefined;

const work = mkdtempSync(join(tmpdir(), 'syat-sdk-consumer-'));
try {
  // 1. Obtain the tarball to verify — either the exact one passed in, or a fresh `npm pack`
  //    (which runs prepack → build). Then extract into the consumer's node_modules.
  let tarballPath = providedTarball;
  if (!tarballPath) {
    const name = execFileSync('npm', ['pack', '--pack-destination', work, '--silent'], {
      cwd: sdkRoot,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .pop();
    tarballPath = join(work, name);
  }
  const consumer = join(work, 'consumer');
  const pkgDir = join(consumer, 'node_modules', '@savedyouatoken', 'sdk');
  mkdirSync(pkgDir, { recursive: true });
  execFileSync('tar', ['xzf', tarballPath, '-C', work], { stdio: 'inherit' });
  cpSync(join(work, 'package'), pkgDir, { recursive: true });

  // 2. A clean consumer: NodeNext resolution, strict, skipLibCheck OFF.
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
      },
      include: ['index.ts'],
    }),
  );
  writeFileSync(
    join(consumer, 'index.ts'),
    `import {
  wrapOpenAI, wrapAnthropic, createAuditor, anthropicAdapter, openaiAdapter,
  consoleSink, fileSink, callbackSink, callbackHealthDestination, dashboardSink, noopSink, normaliseModelId,
  type AuditEvent, type AuditorOptions, type CapturedRequest, type RequestAdapter,
  type PortableReportContext, type ReportEnvelope, type HealthEvent, type SdkOperationsConfiguration,
} from '@savedyouatoken/sdk';

const reportContext: PortableReportContext = { workflowId: 'support/triage', releaseId: 'abc123' };
const operations: SdkOperationsConfiguration = {
  workflow: { name: 'Support triage', service: 'support-api', tags: { owner: 'platform' } },
  release: { commit: 'abc123' },
  health: callbackHealthDestination((event: HealthEvent) => void event.kind),
};
const opts: AuditorOptions = {
  operations,
  mask: (s: string) => s,
  sink: callbackSink((e: AuditEvent) => {
    if (e.kind === 'analysis') {
      const perMonth: number = e.result.costNow.perMonth;
      const model: string = e.result.model.id;
      const summaries: string[] = e.report.findings.map((f) => f.summary);
      const portable: ReportEnvelope = e.portableReport;
      const workflowName: string = e.operations.workflow.name;
      const progress: number = e.maturity.progress.overall;
      void perMonth; void model; void summaries; void portable; void workflowName; void progress;
    }
  }),
};
const auditor = createAuditor(anthropicAdapter, opts);
auditor.observe({ model: 'claude-sonnet-5', system: 'hi' });
const resolved = normaliseModelId('gpt-5.5');
void resolved.modelId;
void reportContext;
export { wrapOpenAI, wrapAnthropic, openaiAdapter, consoleSink, fileSink, dashboardSink, noopSink };
export type { CapturedRequest, RequestAdapter };
`,
  );

  // 3. Type-check the consumer. tsc exits non-zero (and prints diagnostics) on any error.
  execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
  console.log('verify-packed-types: clean NodeNext consumer type-checks against the packed SDK ✓');
} finally {
  rmSync(work, { recursive: true, force: true });
  // Drop the tarball npm pack may leave in the SDK root.
  for (const f of readdirSync(sdkRoot)) {
    if (/^savedyouatoken-sdk-.*\.tgz$/.test(f)) rmSync(join(sdkRoot, f), { force: true });
  }
}
