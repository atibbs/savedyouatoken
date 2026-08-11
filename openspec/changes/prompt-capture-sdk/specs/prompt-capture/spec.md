## Purpose

Capturing a real outbound LLM request in the caller's own process, normalising it across
providers, and auditing it with the deterministic engine — without adding latency to the
real call or letting prompt text leave the process by default.

## ADDED Requirements

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
built-in destination capable of network transmission SHALL send only the prompt-free report
— counts, findings, and dollar figures — and never prompt or tool text.

#### Scenario: Default configuration transmits nothing off-process
- **WHEN** the SDK is used with no destination configured
- **THEN** no prompt text, tool text, or report leaves the process

#### Scenario: A network destination omits prompt text
- **WHEN** a network-capable destination is explicitly configured and emits a result
- **THEN** the transmitted payload contains only counts, findings, and figures
- **AND** it contains no prompt text or tool text

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
