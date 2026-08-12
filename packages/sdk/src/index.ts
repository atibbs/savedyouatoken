/**
 * @savedyouatoken/sdk — capture a real outbound LLM request in your own process and audit it
 * with the same deterministic engine as savedyouatoken.com and the CLI. No prompt leaves the
 * process by default; no model is called; zero latency is added to the real request.
 */

export { wrapAnthropic, wrapOpenAI, installFetchInterceptor } from './wrappers';
export { createAuditor, type Auditor } from './auditor';

export { anthropicAdapter } from './adapters/anthropic';
export { openaiAdapter } from './adapters/openai';

export {
  consoleSink,
  fileSink,
  callbackSink,
  dashboardSink,
  noopSink,
  type DashboardSinkOptions,
} from './sinks';

export { normaliseModelId, type ModelResolution } from './normalise-model';

export type {
  CapturedRequest,
  RequestAdapter,
  AuditEvent,
  AuditSink,
  AuditorOptions,
  WorkloadOverrides,
} from './types';
