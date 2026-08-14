# Report, baseline, and policy contracts

Saved You a Token uses versioned, prompt-free JSON contracts to move audit evidence between the
SDK, CLI, local tools, third-party integrations, and a future Monitor. The TypeScript definitions
and dependency-free validators in `packages/core/src/contracts.ts` are authoritative. JSON Schemas,
fixtures, and canonical test vectors live under `packages/core/contracts/`.

## Existing-format inventory

| Format | Producer | Purpose | Important limitation |
|---|---|---|---|
| `SharedReport` v2 | Web share-link codec and SDK legacy sinks | Compact URL-fragment receipt | No workflow, release, maturity, observation window, engine, or policy context |
| SDK `AuditEvent` | `@savedyouatoken/sdk` callbacks | In-process analysis and sink delivery | Full `result` contains prompt-derived detail; legacy `report` is compact only |
| CLI `--json` | `savedyouatoken` | Existing automation output and budget failures | File-oriented aggregate; finding `detail` can contain prompt-derived content |
| Core `Workload` | All analysis surfaces | Pricing assumptions | No observation maturity or evidence window |
| Core `Finding` | Analysis engine | UI and local diagnosis | `detail`, ranges, and edits are intentionally not portable |
| CLI token/cost flags | CLI | Absolute CI limits | No portable baseline or regression policy document |

These formats remain supported. The portable contract is additive: SDK analysis events expose
`portableReport`, and the CLI exposes `--contract-json`. Existing `report`, share links, and
`--json` output do not change.

## Version lifecycle

Contract versions are `{ major, minor }` integers and are independent of npm package versions.

- Major changes are breaking. Consumers reject unknown major versions with
  `unsupported_major` and a JSONPath-like location.
- Minor changes are additive. Consumers ignore unknown optional fields in the supported major.
- The current version is 1.1. Version 1.0 is supported and migrates deterministically to 1.1.
- Migration records the original version in `provenance.sourceContractVersion`.
- A supported major is deprecated only after a successor has shipped with fixtures, migrations,
  and at least one full product release of overlap. Removal requires a major contract release.

## Documents

### Report

A report separates observed facts from later policy. It contains:

- stable workflow and release identity;
- producer and source-version provenance;
- provisional or mature measurement state and observation count;
- the observation window;
- engine, ruleset, model-catalogue, currency, and tokenizer metadata;
- workload assumptions; and
- prompt-free analysis totals plus static rule identifiers.

It never contains prompt text, tool names, descriptions, schemas, source paths, rewrites, ranges,
edits, or per-prompt finding detail.

### Baseline

A baseline is an immutable reference to a report content identity plus the workflow and release it
represents. It does not copy mutable report data.

### Policy

A policy targets a workflow, may reference a baseline identity, fixes its pricing assumptions, and
defines one or more absolute or regression limits:

- maximum input tokens;
- maximum monthly cost;
- maximum token regression percentage; and
- maximum cost regression percentage.

`enforcement` determines whether a breach produces `warn` or `fail`. Evaluation is deterministic;
an incompatible baseline is rejected rather than partially evaluated.

## Validation and compatibility

Parsers return either `{ ok: true, value }` or `{ ok: false, errors }`. Errors contain a stable
`code`, JSONPath-like `path`, and human-readable `message`. Codes are `required`, `invalid_type`,
`invalid_value`, `unsupported_major`, and `semantic_error`.

Report comparisons are:

- **exact** when workflow, model, contract, engine, ruleset, catalogue, currency, and mature
  measurement context match;
- **approximate** for supported minor, engine, ruleset, catalogue-date, or provisional differences;
  and
- **invalid** across contract majors, workflows, currencies, or models.

## Canonical bytes and identity

Canonical JSON sorts object keys, normalizes strings to Unicode NFC, omits `undefined`, preserves
array order, normalizes negative zero, and rejects non-finite numbers. `contentIdentity()` hashes
the validated canonical UTF-8 bytes with SHA-256 and returns `sha256:<hex>`.

Never hash raw incoming JSON: validation, migration, and removal of unknown optional fields happen
before canonicalization. Published vectors make parity testable outside TypeScript.

## Integration examples

```ts
import {
  contentIdentity,
  parsePolicyDocument,
  parseReportEnvelope,
} from '@savedyouatoken/core';

const parsed = parseReportEnvelope(JSON.parse(reportJson));
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
console.log(await contentIdentity(parsed.value));
```

```bash
npx savedyouatoken prompts/support.txt \
  --contract-json \
  --workflow support/triage \
  --release "$GIT_SHA"
```

For the SDK, set `reportContext` and read `event.portableReport` from a callback sink. Existing sinks
can continue reading `event.report` during migration.

## Legacy share-link boundary

`SharedReport` v2 and its `j`/`z` URL-fragment codec remain frozen. Existing links continue to decode
exactly as before. A portable report may be created after decoding only when the caller supplies the
workflow, release, provenance, maturity, window, and catalogue context that the legacy payload lacks.
The decoder must not invent that evidence, and portable report identities are never substituted for
legacy share fragments.
