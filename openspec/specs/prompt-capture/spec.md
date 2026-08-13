# Prompt capture Specification

## Purpose

Capturing a real outbound LLM request in the caller's own process, normalising it across
providers, and auditing it with the deterministic engine — without adding latency to the
real call or letting prompt text leave the process by default.

## Requirements

### Requirement: Non-intrusive request capture
The SDK SHALL observe an application's outbound LLM requests without altering the request,
the response, or the latency of the real API call. Auditing SHALL run after the response is
returned to the caller.

#### Scenario: The real call is unaffected
- **WHEN** an instrumented client sends a request to a provider
- **THEN** the request sent and the response received by the application are exactly what they would have been without instrumentation
- **AND** no analysis work runs before the response is returned to the caller

#### Scenario: An analysis failure never reaches the application
- **WHEN** auditing a captured request fails or throws
- **THEN** the application's request and response are unaffected
- **AND** no error propagates to the calling code

### Requirement: Provider-agnostic normalisation
The SDK SHALL extract the static, repeated portion of a request — the model, the system
prompt, and the tool definitions — from at least the Anthropic and OpenAI request formats
into a single normalised shape used for analysis.

#### Scenario: Anthropic request
- **WHEN** an Anthropic message request carrying a system prompt and tools is captured
- **THEN** the model identifier, the system prompt text, and the tool definitions are extracted for analysis

#### Scenario: OpenAI request
- **WHEN** an OpenAI chat request carrying a system or developer message and tools is captured
- **THEN** the model identifier, the system/developer content, and the tool definitions are extracted for analysis

### Requirement: Prompt privacy by default
The SDK SHALL NOT transmit prompt or tool text outside the caller's process by default. Any
payload leaving the process SHALL first pass a redaction step that removes content-derived
substrings — including tool names, tool descriptions, and prompt fragments that analysis may
have interpolated into human-readable finding text. Only counts, dollar figures, rule
identifiers, and redacted finding text may be transmitted; raw finding detail SHALL NOT be
transmitted, because findings can embed captured tool names and other input-derived content.

#### Scenario: Default configuration transmits nothing off-process
- **WHEN** the SDK is used with no destination configured
- **THEN** no prompt text, tool text, or report leaves the process

#### Scenario: A network destination transmits only redacted, prompt-free data
- **WHEN** a network-capable destination is explicitly configured and emits a result
- **THEN** the transmitted payload contains only counts, figures, rule identifiers, and redacted finding text
- **AND** it contains no prompt text, tool names, tool descriptions, or other input-derived content

#### Scenario: Canary strings never appear in the transmitted payload
- **WHEN** unique canary strings are planted in the prompt text, a tool name, a tool description, and a schema, and the analysed result is emitted to a network destination
- **THEN** none of those canary strings appear anywhere in the transmitted payload

### Requirement: Deterministic parity with the analyser
Analysis performed by the SDK SHALL produce the same findings, token counts, and cost
figures as the web analyser and CLI for the same captured input, and SHALL make no model
calls.

#### Scenario: Same input yields the same result
- **WHEN** the same system prompt, tools, model, and workload are analysed by the SDK and by the core engine
- **THEN** the findings, token counts, and cost figures are identical

### Requirement: Deduplicated, sampled analysis
The SDK SHALL treat requests that share the same shape — a function of model, system prompt,
and tool definitions — as one, analysing a shape without re-analysing it on every subsequent
identical request, and SHALL analyse promptly when a shape first appears or changes.

#### Scenario: A repeated identical shape is not re-analysed every call
- **WHEN** the same request shape is observed many times in succession
- **THEN** it is analysed no more often than the configured sampling permits, not once per request

#### Scenario: A changed shape is analysed
- **WHEN** a previously observed request's system prompt or tools change
- **THEN** the new shape is analysed promptly

### Requirement: Workload measured from observed traffic
The SDK SHALL derive the workload used for cost projection — request frequency, average
output length, and cache-hit rate — from observed traffic rather than requiring the caller
to supply it, while allowing explicit overrides.

#### Scenario: Frequency and output length are measured
- **WHEN** multiple requests and their responses are observed over time
- **THEN** the monthly cost projection reflects the observed request frequency and the average output token count

#### Scenario: Cache-hit rate is taken from reported usage
- **WHEN** provider responses report cached-input usage
- **THEN** the observed cache-hit rate is reflected in the cost projection

### Requirement: Reports reflect matured workload
Traffic collection SHALL be independent of shape analysis, so that an emitted report reflects
accumulated rolling workload rather than the workload observed at a shape's first appearance.
The SDK SHALL re-emit a shape's report when its workload estimate matures or changes
materially.

#### Scenario: A report reflects accumulated, not first-request, workload
- **WHEN** a shape has been observed many times and its report is emitted
- **THEN** the report's request frequency, average output length, and cache-hit rate reflect the accumulated observations, not only the first request

#### Scenario: A matured estimate is re-emitted
- **WHEN** a shape's measured workload changes materially after its initial report
- **THEN** an updated report for that shape is emitted

### Requirement: Static-portion identification
The SDK SHALL identify the static, repeated portion of a request rather than assuming the
extracted system/tool content is wholly static. When content interpolates variable data
(such as a timestamp, tenant identifier, or retrieved context), the SDK SHALL avoid treating
each variation as a distinct shape — by inferring the stable portion across repeated requests,
or by honouring a caller-provided masking hook.

#### Scenario: Interpolated variable data collapses to one shape
- **WHEN** a prompt that interpolates a changing timestamp is observed across many requests
- **THEN** the requests resolve to a single stable shape rather than a new shape each call

#### Scenario: Caller-provided masking
- **WHEN** the caller supplies a mask for a variable region of the prompt
- **THEN** that region is excluded from the shape identity

### Requirement: Model identifier normalisation
The SDK SHALL map a provider's model identifier — including dated or snapshot identifiers —
to a pricing-catalogue model before analysis, or apply an explicit unknown-model policy that
surfaces the condition. An unrecognised model identifier SHALL NOT cause the audit to be
silently dropped.

#### Scenario: A dated snapshot identifier is normalised
- **WHEN** a request uses a dated snapshot model identifier that maps to a known catalogue model
- **THEN** analysis proceeds against the catalogue model

#### Scenario: An unknown model surfaces rather than disappearing
- **WHEN** a request uses a model identifier that cannot be mapped to any catalogue model
- **THEN** the condition is surfaced through the configured destination rather than producing no output silently

### Requirement: Configurable result delivery
The SDK SHALL deliver each analysis result to a configurable destination, defaulting to a
concise human-readable summary in development and to no output in production unless a
destination is configured.

#### Scenario: Development default writes a summary
- **WHEN** the SDK runs in a development environment with no destination configured
- **THEN** a concise summary of each analysed shape is written to the console

#### Scenario: Production default stays silent
- **WHEN** the SDK runs in production with no destination configured
- **THEN** no output is produced until a destination is explicitly configured

### Requirement: Streaming and unavailable responses
The SDK SHALL audit a request whose response is streamed or unavailable using the request
alone, without failing.

#### Scenario: Streamed response
- **WHEN** a captured request uses a streaming response
- **THEN** the request's static cost is still analysed
- **AND** response-derived measurements such as output token count are omitted rather than causing a failure
