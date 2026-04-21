'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { approvalActionSchema, submitApprovalSchema, type ApprovalActionInputSchema, type SubmitApprovalInputSchema } from '@/schemas/approval';
import { ApprovalService } from '@/services/approval.service';
import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';
import { serialize } from '@/lib/utils';


export async function submitForApproval(input: SubmitApprovalInputSchema): Promise<ActionResponse> {
    const ctx = await requirePermission('APPROVAL_ACTION');

    const validated = submitApprovalSchema.safeParse(input);
    if (!validated.success) return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };

    try {
        await ApprovalService.submit(ctx, validated.data);
        revalidatePath('/approvals');
        // Revalidate the source document
        revalidatePath(`/${validated.data.documentType.toLowerCase()}s/${validated.data.documentId}`);
        return { success: true, message: 'ส่งขออนุมัติสำเร็จ' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการส่งขออนุมัติ' };
    }
}

export async function takeApprovalAction(input: ApprovalActionInputSchema): Promise<ActionResponse> {
    const ctx = await requirePermission('APPROVAL_ACTION');

    const validated = approvalActionSchema.safeParse(input);
    if (!validated.success) return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };

    try {
        const result = await ApprovalService.action(ctx, {
            documentId: validated.data.documentId,
            documentType: validated.data.documentType,
            action: validated.data.action,
            reason: validated.data.reason,
            approvalInstanceId: validated.data.approvalInstanceId || '',
        });
        revalidatePath('/approvals');
        return { success: true, message: `ดำเนินการ${validated.data.action === 'APPROVE' ? 'อนุมัติ' : 'ปฏิเสธ'}สำเร็จ (สถานะปัจจุบัน: ${result})` };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการอนุมัติ' };
    }
}

export async function approveStep(documentId: string, documentType: string): Promise<ActionResponse> {
    return takeApprovalAction({ documentId, documentType, action: 'APPROVE' });
}

export async function rejectStep(documentId: string, documentType: string, reason: string): Promise<ActionResponse> {
    return takeApprovalAction({ documentId, documentType, action: 'REJECT', reason });
}

export async function getApprovalStatus(documentType: string, documentId: string) {
    const ctx = await requirePermission('APPROVAL_VIEW');
    const status = await ApprovalService.getStatus(ctx, documentType, documentId);
    return serialize(status);
}


export async function getApprovals(params: { page?: number; limit?: number; status?: string }) {
    const ctx = await requirePermission('APPROVAL_VIEW');
    const result = await ApprovalService.list(ctx, params);
    return serialize(result);
}


