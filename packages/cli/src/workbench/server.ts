/**
 * The workbench's loopback-only HTTP server. There is no HTTP server anywhere else in this repo
 * (the web app is a separate Next.js deployment) — this is new, minimal, dependency-free
 * plumbing built directly on `node:http`.
 *
 * Every route either reads local history (no auth — pure navigation) or changes local state
 * (`/ingest`, `/approve-baseline`, `/api/delete`), which all require the server's ephemeral
 * token. The token doubles as SDK/CLI bearer auth for `/ingest` and as a CSRF defense for the
 * UI's own forms: the server embeds it in every page it renders, so only that page — never a
 * different origin — can submit a valid mutating request.
 */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { type EnforcementSeverity, type PolicyBudgets, canonicalStringify, diffReports } from '@savedyouatoken/core';
import { buildExportedPolicy } from './policy';
import {
  MAX_REPORT_BYTES,
  type BaselineApproval,
  deleteStore,
  getReport,
  ingestReport,
  latestBaselineApproval,
  listReports,
  recordBaselineApproval,
  resolveDataDir,
} from './store';
import {
  renderCompare,
  renderDeleteConfirm,
  renderError,
  renderHome,
  renderNotFound,
  renderReport,
  renderWorkflow,
} from './ui';

export interface WorkbenchServerOptions {
  port?: number;
  dataDir?: string;
}

export interface WorkbenchServer {
  url: string;
  token: string;
  dataDir: string;
  port: number;
  close(): Promise<void>;
}

const MAX_PORT_ATTEMPTS = 10;
const MAX_BODY_BYTES = MAX_REPORT_BYTES + 4096; // headroom for JSON wrapper/form fields

