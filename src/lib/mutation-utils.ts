import { toast } from 'sonner';
import { UseFormReturn, Path, FieldValues } from 'react-hook-form';
import { ActionResponse } from '@/types/domain';

/**
 * มาตรฐานการรัน Server Action พร้อม Toast ระดับระบบ (Phase OB5.2)
 * 
 * ใช้สำหรับจัดการ Mutation flow ให้เป็นมาตรฐานเดียวกันทั้งระบบ:
 * 1. แสดง Success/Error Toast อัตโนมัติ
 * 2. จัดการ Loading state (ผ่าน transition ที่อยู่ข้างนอก)
 * 3. ส่งต่อข้อมูลให้ onSuccess/onError hooks
 */
export async function runActionWithToast<T>(
    action: Promise<ActionResponse<T>>,
    options?: {
        successMessage?: string;
        onSuccess?: (data: T) => void | Promise<void>;
        onError?: (result: Extract<ActionResponse<T>, { success: false }>) => void;
        onFinally?: () => void;
        loadingMessage?: string;
    }
) {
    // ใช้ Operation ID เพื่อป้องกันการเด้งซ้ำ (Deduplication)
    const toastId = `mutation-${Date.now()}`;
    
    if (options?.loadingMessage) {
        toast.loading(options.loadingMessage, { id: toastId });
    }

    try {
        const result = await action;

        if (!result.success) {
            // ชั้นที่ 1: แจ้งเตือนข้อผิดพลาด (ใช้ ID เดิมเพื่อไม่ให้เด้งซ้ำซ้อน)
            toast.error(result.message || 'เกิดข้อผิดพลาดในการดำเนินการ', { id: toastId });
            
            // ชั้นที่ 2: ส่งต่อให้ UI จัดการ (เช่น map เข้า field error)
            options?.onError?.(result as any);
            return result;
        }

        // กรณีสำเร็จ: แสดงข้อความ (ถ้ามี)
        const msg = result.message || options?.successMessage || 'ทำรายการสำเร็จ';
        toast.success(msg, { id: toastId });

        // รัน callback เมื่อสำเร็จ
        if (options?.onSuccess) {
            await options.onSuccess(result.data);
        }

        return result;
    } catch (error) {
        console.error('Mutation Error:', error);
        toast.error('ระบบขัดข้อง กรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าหน้าที่', { id: toastId });
        return { 
            success: false as const, 
            message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าหน้าที่' 
        };
    } finally {
        options?.onFinally?.();
    }
}

/**
 * มาตรฐานการ Map Error จาก Action เข้าสู่ React Hook Form
 */
export function mapActionErrorsToForm<TFieldValues extends FieldValues>(
    form: UseFormReturn<TFieldValues>,
    errors?: Record<string, string[]>
) {
    if (!errors) return;

    Object.entries(errors).forEach(([field, messages]) => {
        form.setError(field as Path<TFieldValues>, {
            type: 'server',
            message: messages[0],
        });
    });
}
