import { AuditStatus } from './constants';

export interface AuditLogParams {
  action: string;
  status?: AuditStatus;
  targetType?: string;
  targetId?: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  changedFields?: string[];
  reason?: string;
  note?: string;

  // Legacy Aliases
  category?: string;
  resourceId?: string;
  details?: string;
}

export interface RunWithAuditConfig<T> {
  action: string;
  targetType?: string;
  targetId?: string;
  allowlist?: string[];
  beforeSnapshot?: () => Promise<any> | any;
  resolveTargetId?: (result: T) => string | undefined;
  afterSnapshot?: (result: T) => Promise<any> | any;
  note?: string;

  // Legacy Aliases
  category?: string;
  resourceId?: string;
  details?: string;
  getBefore?: () => Promise<any> | any;
  getAfter?: (result: T) => Promise<any> | any;
}

export type AuditPolicy<T = any> = RunWithAuditConfig<T>;

export interface AuditQueryOptions {
  page?: number;
  limit?: number;
  action?: string;
  status?: AuditStatus;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
}
