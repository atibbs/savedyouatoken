/**
 * Server-rendered HTML for the workbench — plain template strings, no framework, no build step,
 * so the whole workbench stays inside the CLI's single-file tsup bundle. Visual identity borrows
 * the product's palette (paper/ink/acid/orange/mint — see apps/web/app/globals.css) but uses the
 * system font stack rather than vendoring the web app's self-hosted Manrope/DM Mono files, which
 * would need new asset-bundling plumbing this tool doesn't otherwise need.
 *
 * Every value interpolated from stored data (workflow/release/model ids, and anything else that
 * ultimately came from a report a caller supplied) goes through `esc()` before reaching HTML —
 * these are operator-controlled strings, not prompt text, but a misbehaving integration could
 * still put HTML in a workflow id, and this is the only thing standing between that and script
 * injection into a page served on localhost.
 */

import type { ReportDiff } from '@savedyouatoken/core';
import type { ReportEnvelope } from '@savedyouatoken/core';
import type { BaselineApproval, IndexEntry } from './store';

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs === 0) return '$0';
  if (abs < 0.01) return `$${n.toFixed(4)}`;
  if (abs < 1) return `$${n.toFixed(3)}`;
  if (abs < 1000) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatTokens(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return iso;
  }
}

const STYLE = `
:root {
  --paper: #f6f4ed; --panel: #ffffff; --ink: #171713; --line: #d8d4c8;
  --muted: #57574f; --acid: #eaff3f; --orange: #ff6534; --mint: #bbf4da;
  --save: #0c6b3f; --warn: #9a6100; --danger: #b62b00;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
body {
  background: var(--paper); color: var(--ink); font-family: var(--font-sans);
  margin: 0; padding: 2rem 1.5rem 4rem; line-height: 1.5;
}
a { color: var(--ink); }
main { max-width: 860px; margin: 0 auto; }
header.top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1.5rem; }
header.top h1 { font-size: 1.1rem; margin: 0; }
header.top h1 a { text-decoration: none; }
.tag { background: var(--acid); padding: 0.1rem 0.4rem; font-size: 0.75rem; font-weight: 600; }
.card {
  background: var(--panel); border: 1px solid var(--line); box-shadow: 4px 4px 0 var(--ink);
  padding: 1rem 1.25rem; margin-bottom: 1rem;
}
.card h2, .card h3 { margin-top: 0; }
.muted { color: var(--muted); font-size: 0.875rem; }
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
th { color: var(--muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
.badge { display: inline-block; padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 600; border-radius: 3px; }
.badge.mature { background: var(--mint); color: var(--save); }
.badge.provisional { background: #fde68a; color: var(--warn); }
.badge.exact { background: var(--mint); color: var(--save); }
.badge.approximate { background: #fde68a; color: var(--warn); }
.badge.invalid { background: #fecaca; color: var(--danger); }
.delta-up { color: var(--danger); } .delta-down { color: var(--save); } .delta-flat { color: var(--muted); }
form.inline { display: inline; }
fieldset { border: 1px solid var(--line); margin: 1rem 0; }
legend { padding: 0 0.4rem; font-weight: 600; }
label { display: block; margin: 0.5rem 0 0.2rem; font-size: 0.875rem; }
input[type=text], input[type=number] { font-family: var(--font-mono); padding: 0.3rem; border: 1px solid var(--line); width: 100%; max-width: 220px; }
button, .btn {
  font-family: var(--font-sans); font-weight: 600; border: 1px solid var(--ink); background: var(--acid);
  padding: 0.5rem 1rem; cursor: pointer; box-shadow: 3px 3px 0 var(--ink); text-decoration: none; color: var(--ink);
  display: inline-block;
}
button.danger, .btn.danger { background: #fecaca; }
.caveat { border-left: 3px solid var(--warn); padding-left: 0.75rem; margin: 0.4rem 0; font-size: 0.875rem; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — savedyouatoken workbench</title>
<style>${STYLE}</style></head>
<body><main>
<header class="top"><h1><a href="/">savedyouatoken workbench</a></h1><span class="tag">local, prompt-free</span></header>
${body}
</main></body></html>`;
}

