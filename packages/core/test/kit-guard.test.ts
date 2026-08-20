import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { MODELS } from '../src/models';

// Launcher-not-snapshot guard: the downloadable agent kit must invoke the live CLI and embed
// NO pricing-catalogue data, so a frozen copy can never quote stale prices with confidence.
// This fails if any kit file contains a catalogue model id or a price-shaped token.

const kitDir = fileURLToPath(new URL('../../../kit/', import.meta.url));

function kitFiles(): string[] {
  return readdirSync(kitDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? kitDir, e.name));
}

const files = kitFiles();
const modelIds = MODELS.map((m) => m.id);
// e.g. "$5 / MTok", "$2.50 per million", "$0.50/MTok"
const PRICE_TOKEN = /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:\/\s*mtok|per\s+million|\/\s*million)/i;

describe('agent kit is a launcher, not a snapshot', () => {
  it('ships at least the expected files', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('SKILL.md'))).toBe(true);
  });

  it('embeds no catalogue model id or price token', () => {
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const leakedModel = modelIds.find((id) => content.includes(id));
      expect(leakedModel, `${file} embeds catalogue model id "${leakedModel}"`).toBeUndefined();
      expect(PRICE_TOKEN.test(content), `${file} embeds a price token`).toBe(false);
    }
  });
});
