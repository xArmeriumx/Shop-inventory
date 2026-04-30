/**
 * audit.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { AuditLoggerEngine, calculateChangedFields } from './audit/logger.engine';
import { AuditQuery } from './audit/query';

// Re-export constants and types to maintain public API compatibility
export * from './audit/constants';
export * from './audit/types';

export const AuditService = {
  // Mutation & Logger Engine
  log: AuditLoggerEngine.log,
  record: AuditLoggerEngine.record,
  runWithAudit: AuditLoggerEngine.runWithAudit,
  logDenied: AuditLoggerEngine.logDenied,
  calculateChangedFields,

  // Queries & Analytics
  getActivityLog: AuditQuery.getActivityLog,
  getLogsForEntity: AuditQuery.getLogsForEntity,
  getDeniedLog: AuditQuery.getDeniedLog,
  getSecurityDashboardMetrics: AuditQuery.getSecurityDashboardMetrics,
  getGovernanceHealth: AuditQuery.getGovernanceHealth,
};
