# Portable contracts

This directory is the language-neutral distribution of Saved You a Token's prompt-free interchange
contracts.

- `schemas/` contains JSON Schema 2020-12 documents for reports, baselines, and policies.
- `fixtures/` contains current valid, invalid, forward-compatible, and v1.0 migration examples.
- `vectors/` contains exact canonical UTF-8 JSON and SHA-256 identities.

The TypeScript definitions and dependency-free runtime validators in `../src/contracts.ts` are the
authoritative implementation. The core test suite validates every positive fixture against both the
published JSON Schema and runtime parser, checks the negative fixture against both, and asserts the
canonical vectors byte-for-byte.

See `docs/contracts.md` at the repository root for lifecycle, privacy, compatibility, and migration
rules.