export function renderNotFound(): string {
  return layout('Not found', '<div class="card"><p>Not found. <a href="/">Back to workflows</a></p></div>');
}

export function renderError(message: string): string {
  return layout('Error', `<div class="card"><p><strong>Error:</strong> ${esc(message)}</p><p><a href="/">Back to workflows</a></p></div>`);
}

export function renderHome(entries: IndexEntry[]): string {
  const byWorkflow = new Map<string, IndexEntry[]>();
  for (const e of entries) {
    if (!byWorkflow.has(e.workflowId)) byWorkflow.set(e.workflowId, []);
    byWorkflow.get(e.workflowId)!.push(e);
  }
  const workflows = [...byWorkflow.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (!workflows.length) {
    return layout(
      'Workflows',
      '<div class="card"><h2>No reports yet</h2><p class="muted">Import a file with ' +
        '<code>savedyouatoken workbench import &lt;report.json&gt;</code>, or point the SDK\'s local ' +
        'sink at this server while it is running.</p></div>',
    );
  }

  const rows = workflows
    .map(([workflowId, list]) => {
      const latest = [...list].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]!;
      return `<tr>
        <td><a href="/workflow/${encodeURIComponent(workflowId)}">${esc(workflowId)}</a></td>
        <td>${list.length}</td>
        <td>${maturityBadge(latest.maturityState)}</td>
        <td class="num">${esc(latest.releaseId)}</td>
        <td class="muted">${formatDate(latest.receivedAt)}</td>
      </tr>`;
    })
    .join('');

  return layout(
    'Workflows',
    `<div class="card"><h2>Workflows</h2>
      <table><thead><tr><th>Workflow</th><th>Reports</th><th>Latest maturity</th><th>Latest release</th><th>Last received</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`,
  );
}

export function renderWorkflow(
  workflowId: string,
  entries: IndexEntry[],
  approval: BaselineApproval | undefined,
  token: string,
): string {
  const sorted = [...entries].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const rows = sorted
    .map((e) => {
      const isApproved = approval?.reportId === e.id;
      return `<tr>
        <td><a href="/report/${encodeURIComponent(e.id)}">${esc(e.releaseId)}</a>${isApproved ? ' <span class="badge mature">baseline</span>' : ''}</td>
        <td>${maturityBadge(e.maturityState)} <span class="muted">(${e.observations})</span></td>
        <td class="num">${formatTokens(e.inputTokens)}</td>
        <td class="num">${formatUsd(e.monthlyNow)}/mo</td>
        <td class="muted">${formatDate(e.receivedAt)}</td>
        <td><input type="checkbox" name="compare" value="${esc(e.id)}"></td>
      </tr>`;
    })
    .join('');

  const exportSection = approval
    ? `<div class="card"><h3>Exported policy</h3>
        <p class="muted">Baseline: release ${esc(getRelease(sorted, approval.reportId))}, approved ${formatDate(approval.approvedAt)}
        (${approval.enforcement} on breach).</p>
        <a class="btn" href="/export-policy?workflow=${encodeURIComponent(workflowId)}&amp;token=${encodeURIComponent(token)}">Download policy.json</a>
      </div>`
    : `<div class="card"><p class="muted">No approved baseline yet. Open a report below and approve it as the baseline
        to enable policy export.</p></div>`;

  return layout(
    workflowId,
    `<div class="card"><h2>${esc(workflowId)}</h2>
      <form action="/compare" method="get">
      <table><thead><tr><th>Release</th><th>Maturity</th><th>Input tokens</th><th>Monthly cost</th><th>Received</th><th>Compare</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="muted">Check exactly two releases, then:</p>
      <button type="submit" onclick="return prepareCompare(this.form)">Compare selected</button>
      </form>
    </div>
    ${exportSection}
    <script>
      function prepareCompare(form) {
        var boxes = form.querySelectorAll('input[name=compare]:checked');
        if (boxes.length !== 2) { alert('Select exactly two releases to compare.'); return false; }
        var params = new URLSearchParams();
        params.set('baseline', boxes[0].value);
        params.set('current', boxes[1].value);
        window.location = '/compare?' + params.toString();
        return false;
      }
    </script>`,
  );
}

