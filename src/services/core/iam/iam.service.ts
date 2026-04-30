/**
 * iam.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { IIamService } from '@/types/service-contracts';
import { IamRoleQuery } from './role/query';
import { IamRoleMutation } from './role/mutation';
import { IamTeamQuery } from './team/query';
import { IamTeamMutation } from './team/mutation';
import { IamSessionService } from './auth/session';
import { IamUserService } from './auth/user';

// Re-export types so that we don't break external imports
export * from './types';

export const IamService: IIamService = {
  // Roles
  getRoles: IamRoleQuery.getRoles,
  getRole: IamRoleQuery.getRole,
  createRole: IamRoleMutation.createRole,
  updateRole: IamRoleMutation.updateRole,
  deleteRole: IamRoleMutation.deleteRole,

  // Team
  getTeamMembers: IamTeamQuery.getTeamMembers,
  getShopTeamInfo: IamTeamQuery.getShopTeamInfo,
  updateMemberRole: IamTeamMutation.updateMemberRole,
  removeMember: IamTeamMutation.removeMember,
  inviteMember: IamTeamMutation.inviteMember,

  // Auth & User
  revokeSessions: IamSessionService.revokeSessions,
  getPermissionVersion: IamSessionService.getPermissionVersion,
  getMyPermissions: IamSessionService.getMyPermissions,
  
  getProfile: IamUserService.getProfile,
  registerUser: IamUserService.registerUser,
  updatePassword: IamUserService.updatePassword,
  updateUserActivity: IamUserService.updateUserActivity,
};