export async function startWorkbenchServer(options: WorkbenchServerOptions = {}): Promise<WorkbenchServer> {
  const dataDir = resolveDataDir(options.dataDir);
  const token = randomBytes(24).toString('hex');
  const requestedPort = options.port;

  const server = createServer((req, res) => {
    handleRequest(req, res, { dataDir, token }).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal error: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  const port = await listen(server, requestedPort);
  const address = `http://127.0.0.1:${port}`;

  return {
    url: address,
    token,
    dataDir,
    port,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function listen(server: ReturnType<typeof createServer>, requestedPort: number | undefined): Promise<number> {
  const candidates = requestedPort != null ? [requestedPort] : Array.from({ length: MAX_PORT_ATTEMPTS }, (_, i) => 4590 + i);

  return new Promise((resolve, reject) => {
    let index = 0;
    const tryNext = () => {
      const port = candidates[index];
      if (port == null) {
        reject(new Error(`Could not find a free port after ${candidates.length} attempts.`));
        return;
      }
      const onError = (err: NodeJS.ErrnoException) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE' && requestedPort == null) {
          index++;
          tryNext();
        } else if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use. Pass --port to choose another.`));
        } else {
          reject(err);
        }
      };
      const onListening = () => {
        server.removeListener('error', onError);
        // `server.address().port` is authoritative, not the requested `port` value: a caller
        // may pass 0 to ask the OS for any free port, in which case the requested value itself
        // is never the real one.
        const address = server.address();
        resolve(typeof address === 'object' && address ? address.port : port);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    };
    tryNext();
  });
}

interface Context {
  dataDir: string;
  token: string;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void> {
  // This is a short-lived local process, not a server tuned for throughput, so there is no real
  // cost to closing each connection after its response — and it sidesteps a real class of bugs
  // where a client's keep-alive pool reuses a socket across a server restart on the same port
  // (this happens routinely here: `workbench start` picks a low, predictable port range).
  res.setHeader('Connection', 'close');
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, dataDir: ctx.dataDir });
  }
  if (method === 'GET' && url.pathname === '/') return handleHome(res, ctx);
  if (method === 'GET' && url.pathname.startsWith('/workflow/')) {
    return handleWorkflow(res, ctx, decodeURIComponent(url.pathname.slice('/workflow/'.length)));
  }
  if (method === 'GET' && url.pathname.startsWith('/report/')) {
    return handleReport(res, ctx, decodeURIComponent(url.pathname.slice('/report/'.length)));
  }
  if (method === 'GET' && url.pathname === '/compare') return handleCompare(res, ctx, url.searchParams);
  if (method === 'GET' && url.pathname === '/export-policy') return handleExportPolicy(res, ctx, url.searchParams);
  if (method === 'GET' && url.pathname === '/delete') return html(res, 200, renderDeleteConfirm(ctx.dataDir, ctx.token));

  if (method === 'POST' && url.pathname === '/ingest') return handleIngest(req, res, ctx);
  if (method === 'POST' && url.pathname === '/approve-baseline') return handleApprove(req, res, ctx);
  if (method === 'POST' && url.pathname === '/api/delete') return handleDelete(req, res, ctx);

  return html(res, 404, renderNotFound());
}

// ------------------------------------------------------------------------------------- read UI

function handleHome(res: ServerResponse, ctx: Context): void {
  html(res, 200, renderHome(listReports(ctx.dataDir)));
}

function handleWorkflow(res: ServerResponse, ctx: Context, workflowId: string): void {
  const reports = listReports(ctx.dataDir).filter((r) => r.workflowId === workflowId);
  if (!reports.length) return html(res, 404, renderNotFound());
  html(res, 200, renderWorkflow(workflowId, reports, latestBaselineApproval(ctx.dataDir, workflowId), ctx.token));
}

function handleReport(res: ServerResponse, ctx: Context, id: string): void {
  const report = getReport(ctx.dataDir, id);
  if (!report) return html(res, 404, renderNotFound());
  const approval = latestBaselineApproval(ctx.dataDir, report.workflow.id);
  html(res, 200, renderReport(id, report, approval, ctx.token));
}

function handleCompare(res: ServerResponse, ctx: Context, params: URLSearchParams): void {
  const baselineId = params.get('baseline');
  const currentId = params.get('current');
  if (!baselineId || !currentId) return html(res, 400, renderError('compare requires both ?baseline= and ?current= report ids.'));
  const baseline = getReport(ctx.dataDir, baselineId);
  const current = getReport(ctx.dataDir, currentId);
  if (!baseline || !current) return html(res, 404, renderNotFound());
  const diff = diffReports(baseline, current);
  html(res, 200, renderCompare(baselineId, currentId, baseline, current, diff));
}

// ------------------------------------------------------------------------------- policy export

function handleExportPolicy(res: ServerResponse, ctx: Context, params: URLSearchParams): void {
  if (!requireToken(params.get('token'), ctx.token)) return unauthorized(res);
  const workflowId = params.get('workflow');
  if (!workflowId) return html(res, 400, renderError('export-policy requires ?workflow='));

  const result = buildExportedPolicy(ctx.dataDir, workflowId);
  if (!result.ok) return html(res, 400, renderError(result.error));

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="${sanitizeFilename(workflowId)}.policy.json"`,
  });
  res.end(canonicalStringify(result.policy) + '\n');
}

// ------------------------------------------------------------------------------------- mutate

async function handleIngest(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ctx.token}`) return unauthorized(res);
  const originError = checkOrigin(req, ctx);
  if (originError) return json(res, 403, { ok: false, error: originError });

  const body = await readBody(req, MAX_BODY_BYTES);
  if (body === null) return json(res, 413, { ok: false, error: 'Payload too large' });

  const result = await ingestReport(ctx.dataDir, body);
  if (!result.ok) return json(res, 422, { ok: false, errors: result.errors });
  json(res, result.isNew ? 201 : 200, { ok: true, id: result.id, isNew: result.isNew });
}

async function handleApprove(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void> {
  const body = await readBody(req, MAX_BODY_BYTES);
  if (body === null) return json(res, 413, { ok: false, error: 'Payload too large' });
  const form = new URLSearchParams(body);

  if (!requireToken(form.get('token'), ctx.token)) return unauthorized(res);
  const originError = checkOrigin(req, ctx);
  if (originError) return json(res, 403, { ok: false, error: originError });

  const reportId = form.get('reportId');
  if (!reportId) return html(res, 400, renderError('Missing reportId.'));
  const report = getReport(ctx.dataDir, reportId);
  if (!report) return html(res, 404, renderNotFound());

  if (report.maturity.state !== 'mature' && form.get('acknowledgeProvisional') !== 'on') {
    return html(
      res,
      400,
      renderError(
        `This report is provisional (${report.maturity.observations} observation(s)). ` +
          'Approving it as a baseline requires explicitly acknowledging the provisional evidence.',
      ),
    );
  }

  const tolerance: PolicyBudgets = {};
  const maxInputTokens = numberField(form, 'maxInputTokens');
  const maxMonthlyCost = numberField(form, 'maxMonthlyCost');
  const maxTokenRegressionPercent = numberField(form, 'maxTokenRegressionPercent');
  const maxCostRegressionPercent = numberField(form, 'maxCostRegressionPercent');
  if (maxInputTokens != null) tolerance.maxInputTokens = maxInputTokens;
  if (maxMonthlyCost != null) tolerance.maxMonthlyCost = maxMonthlyCost;
  if (maxTokenRegressionPercent != null) tolerance.maxTokenRegressionPercent = maxTokenRegressionPercent;
  if (maxCostRegressionPercent != null) tolerance.maxCostRegressionPercent = maxCostRegressionPercent;

  const approval: Omit<BaselineApproval, 'id'> = {
    reportId,
    workflowId: report.workflow.id,
    approvedAt: new Date().toISOString(),
    acknowledgedProvisional: report.maturity.state !== 'mature',
    tolerance,
    enforcement: (form.get('enforcement') === 'fail' ? 'fail' : 'warn') as EnforcementSeverity,
  };
  recordBaselineApproval(ctx.dataDir, approval);

  redirect(res, `/workflow/${encodeURIComponent(report.workflow.id)}`);
}

async function handleDelete(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void> {
  const body = await readBody(req, MAX_BODY_BYTES);
  if (body === null) return json(res, 413, { ok: false, error: 'Payload too large' });
  const form = new URLSearchParams(body);

  if (!requireToken(form.get('token'), ctx.token)) return unauthorized(res);
  const originError = checkOrigin(req, ctx);
  if (originError) return json(res, 403, { ok: false, error: originError });
  if (form.get('confirm') !== 'delete') {
    return html(res, 400, renderError('Deletion requires explicit confirmation.'));
  }

  deleteStore(ctx.dataDir);
  redirect(res, '/');
}

// --------------------------------------------------------------------------------------- utils

function requireToken(supplied: string | null, expected: string): boolean {
  return supplied === expected;
}

/** Cross-origin fetch/XHR carries an Origin header that must match this server's own origin; a
 *  same-machine, non-browser caller (curl, the SDK, the CLI) sends no Origin at all and is
 *  allowed through on the strength of the token check alone. */
function checkOrigin(req: IncomingMessage, ctx: Context): string | null {
  const origin = req.headers.origin;
  if (!origin) return null;
  const host = req.headers.host;
  if (origin !== `http://${host}` && origin !== `http://127.0.0.1:${host?.split(':')[1] ?? ''}`) {
    return 'Origin mismatch';
  }
  return null;
}

function numberField(form: URLSearchParams, key: string): number | undefined {
  const raw = form.get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let total = 0;
    let tooLarge = false;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        // Keep draining rather than destroying the socket: cutting the connection mid-request
        // (before a response is sent) reads to the client as a connection reset rather than a
        // clean 413. Dropping the chunks bounds memory while still letting the stream finish.
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooLarge ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

function unauthorized(res: ServerResponse): void {
  json(res, 401, { ok: false, error: 'Missing or invalid token' });
}
