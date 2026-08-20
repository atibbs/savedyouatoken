import {
  ANALYSIS_ENGINE_VERSION,
  CONTRACT_VERSION,
  PRICES_VERIFIED_ON,
  RULESET_ID,
} from '@savedyouatoken/core';

import { hashString } from './shape';
import {
  OPERATIONAL_METADATA_LIMITS,
  type AuditorOptions,
  type HealthDestination,
  type MaturityThresholds,
  type MetadataRejection,
  type MetadataRejectionReason,
  type OperationalContext,
  type ReleaseConfiguration,
  type ShapeDiagnosticsConfiguration,
} from './types';

const DEFAULT_MATURITY: MaturityThresholds = {
  minObservations: 20,
  minWindowMs: 5 * 60 * 1000,
  minTrafficStability: 0.5,
};

const DEFAULT_DIAGNOSTICS: Required<ShapeDiagnosticsConfiguration> = {
  minObservations: 10,
  minUniqueShapes: 5,
  churnRatio: 0.5,
  windowMs: 24 * 60 * 60 * 1000,
};

export interface ResolvedOperationalConfiguration {
  context: OperationalContext;
  portableEnvironment?: string;
  portableReleaseId: string;
  portableDeployedAt?: string;
  health?: HealthDestination;
  healthRateLimitMs: number;
  maturity: MaturityThresholds;
  diagnostics: Required<ShapeDiagnosticsConfiguration>;
  metadataRejected: MetadataRejection[];
}

export function resolveOperationalConfiguration(
  options: AuditorOptions,
  provider: string,
  sdkVersion: string,
): ResolvedOperationalConfiguration {
  const rejected: MetadataRejection[] = [];
  const configured = options.operations;
  const legacy = options.reportContext;
  const fallbackName = `${provider} workflow`;

  let configurationMode: OperationalContext['configurationMode'] = configured ? 'configured' : 'legacy';
  const configuredName = boundedText(
    configured?.workflow?.name,
    'workflow.name',
    OPERATIONAL_METADATA_LIMITS.workflowName,
    rejected,
    false,
    Boolean(configured),
  );
  const useConfiguredWorkflow = Boolean(configuredName);
  if (configured && !useConfiguredWorkflow) configurationMode = 'legacy';
  const legacyName = useConfiguredWorkflow
    ? undefined
    : boundedText(
        legacy?.workflowId,
        'reportContext.workflowId',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      );
  const name = configuredName ?? legacyName ?? fallbackName;

  const service = useConfiguredWorkflow
    ? boundedText(
        configured?.workflow?.service,
        'workflow.service',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      )
    : undefined;
  const explicitId = useConfiguredWorkflow
    ? boundedText(
        configured?.workflow?.id,
        'workflow.id',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      )
    : undefined;
  const legacyId = useConfiguredWorkflow
    ? undefined
    : boundedText(
        legacy?.workflowId,
        'reportContext.workflowId',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      );
  const id = explicitId ?? legacyId ?? generatedWorkflowId(name, service);
  const environment = useConfiguredWorkflow
    ? boundedText(
        configured?.workflow?.environment,
        'workflow.environment',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      )
    : boundedText(
        legacy?.environment,
        'reportContext.environment',
        OPERATIONAL_METADATA_LIMITS.identifier,
        rejected,
        true,
      );
  const tags = useConfiguredWorkflow ? boundedTags(configured?.workflow?.tags, rejected) : undefined;

  const releaseSource: ReleaseConfiguration = configured?.release ?? {
    deployment: legacy?.releaseId,
    deployedAt: legacy?.deployedAt,
  };
  const release: ReleaseConfiguration = {};
  for (const field of ['version', 'commit', 'deployment'] as const) {
    const value = boundedText(
      releaseSource[field],
      `release.${field}`,
      OPERATIONAL_METADATA_LIMITS.identifier,
      rejected,
      true,
    );
    if (value) release[field] = value;
  }
  const deployedAt = boundedDate(releaseSource.deployedAt, 'release.deployedAt', rejected);
  if (deployedAt) release.deployedAt = deployedAt;

  const maturity = resolveMaturity(options);
  const diagnostics = resolveDiagnostics(options, maturity);

  return {
    context: {
      workflow: {
        id,
        name,
        ...(environment ? { environment } : {}),
        ...(service ? { service } : {}),
        ...(tags && Object.keys(tags).length ? { tags } : {}),
      },
      release,
      comparison: {
        contractVersion: { ...CONTRACT_VERSION },
        sdkVersion,
        engineVersion: ANALYSIS_ENGINE_VERSION,
        rulesetId: RULESET_ID,
        modelCatalogueDate: PRICES_VERIFIED_ON,
      },
      configurationMode,
    },
    ...(environment ? { portableEnvironment: environment } : {}),
    portableReleaseId: release.deployment ?? release.commit ?? release.version ?? 'unversioned',
    ...(deployedAt ? { portableDeployedAt: deployedAt } : {}),
    ...(configured?.health ? { health: configured.health } : {}),
    healthRateLimitMs: boundedNumber(configured?.healthRateLimitMs, 5 * 60 * 1000, 0, 24 * 60 * 60 * 1000),
    maturity,
    diagnostics,
    metadataRejected: rejected,
  };
}