function getRelease(entries: IndexEntry[], reportId: string): string {
  return entries.find((e) => e.id === reportId)?.releaseId ?? reportId;
}

export function renderReport(id: string, report: ReportEnvelope, approval: BaselineApproval | undefined, token: string): string {
  const caveats = explainCaveats(report);
  const isApproved = approval?.reportId === id;

  const findingRows = report.analysis.findings
    .map((f) => `<tr><td class="num">${esc(f.ruleId)}</td><td>${esc(f.severity)}</td><td class="num">${f.occurrences}</td><td class="num">${formatUsd(f.monthlySaving)}/mo</td></tr>`)
    .join('');

  return layout(
    `${report.workflow.id} @ ${report.release.id}`,
    `<div class="card">
      <h2>${esc(report.workflow.id)} <span class="muted">/ ${esc(report.release.id)}</span></h2>
      <p>${maturityBadge(report.maturity.state)} <span class="muted">${report.maturity.observations} observation(s)</span></p>
      <p class="muted">Model <span class="num">${esc(report.analysis.modelId)}</span> ·
        Contract v${report.contract.version.major}.${report.contract.version.minor} ·
        Catalogue ${esc(report.catalogue.modelCatalogueDate)} ·
        Received ${formatDate(report.provenance.generatedAt)}</p>
      <p class="num">${formatTokens(report.analysis.inputTokens)} input tokens · ${formatUsd(report.analysis.monthlyNow)}/month</p>
      ${caveats.map((c) => `<div class="caveat">${esc(c)}</div>`).join('')}
    </div>
    ${
      findingRows
        ? `<div class="card"><h3>Findings</h3><table><thead><tr><th>Rule</th><th>Severity</th><th>Occurrences</th><th>Monthly saving</th></tr></thead><tbody>${findingRows}</tbody></table></div>`
        : ''
    }
    <div class="card">
      <h3>Baseline approval</h3>
      ${isApproved ? '<p><span class="badge mature">This is the approved baseline for this workflow.</span></p>' : ''}
      <form method="post" action="/approve-baseline">
        <input type="hidden" name="token" value="${esc(token)}">
        <input type="hidden" name="reportId" value="${esc(id)}">
        ${report.maturity.state !== 'mature' ? '<label><input type="checkbox" name="acknowledgeProvisional"> I understand this evidence is provisional and its workload estimate may be unstable.</label>' : ''}
        <fieldset><legend>Tolerance (leave blank to skip a budget)</legend>
          <label>Max input tokens<input type="number" name="maxInputTokens"></label>
          <label>Max monthly cost (USD)<input type="number" name="maxMonthlyCost" step="0.01"></label>
          <label>Max token regression %<input type="number" name="maxTokenRegressionPercent"></label>
          <label>Max cost regression %<input type="number" name="maxCostRegressionPercent"></label>
          <label>Enforcement
            <select name="enforcement"><option value="warn">warn</option><option value="fail">fail</option></select>
          </label>
        </fieldset>
        <button type="submit">Approve as baseline</button>
      </form>
    </div>
    <p><a href="/workflow/${encodeURIComponent(report.workflow.id)}">&larr; Back to ${esc(report.workflow.id)}</a></p>`,
  );
}

