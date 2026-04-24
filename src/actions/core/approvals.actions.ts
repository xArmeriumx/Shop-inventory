'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { approvalActionSchema, submitApprovalSchema, type ApprovalActionInputSchema, type SubmitApprovalInputSchema } from '@/schemas/core/approval.schema';
import { ApprovalService } from '@/services/core/workflow/approval.service';
import type { ActionResponse } from '@/types/domain';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';


export async function submitForApproval(input: SubmitApprovalInputSchema): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('APPROVAL_ACTION');
            const validated = submitApprovalSchema.parse(input);
            await ApprovalService.submit(ctx, validated);
            revalidatePath('/approvals');
            // Revalidate the source document
            revalidatePath(`/${validated.documentType.toLowerCase()}s/${validated.documentId}`);
            return true;
        }, 'core:submitForApproval');
    }, { context: { action: 'submitForApproval' } });
}

export async function takeApprovalAction(input: ApprovalActionInputSchema): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('APPROVAL_ACTION');
            const validated = approvalActionSchema.parse(input);
            const result = await ApprovalService.action(ctx, {
                documentId: validated.documentId,
                documentType: validated.documentType,
                action: validated.action,
                reason: validated.reason,
                approvalInstanceId: validated.approvalInstanceId || '',
            });
            revalidatePath('/approvals');
            return result;
        }, 'core:takeApprovalAction');
    }, { context: { action: 'takeApprovalAction' } });
}

export async function approveStep(documentId: string, documentType: string): Promise<ActionResponse> {
    return takeApprovalAction({ documentId, documentType, action: 'APPROVE' });
}

export async function rejectStep(documentId: string, documentType: string, reason: string): Promise<ActionResponse> {
    return takeApprovalAction({ documentId, documentType, action: 'REJECT', reason });
}

export async function getApprovalStatus(documentType: string, documentId: string) {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('APPROVAL_VIEW');
            return ApprovalService.getStatus(ctx, documentType, documentId);
        }, 'core:getApprovalStatus');
    }, { context: { action: 'getApprovalStatus', documentId } });
}


export async function getApprovals(params: { page?: number; limit?: number; status?: string }) {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('APPROVAL_VIEW');
            return ApprovalService.list(ctx, params);
        }, 'core:getApprovals');
    }, { context: { action: 'getApprovals' } });
}


