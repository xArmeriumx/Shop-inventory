import { z } from 'zod';

export const approvalActionSchema = z.object({
    approvalInstanceId: z.string().optional(),
    documentId: z.string().min(1),
    documentType: z.string().min(1),
    action: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().optional(),
});

export const submitApprovalSchema = z.object({
    documentType: z.enum(['SALE', 'PURCHASE', 'ORDER_REQUEST']),
    documentId: z.string().min(1),
    approverUserIds: z.array(z.string()).min(1, 'กรุณาระบุผู้อนุมัติ'),
});

export type ApprovalActionInputSchema = z.infer<typeof approvalActionSchema>;
export type SubmitApprovalInputSchema = z.infer<typeof submitApprovalSchema>;