export function renderCompare(
  baselineId: string,
  currentId: string,
  baseline: ReportEnvelope,
  current: ReportEnvelope,
  diff: ReportDiff,
): string {
  const compat = diff.compatibility;
  const compatNote =
    compat.status === 'invalid'
      ? `<div class="card"><span class="badge invalid">invalid</span> <strong>Cannot compare:</strong> ${esc(compat.reasons.join(', '))}.</div>`
      : compat.status === 'approximate'
        ? `<div class="caveat">Approximate comparison: ${esc(compat.reasons.join(', '))}. Treat the delta as directional.</div>`
        : '';

  const deltaTable =
    diff.tokens && diff.cost
      ? `<table><thead><tr><th>Metric</th><th>Baseline</th><th>Current</th><th>&Delta;</th></tr></thead><tbody>
          ${deltaRow('Input tokens', diff.tokens.inputTokens, formatTokens)}
          ${deltaRow('Monthly cost', diff.cost.monthlyNow, formatUsd)}
          ${deltaRow('After rewrite', diff.cost.monthlyAfterRewrite, formatUsd)}
        </tbody></table>`
      : '';

  const findingRows = (diff.findings ?? [])
    .filter((f) => f.status !== 'unchanged')
    .map((f) => `<tr><td class="num">${esc(f.ruleId)}</td><td>${esc(f.status)}</td></tr>`)
    .join('');

  return layout(
    'Compare',
    `<div class="card"><h2>Compare</h2>
      <p class="muted">Baseline release ${esc(baseline.release.id)} (<a href="/report/${encodeURIComponent(baselineId)}">detail</a>)
        vs. current release ${esc(current.release.id)} (<a href="/report/${encodeURIComponent(currentId)}">detail</a>).</p>
    </div>
    ${compatNote}
    ${deltaTable ? `<div class="card">${deltaTable}</div>` : ''}
    ${
      findingRows
        ? `<div class="card"><h3>Finding changes</h3><table><thead><tr><th>Rule</th><th>Status</th></tr></thead><tbody>${findingRows}</tbody></table></div>`
        : ''
    }
    <p><em class="muted">Cost-only evidence, not a quality signal — review before trusting a rewrite.</em></p>`,
  );
}

export function renderDeleteConfirm(dataDir: string, token: string): string {
  return layout(
    'Delete all local data',
    `<div class="card">
      <h2>Delete all local workbench data</h2>
      <p>This permanently removes every stored report, the index, and every recorded baseline
      approval at <span class="num">${esc(dataDir)}</span>. It does not touch any source policy
      file you have already committed to a repository.</p>
      <form method="post" action="/api/delete">
        <input type="hidden" name="token" value="${esc(token)}">
        <label><input type="text" name="confirm" placeholder='Type "delete" to confirm'></label>
        <button type="submit" class="danger">Delete everything</button>
      </form>
    </div>`,
  );
}

function deltaRow(label: string, field: { baseline: number; current: number; delta: number; percent: number | null }, format: (n: number) => string): string {
  const cls = field.delta > 0 ? 'delta-up' : field.delta < 0 ? 'delta-down' : 'delta-flat';
  const sign = field.delta > 0 ? '+' : '';
  const pct = field.percent == null ? '' : ` (${sign}${field.percent.toFixed(1)}%)`;
  return `<tr><td>${esc(label)}</td><td class="num">${format(field.baseline)}</td><td class="num">${format(field.current)}</td><td class="num ${cls}">${sign}${format(field.delta)}${pct}</td></tr>`;
}

function maturityBadge(state: 'provisional' | 'mature'): string {
  return `<span class="badge ${state}">${state}</span>`;
}

const STALE_CATALOGUE_DAYS = 90;

/** Human-readable caveats about a report's evidence quality — task 3.3: provisional thresholds,
 *  stale catalogues, and incomplete workload evidence should be explained, not left implicit in
 *  a hash or a raw number. */
export function explainCaveats(report: ReportEnvelope): string[] {
  const caveats: string[] = [];
  if (report.maturity.state !== 'mature') {
    caveats.push(
      `Provisional evidence: only ${report.maturity.observations} observation(s). ` +
        'The workload estimate (requests/day, cache hit rate) may not reflect steady-state traffic yet.',
    );
  }
  const catalogueAgeDays = daysSince(report.catalogue.modelCatalogueDate);
  if (catalogueAgeDays != null && catalogueAgeDays > STALE_CATALOGUE_DAYS) {
    caveats.push(`Pricing catalogue is ${catalogueAgeDays} days old (as of ${report.catalogue.modelCatalogueDate}) — prices may have changed since.`);
  }
  if (report.window.requests <= 1 && report.maturity.state === 'provisional') {
    caveats.push('This report reflects a single request, not aggregated production traffic — treat cost projections as illustrative only.');
  }
  return caveats;
}

function daysSince(dateOnly: string): number | null {
  const then = Date.parse(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}
