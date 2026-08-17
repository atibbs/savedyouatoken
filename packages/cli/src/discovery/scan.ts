import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fail } from '../support';
import { classifyFile } from './adapters';
import { isDirectoryIgnored, isIgnored } from './ignore';
import { DEFAULT_DISCOVERY_CONFIG, DEFAULT_IGNORE, type AssetCandidate, type DiscoveryConfig, type DiscoveryResult } from './types';

const DEFAULT_CONFIG_FILENAME = 'savedyouatoken.discovery.json';

export function loadDiscoveryConfig(configPath: string | undefined, cwd = process.cwd()): DiscoveryConfig {
  const path = configPath ?? defaultConfigPath(cwd);
  if (!path) return { ...DEFAULT_DISCOVERY_CONFIG };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return fail(`Cannot read discovery config ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const obj = (raw ?? {}) as { roots?: unknown; ignore?: unknown };
  const roots = isStringArray(obj.roots) ? obj.roots : DEFAULT_DISCOVERY_CONFIG.roots;
  const extraIgnore = isStringArray(obj.ignore) ? obj.ignore : [];
  return { roots, ignore: [...DEFAULT_IGNORE, ...extraIgnore] };
}

function defaultConfigPath(cwd: string): string | undefined {
  const path = join(cwd, DEFAULT_CONFIG_FILENAME);
  return existsSync(path) ? path : undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

export function scan(config: DiscoveryConfig, cwd = process.cwd()): DiscoveryResult {
  const candidates: AssetCandidate[] = [];
  const seen = new Set<string>();
  for (const root of config.roots) {
    walk(join(cwd, root), cwd, config, candidates, seen);
  }
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  return { config, candidates };
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function walk(absDir: string, cwd: string, config: DiscoveryConfig, out: AssetCandidate[], seen: Set<string>): void {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absPath = join(absDir, entry.name);
    const relPath = toPosix(relative(cwd, absPath));
    if (!relPath || seen.has(relPath)) continue;

    let stat;
    try {
      stat = lstatSync(absPath);
    } catch {
      continue;
    }

    if (stat.isSymbolicLink()) {
      // Symlinked directories are skipped outright rather than reported, since following one
      // risks an unbounded or cyclic walk; a symlinked file is reported so it is never silently
      // audited as if it were a real, owned copy of the asset it points to.
      if (entry.isDirectory()) continue;
      seen.add(relPath);
      out.push({ id: relPath, path: relPath, status: 'excluded', reason: 'symlink' });
      continue;
    }

    if (entry.isDirectory()) {
      if (!isDirectoryIgnored(relPath, config.ignore)) walk(absPath, cwd, config, out, seen);
      continue;
    }

    if (!entry.isFile()) continue;
    seen.add(relPath);

    if (isIgnored(relPath, config.ignore)) {
      out.push({ id: relPath, path: relPath, status: 'excluded', reason: 'matched an ignore pattern' });
      continue;
    }

    if (sniffIsBinary(absPath)) {
      out.push({ id: relPath, path: relPath, status: 'excluded', reason: 'binary content' });
      continue;
    }

    const classification = classifyFile(relPath, () => {
      try {
        return readFileSync(absPath, 'utf8');
      } catch {
        return null;
      }
    });
    if (!classification) continue; // no adapter recognises this file — it is not a candidate at all

    out.push({
      id: relPath,
      path: relPath,
      assetClass: classification.assetClass,
      status: classification.status,
      reason: classification.reason,
    });
  }
}

function sniffIsBinary(absPath: string): boolean {
  let fd: number;
  try {
    fd = openSync(absPath, 'r');
  } catch {
    return false;
  }
  try {
    const buffer = Buffer.alloc(8000);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}
