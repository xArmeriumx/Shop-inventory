'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    XCircle,
    Clock,
    ArrowRightLeft,
    History,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { ClientDate } from '@/components/ui/client-date';
import { approveStep, rejectStep } from '@/actions/core/approvals.actions';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ApprovalStep {
    id: string;
    level: number;
    approverUserId: string;
    status: string;
    actionAt?: Date;
    reason?: string;
}

interface ApprovalInstance {
    id: string;
    documentType: string;
    documentId: string;
    status: string;
    currentLevel: number;
    createdAt: Date;
    steps: ApprovalStep[];
}

interface ApprovalDecisionCenterProps {
    instance: ApprovalInstance;
    impact?: {
        message: string;
        details?: { label: string; value: string; variant?: string }[];
    };
}

const APPROVAL_STATUS_CONFIG: Record<string, any> = {
    PENDING: { label: 'รออนุมัติ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
    APPROVED: { label: 'อนุมัติแล้ว', variant: 'default', className: 'bg-green-600' },
    REJECTED: { label: 'ปฏิเสธ', variant: 'destructive' },
    CANCELLED: { label: 'ยกเลิก', variant: 'secondary' },
};

export function ApprovalDecisionCenter({ instance, impact }: ApprovalDecisionCenterProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showAuditHistory, setShowAuditHistory] = useState(false);

    const currentStep = instance.steps.find(s => s.level === instance.currentLevel);
    const canAction = instance.status === 'PENDING';

    const handleApprove = () => {
        if (!confirm('ยืนยันการอนุมัติขั้นตอนนี้?')) return;

        startTransition(async () => {
            await runActionWithToast(approveStep(instance.documentId, instance.documentType), {
                successMessage: 'อนุมัติเอกสารสำเร็จ',
                onSuccess: () => {
                    setTimeout(() => {
                        router.refresh();
                    }, 100);
                }
            });
        });
    };

    const handleReject = () => {
        if (!rejectReason.trim()) {
            toast.error('กรุณาระบุเหตุผล');
            return;
        }

        startTransition(async () => {
            await runActionWithToast(rejectStep(instance.documentId, instance.documentType, rejectReason), {
                successMessage: 'ปฏิเสธการอนุมัติเรียบร้อยแล้ว',
                onSuccess: () => {
                    setShowRejectDialog(false);
                    setTimeout(() => {
                        router.refresh();
                    }, 100);
                }
            });
        });
    };

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* Main Logic: Steps & Timeline */}
            <Card className="md:col-span-2 overflow-hidden border-none shadow-premium bg-background/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/30 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            ขั้นตอนการอนุมัติ (Level {instance.currentLevel})
                        </CardTitle>
                        <StatusBadge status={instance.status} config={APPROVAL_STATUS_CONFIG} />
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                        {instance.steps.map((step, idx) => {
                            const isCurrent = step.level === instance.currentLevel && instance.status === 'PENDING';
                            const isCompleted = step.status === 'APPROVED';
                            const isRejected = step.status === 'REJECTED';

                            return (
                                <div key={step.id} className="relative pl-10">
                                    {/* Icon/Dot */}
                                    <div className={cn(
                                        "absolute left-0 top-0 h-10 w-10 rounded-full border-4 border-background flex items-center justify-center transition-all z-10",
                                        isCompleted ? "bg-green-600 text-white" :
                                            isRejected ? "bg-destructive text-white" :
                                                isCurrent ? "bg-primary text-white animate-pulse" : "bg-muted text-muted-foreground"
                                    )}>
                                        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> :
                                            isRejected ? <XCircle className="h-5 w-5" /> :
                                                <Clock className="h-5 w-5" />}
                                    </div>

                                    <div className={cn(
                                        "p-4 rounded-xl border transition-all",
                                        isCurrent ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                                    )}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-sm">ระดับที่ {step.level}</p>
                                                <p className="text-xs text-muted-foreground">ผู้อนุมัติ: {step.approverUserId}</p>
                                            </div>
                                            <Badge variant={isCompleted ? "default" : "outline"} className={isCompleted ? "bg-green-600" : ""}>
                                                {step.status}
                                            </Badge>
                                        </div>

                                        {step.actionAt && (
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                ดำเนินการเมื่อ: <ClientDate date={step.actionAt} />
                                            </p>
                                        )}

                                        {step.reason && (
                                            <div className="mt-3 p-3 bg-destructive/5 rounded-lg border border-destructive/10 text-xs text-destructive flex gap-2">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                <span>เหตุผล: {step.reason}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Impact & Actions */}
            <div className="space-y-6">
                <Card className="border-none shadow-premium overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            PROJECTED IMPACT
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {impact ? (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {impact.message}
                                </p>
                                {impact.details?.map((detail, idx) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-dashed last:border-0">
                                        <span className="text-xs font-medium text-muted-foreground">{detail.label}</span>
                                        <Badge variant={detail.variant as any || 'outline'} className="text-xs">
                                            {detail.value}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                                <p className="text-xs text-muted-foreground">ไม่มีข้อมูลผลกระทบ</p>
                            </div>
                        )}

                        {canAction && (
                            <div className="grid grid-cols-2 gap-2 pt-4 border-t">
                                <Button
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={handleApprove}
                                    disabled={isPending}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> อนุมัติ
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setShowRejectDialog(true)}
                                    disabled={isPending}
                                >
                                    <XCircle className="mr-2 h-4 w-4" /> ปฏิเสธ
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">เอกสารอ้างอิง</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="p-4 bg-muted/30 rounded-xl border border-dashed text-center">
                            <p className="text-sm font-bold mb-1">{instance.documentType}</p>
                            <p className="text-[10px] text-muted-foreground mb-3">{instance.documentId}</p>
                            <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => router.push(`/${instance.documentType.toLowerCase()}s/${instance.documentId}`)}>
                                ดูเอกสารต้นทาง
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ปฏิเสธการอนุมัติ</DialogTitle>
                        <DialogDescription>
                            กรุณาระบุเหตุผลในการปฏิเสธ เพื่อให้ผู้ส่งคำขอทราบและดำเนินการแก้ไข
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="ระบุเหตุผลที่นี่..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>ยกเลิก</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={isPending}>ยืนยันการปฏิเสธ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