function resolveMaturity(options: AuditorOptions): MaturityThresholds {
  const configured = options.operations?.maturity;
  return {
    minObservations: Math.round(boundedNumber(
      configured?.minObservations ?? options.minObservationsForMaturity,
      DEFAULT_MATURITY.minObservations,
      1,
      1_000_000,
    )),
    minWindowMs: Math.round(boundedNumber(
      configured?.minWindowMs ?? options.minSpanMsForMaturity,
      DEFAULT_MATURITY.minWindowMs,
      0,
      365 * 24 * 60 * 60 * 1000,
    )),
    minTrafficStability: boundedNumber(
      configured?.minTrafficStability ?? options.minTrafficStabilityForMaturity,
      DEFAULT_MATURITY.minTrafficStability,
      0,
      1,
    ),
  };
}

function resolveDiagnostics(
  options: AuditorOptions,
  maturity: MaturityThresholds,
): Required<ShapeDiagnosticsConfiguration> {
  const configured = options.operations?.diagnostics;
  return {
    minObservations: Math.round(boundedNumber(configured?.minObservations, DEFAULT_DIAGNOSTICS.minObservations, 2, 1_000_000)),
    minUniqueShapes: Math.round(boundedNumber(configured?.minUniqueShapes, DEFAULT_DIAGNOSTICS.minUniqueShapes, 2, 100_000)),
    churnRatio: boundedNumber(configured?.churnRatio, DEFAULT_DIAGNOSTICS.churnRatio, 0, 1),
    windowMs: Math.round(boundedNumber(
      configured?.windowMs,
      options.trafficWindowMs ?? DEFAULT_DIAGNOSTICS.windowMs,
      Math.max(1, maturity.minWindowMs),
      365 * 24 * 60 * 60 * 1000,
    )),
  };
}

function generatedWorkflowId(name: string, service?: string): string {
  const seed = `${service?.trim().toLocaleLowerCase('en-US') ?? ''}\u0000${name.trim().toLocaleLowerCase('en-US')}`;
  return `wf_${hashString(seed)}`;
}

function boundedText(
  value: unknown,
  field: string,
  maxLength: number,
  rejected: MetadataRejection[],
  identifier: boolean,
  required = false,
): string | undefined {
  if (value == null) {
    if (required) reject(rejected, field, 'missing');
    return undefined;
  }
  if (typeof value !== 'string') {
    reject(rejected, field, 'invalid-type');
    return undefined;
  }
  if (!value.trim()) {
    reject(rejected, field, 'missing');
    return undefined;
  }
  const normalized = value.trim().normalize('NFC');
  if (normalized.length > maxLength) {
    reject(rejected, field, 'too-long');
    return undefined;
  }
  if (/\p{Cc}/u.test(normalized) || (identifier && !/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/.test(normalized))) {
    reject(rejected, field, 'invalid-format');
    return undefined;
  }
  return normalized;
}

function boundedDate(value: unknown, field: string, rejected: MetadataRejection[]): string | undefined {
  const text = boundedText(value, field, OPERATIONAL_METADATA_LIMITS.identifier, rejected, false);
  if (!text) return undefined;
  if (Number.isNaN(Date.parse(text))) {
    reject(rejected, field, 'invalid-format');
    return undefined;
  }
  return text;
}

function boundedTags(value: unknown, rejected: MetadataRejection[]): Record<string, string> | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(rejected, 'workflow.tags', 'invalid-format');
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length > OPERATIONAL_METADATA_LIMITS.tagCount) reject(rejected, 'workflow.tags', 'too-many-tags');
  const accepted: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = boundedText(rawKey, 'workflow.tags.key', OPERATIONAL_METADATA_LIMITS.tagKey, rejected, true);
    const tagValue = boundedText(rawValue, `workflow.tags.${key ?? 'value'}`, OPERATIONAL_METADATA_LIMITS.tagValue, rejected, false);
    if (!key || !tagValue) continue;
    if (Object.keys(accepted).length >= OPERATIONAL_METADATA_LIMITS.tagCount) continue;
    const candidate = { ...accepted, [key]: tagValue };
    if (new TextEncoder().encode(JSON.stringify(candidate)).byteLength > OPERATIONAL_METADATA_LIMITS.tagBytes) {
      reject(rejected, 'workflow.tags', 'tag-payload-too-large');
      continue;
    }
    accepted[key] = tagValue;
  }
  return Object.keys(accepted).length ? accepted : undefined;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function reject(rejected: MetadataRejection[], field: string, reason: MetadataRejectionReason): void {
  if (!rejected.some((entry) => entry.field === field && entry.reason === reason)) rejected.push({ field, reason });
}
