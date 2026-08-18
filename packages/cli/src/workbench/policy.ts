/**
 * Builds the exported `PolicyDocument` from a recorded baseline approval. Shared by the server's
 * `/export-policy` route and the CLI's `workbench export` command, so a browser download and a
 * scripted export always produce byte-identical output for the same approval.
 */

import { CONTRACT_VERSION, type PolicyDocument } from '@savedyouatoken/core';
import { VERSION } from '../support';
import { getReport, latestBaselineApproval, type BaselineApproval } from './store';

export type ExportPolicyResult = { ok: true; policy: PolicyDocument } | { ok: false; error: string };

export function buildExportedPolicy(dataDir: string, workflowId: string): ExportPolicyResult {
  const approval = latestBaselineApproval(dataDir, workflowId);
  if (!approval) return { ok: false, error: `No approved baseline for workflow "${workflowId}" yet.` };
  return buildExportedPolicyFromApproval(dataDir, approval);
}

export function buildExportedPolicyFromApproval(dataDir: string, approval: BaselineApproval): ExportPolicyResult {
  const baselineReport = getReport(dataDir, approval.reportId);
  if (!baselineReport) return { ok: false, error: 'Approved baseline report is missing from the store.' };

  const policy: PolicyDocument = {
    contract: { kind: 'policy', version: { ...CONTRACT_VERSION } },
    provenance: {
      producer: 'savedyouatoken-workbench',
      producerVersion: VERSION,
      generatedAt: new Date().toISOString(),
    },
    target: {
      id: baselineReport.workflow.id,
      ...(baselineReport.workflow.environment ? { environment: baselineReport.workflow.environment } : {}),
    },
    baselineId: approval.reportId,
    budgets: approval.tolerance,
    pricing: {
      currency: 'USD',
      modelId: baselineReport.analysis.modelId,
      catalogueDate: baselineReport.catalogue.modelCatalogueDate,
    },
    enforcement: approval.enforcement,
  };
  return { ok: true, policy };
}
