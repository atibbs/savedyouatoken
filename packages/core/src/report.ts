/**
 * Shareable report encoding.
 *
 * The share link carries the *report*, never the prompt. That is a privacy decision first
 * — a prompt is often the most commercially sensitive text a team owns — and a zero-cost
 * infrastructure decision second: because the payload is small, it fits in a URL fragment
 * and needs no database, no object storage and no server.
 */

import type { AnalysisResult } from './analyze';
import type { Workload } from './cost';

export const REPORT_VERSION = 2;

export interface SharedFinding {
  id: string;
  title: string;
  occurrences: number;
  tokensSaved: number;
  monthlySaving: number;
  /**
   * The rule's generic, static one-liner — NOT the per-prompt `detail`. `detail` is written
   * for the specific prompt and can embed captured content (e.g. a tool's name), so it must
   * never be transmitted. `title` and `summary` are fixed rule text, so a shared report
   * carries no prompt- or tool-derived strings by construction.
   */
  summary: string;
}

export interface SharedReport {
  v: number;
  modelId: string;
  workload: Workload;
  promptTokens: number;
  inputTokens: number;
  toolTokens: number;
  optimizedTokens: number;
  monthlyNow: number;
  monthlyAfterRewrite: number;
  cacheSaving: number;
  findings: SharedFinding[];
  createdAt: string;
}

export function toSharedReport(result: AnalysisResult): SharedReport {
  return {
    v: REPORT_VERSION,
    modelId: result.model.id,
    workload: result.workload,
    promptTokens: result.promptTokens,
    inputTokens: result.inputTokens,
    toolTokens: result.toolTokens,
    optimizedTokens: result.optimizedTokens,
    monthlyNow: round2(result.costNow.perMonth),
    monthlyAfterRewrite: round2(result.costAfterRewrite.perMonth),
    cacheSaving: round2(result.cache.monthlySaving),
    findings: result.findings.map((f) => ({
      id: f.ruleId,
      title: f.title,
      occurrences: f.occurrences,
      tokensSaved: Math.round(f.tokensSaved),
      monthlySaving: round2(f.monthlySaving),
      // Static rule text only — never f.detail, which can embed captured tool names.
      summary: f.summary,
    })),
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const HAS_COMPRESSION =
  typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function';

/** Encode a report for a URL fragment. Prefix marks the encoding so it stays upgradeable. */
export async function encodeReport(report: SharedReport): Promise<string> {
  const json = JSON.stringify(report);
  if (!HAS_COMPRESSION) return `j${base64UrlEncode(new TextEncoder().encode(json))}`;
  const bytes = await streamThrough(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return `z${base64UrlEncode(bytes)}`;
}

export async function decodeReport(encoded: string): Promise<SharedReport | null> {
  try {
    const marker = encoded[0];
    const body = base64UrlDecode(encoded.slice(1));
    let json: string;
    if (marker === 'z') {
      if (!HAS_COMPRESSION) return null;
      json = new TextDecoder().decode(await streamThrough(body, new DecompressionStream('deflate-raw')));
    } else if (marker === 'j') {
      json = new TextDecoder().decode(body);
    } else {
      return null;
    }
    const parsed = JSON.parse(json) as SharedReport;
    if (parsed.v !== REPORT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function streamThrough(input: Uint8Array, transform: TransformStream): Promise<Uint8Array> {
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(transform);
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
