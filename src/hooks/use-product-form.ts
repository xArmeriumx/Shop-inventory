'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { createProduct, updateProduct } from '@/actions/products';
import { productFormSchema, getProductFormDefaults } from '@/schemas/product-form';
import type { ProductFormValues } from '@/schemas/product-form';
import type { SerializedProduct } from '@/services';
import { VERSION_CONFLICT_ERROR } from '@/lib/optimistic-lock';

/**
 * useProductForm Hook
 * 
 * RESPONSIBILITY: 
 * - Form state management (react-hook-form)
 * - Submission orchestration (Server Action calls)
 * - Error mapping from domain to UI
 * - Navigation and user feedback (toast)
 * 
 * DOES NOT:
 * - Handle business/inventory rules (stays in service)
 * - Handle complex data normalization (stays in schema)
 */
export function useProductForm(product?: SerializedProduct) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isEdit = !!product;

    const methods = useForm<ProductFormValues>({
        resolver: zodResolver(productFormSchema),
        defaultValues: getProductFormDefaults(product),
    });

    const { handleSubmit, setError } = methods;

    const onSubmit = (data: ProductFormValues) => {
        // 1. Prepare payload (Shallow mapping for Action)
        const payload = {
            ...data,
            description: data.description || null,
            sku: data.sku || null,
            moq: data.moq || null,
            ...(isEdit ? { stock: undefined } : {}),
        };

        startTransition(async () => {
            // 2. Execute Action
            const result = isEdit
                ? await updateProduct(product!.id, {
                    ...payload,
                    version: (product as any).version,
                })
                : await createProduct(payload as any);

            // 3. Handle Result
            if (!result.success) {
                handleServerErrors(result);
            } else {
                toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มสินค้าสำเร็จ');
                router.push('/products');
                router.refresh();
            }
        });
    };

    /**
     * Internal helper to map domain errors back to RHF fields
     */
    const handleServerErrors = (result: any) => {
        const errors = result.errors;

        // Check for optimistic locking conflict
        if (errors?._form?.includes(VERSION_CONFLICT_ERROR)) {
            toast.error('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น', {
                description: 'กรุณารีเฟรชเพื่อดูข้อมูลล่าสุด',
                action: {
                    label: 'รีเฟรช',
                    onClick: () => router.refresh(),
                },
                duration: 10000,
            });
            return;
        }

        // Standard field error mapping
        if (errors && typeof errors === 'object') {
            Object.entries(errors).forEach(([field, messages]) => {
                if (field === '_form') {
                    setError('root', { message: (messages as string[]).join(', ') });
                } else {
                    setError(field as any, { message: (messages as string[])[0] });
                }
            });
        } else if (result.message) {
            setError('root', { message: result.message });
        }
    };

    return {
        methods,
        onSubmit: handleSubmit(onSubmit),
        isPending,
        isEdit,
    };
}
