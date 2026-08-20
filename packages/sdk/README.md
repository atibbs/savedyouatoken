# @savedyouatoken/sdk

Wrap your Anthropic or OpenAI client and get a token-waste audit of the **real** request — the
fully-assembled system prompt, tool schemas and provider overhead your app actually sends, not
a copy you pasted into a box.

- **Zero latency.** The real call is untouched; the audit runs *after* the response returns, on
  a deferred macrotask. An audit failure never reaches your code.
- **Private by default.** No prompt or tool text leaves your process. Optional destinations
  transmit prompt-free reports, bounded operational metadata, or health classifications only.
- **Same numbers as the website.** It reuses `@savedyouatoken/core` verbatim, so findings and
  costs match [savedyouatoken.com](https://savedyouatoken.com) and the CLI exactly. No model is
  called.

## Install

```bash
npm install @savedyouatoken/sdk
```

## Use

```ts
import Anthropic from '@anthropic-ai/sdk';
import { wrapAnthropic } from '@savedyouatoken/sdk';

const anthropic = wrapAnthropic(new Anthropic());

// Use the client exactly as before. In development, an audit prints to the console.
await anthropic.messages.create({ model: 'claude-sonnet-5', system, tools, messages });
```

OpenAI is the same:

```ts
import OpenAI from 'openai';
import { wrapOpenAI } from '@savedyouatoken/sdk';

const openai = wrapOpenAI(new OpenAI());
```

The workload behind the dollar figures — requests/day, average output length, cache-hit rate —
is **measured from your traffic**, not guessed. A new workflow starts provisional and exposes
progress toward its observation-count, elapsed-window, and traffic-stability thresholds. The SDK
always emits the mature transition, even when the request shape has not changed.

### Manual capture

For frameworks that hide the request params, observe directly:

```ts
import { createAuditor, anthropicAdapter } from '@savedyouatoken/sdk';

const auditor = createAuditor(anthropicAdapter, {
  operations: { workflow: { name: 'support-triage' } },
});
auditor.observe(params, response); // never throws
```

…or intercept at the fetch layer (opt-in, more invasive):

```ts
import { installFetchInterceptor } from '@savedyouatoken/sdk';
const uninstall = installFetchInterceptor();
```

### Where results go

Pass a sink (or several) via options. Default: console in development, silent in production.

```ts
import {
  wrapOpenAI,
  fileSink,
  dashboardSink,
  callbackSink,
  callbackHealthDestination,
} from '@savedyouatoken/sdk';

wrapOpenAI(new OpenAI(), {
  operations: {
    workflow: {
      name: 'Support triage',
      environment: 'production',
      service: 'support-api',
      tags: { owner: 'cx-platform', region: 'us-west-2' },
    },
    release: {
      version: process.env.APP_VERSION,
      commit: process.env.GIT_SHA,
      deployment: process.env.DEPLOYMENT_ID,
    },
    health: callbackHealthDestination((event) => myLogger.info({ syatHealth: event })),
  },
  sinks: [
    fileSink('./token-audit.jsonl'),               // prompt-free JSON lines
    callbackSink((e) => myLogger.info(e)),          // in-process, full result
    dashboardSink({ url: process.env.SYAT_URL! }),  // opt-in; transmits only the redacted report
  ],
  // Pin any workload field you'd rather state than measure:
  workload: { cacheTtl: '1h' },
  // Exclude a known-variable region from shape identity:
  mask: (system) => system.replace(/Tenant: \w+/g, 'Tenant: <id>'),
});
```

`operations.workflow.name` is the recommended production identity. If `id` is omitted, the SDK
generates a stable id from the explicit workflow name and service—not from prompt content. Metadata
is allowlisted and bounded: identifiers are at most 128 characters, workflow names 80, and tags are
limited to 10 entries, 40-character keys, 120-character values, and 1 KiB total. Invalid values are
omitted and reported by field name/reason through health events; rejected values are never retained.

Every analysis callback event includes both `event.report`, the existing legacy report, and
`event.portableReport`, the versioned cross-tool contract. Use the portable report for new
automation, baselines, and policy checks while existing sinks and consumers continue unchanged:

```ts
callbackSink((event) => {
  if (event.kind === 'analysis') {
    storeReport(event.portableReport);
  }
});
```

The JSON Schemas and canonical identity vectors are published with `@savedyouatoken/core` under
`contracts/`. See the [contract guide](../../docs/contracts.md) for compatibility and migration
rules.

### Maturity

Each analysis event includes `event.maturity`:

- `state`: `provisional` or `mature`;
- `progress`: normalized observation, window, traffic-stability, and overall progress;
- `thresholds`: the exact configured targets; and
- `reasons`: `insufficient-observations`, `insufficient-window`, and/or `unstable-traffic`.

Defaults are 20 observations over at least five minutes with a traffic-stability ratio of 0.5.
Override them under `operations.maturity`. Pinning `workload.requestsPerDay` makes the request-rate
component explicitly configured and therefore immediately mature.

### Instrumentation health

Health is separate from cost reports and is opt-in. A configured destination receives deferred,
prompt-free events for initialization, capture, unsupported methods, unknown models, analysis,
maturity, shape churn, and audit-sink delivery. Repeated identical conditions are deduplicated and
rate-limited (five minutes by default); a later event reports how many repetitions were suppressed.
A throwing or rejecting health destination is swallowed.

Shape-churn events contain counts, hashes, mask-collapse ratios, classifications, and varying line
positions only. They never include suspect substrings or content previews. Configure a deterministic
`mask` for known variable regions; excessive post-mask churn produces a `shape-churn` health event.

### Supported capture paths

| Provider | Wrapped method | Notes |
|---|---|---|
| Anthropic | `messages.create` | Promise responses include usage; non-Promise stream objects are audited request-only. |
| OpenAI | `chat.completions.create` | Supports normal enhanced SDK promises and response helpers. |
| OpenAI | `responses.create` | Captures `instructions` and system/developer input items. |
| Anthropic/OpenAI | `installFetchInterceptor()` | Opt-in fallback for known provider hosts; request/response bodies are cloned, never consumed. |

An unavailable wrapped method is left untouched and produces an `unsupported-method` health event
when health is configured.

### Compatibility and deprecation

Existing integrations without `operations` still work. `reportContext` is supported as a legacy
adapter, and a caller with neither configuration receives a stable provider-level compatibility id.
Neither fallback hashes prompt content. Legacy events identify `operations.configurationMode` as
`legacy`. New integrations should use `operations.workflow`; `reportContext` will remain available
through the current 0.x line and will not be removed without a major SDK release.

## Production readiness

Before rollout:

1. Name one workflow per instrumentation point and attach service/environment/release fields.
2. Send audit and health events to separate destinations with their own alerting.
3. Confirm the provider method appears in the supported table or use the fetch interceptor.
4. Review tags: every accepted operational value may be transmitted to configured sinks.
5. Exercise streaming and error paths in staging and wait for a mature report before enforcing it.
6. Watch `shape-churn`, `unknown-model`, `analysis:failed`, and `sink-delivery:failed` health events.

The wrapper returns the provider's original enhanced promise/response behavior. Capture and health
work run after the caller continuation on a deferred macrotask; adapter, mask, analysis, audit-sink,
and health-destination failures cannot replace the provider response or error.

### Troubleshooting silence

- No output in production is expected unless an audit sink or health destination is configured.
- `initialization:compatibility` means the integration still uses legacy identity configuration.
- `capture:skipped` means the request did not match the selected adapter.
- `unsupported-method` means the installed provider client lacks a wrapped method.
- `unknown-model` includes a safe model hash; update the catalogue mapping without logging raw input.
- A provisional report lists the precise unmet maturity reasons and progress.
- `sink-delivery:failed` distinguishes a destination problem from capture or analysis failure.

## Privacy

Prompt and tool text never leave the process by default. File and dashboard sinks transmit the
prompt-free legacy and portable reports plus bounded operational metadata; health destinations
receive only the event fields documented above. No destination receives prompt text, tool names,
tool descriptions, schema text, content-derived finding detail, rejected metadata values, or error
messages. Canary tests cover reports, diagnostics, health events, and sinks.

## License

MIT
