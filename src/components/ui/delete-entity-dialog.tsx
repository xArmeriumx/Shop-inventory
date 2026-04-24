'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { AlertCircle, Trash2, ShieldAlert } from "lucide-react";

interface DeletionImpact {
    canHardDelete: boolean;
    transactionCount: number;
    impacts: { label: string; count: number }[];
}

interface DeleteEntityDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    entityName: string;
    impact: DeletionImpact | null;
    isLoading?: boolean;
}

/**
 * Professional Delete/Archive Dialog
 * Dynamically switches between "Permanent Delete" and "Deactivation" based on transactions.
 */
export function DeleteEntityDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    entityName,
    impact,
    isLoading = false,
}: DeleteEntityDialogProps) {

    const isArchive = impact ? !impact.canHardDelete : false;

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isArchive ? 'bg-amber-100' : 'bg-destructive/10'}`}>
                            {isArchive ? (
                                <ShieldAlert className="h-6 w-6 text-amber-600" />
                            ) : (
                                <Trash2 className="h-6 w-6 text-destructive" />
                            )}
                        </div>
                        <div className="flex-1">
                            <AlertDialogTitle className="text-xl">
                                {isArchive ? 'ยืนยันการปิดใช้งาน' : title}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-base mt-2">
                                คุณกำลังจะ{isArchive ? 'ปิดใช้งาน' : 'ลบ'} <span className="font-bold text-foreground">{`"${entityName}"`}</span>
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>

                <div className="py-4 space-y-4">
                    {impact && (
                        <div className={`rounded-xl border p-4 ${isArchive ? 'bg-amber-50/50 border-amber-200' : 'bg-muted/50 border-border'}`}>
                            <div className="flex items-start gap-3">
                                <AlertCircle className={`h-5 w-5 mt-0.5 ${isArchive ? 'text-amber-600' : 'text-muted-foreground'}`} />
                                <div className="space-y-1 pr-2">
                                    <p className="text-sm font-bold">
                                        {isArchive ? 'ระบบจะเปลี่ยนเป็นสถานะ "ปิดใช้งาน"' : 'ข้อมูลจะถูกลบถาวร'}
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {isArchive
                                            ? `${entityName} มีประวัติธุรกรรมในระบบจึงไม่สามารถลบถาวรได้ เพื่อรักษาความถูกต้องของข้อมูลบัญชี ระบบจะทำการ Archive แทน`
                                            : `เนื่องจากยังไม่พบประวัติการใช้งานในระบบ คุณสามารถลบข้อมูลนี้ออกจากฐานข้อมูลได้ถาวร`}
                                    </p>

                                    {isArchive && impact.impacts.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-amber-200/50">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/60 mb-2">
                                                ประวัติธุรกรรมที่อ้างอิง:
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {impact.impacts.map((imp, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white/50 px-2 py-1.5 rounded-lg border border-amber-200/30">
                                                        <span className="text-xs font-medium text-amber-900/80">{imp.label}</span>
                                                        <span className="text-xs font-black text-amber-600">{imp.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!impact && (
                        <div className="h-24 flex items-center justify-center bg-muted/30 rounded-xl border border-dashed animate-pulse">
                            <p className="text-xs text-muted-foreground italic">กำลังตรวจสอบประวัติธุรกรรม...</p>
                        </div>
                    )}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                        className={`${isArchive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-destructive hover:bg-destructive/90'} text-white border-0 shadow-lg`}
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isLoading || !impact}
                    >
                        {isLoading ? 'กำลังดำเนินการ...' : (isArchive ? 'ตกลง ปิดใช้งาน' : 'ยืนยันลบถาวร')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
