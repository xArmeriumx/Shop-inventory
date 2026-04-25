'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { createProduct, updateProduct } from '@/actions/inventory/products.actions';
import { productFormSchema, getProductFormDefaults } from '@/schemas/inventory/product-form.schema';
import type { ProductFormValues } from '@/schemas/inventory/product-form.schema';
import type { SerializedProduct } from '@/services';
import { VERSION_CONFLICT_ERROR } from '@/lib/optimistic-lock';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

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
        const payload = {
            ...data,
            description: data.description || null,
            sku: data.sku || null,
            moq: data.moq || null,
            ...(isEdit ? { stock: undefined } : {}),
        };

        const actionCall = isEdit
            ? updateProduct(product!.id, {
                ...payload,
                version: (product as any).version,
            } as any)
            : createProduct(payload as any);

        startTransition(async () => {
            await runActionWithToast(actionCall, {
                successMessage: isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มสินค้าสำเร็จ',
                onSuccess: () => {
                    setTimeout(() => {
                        router.push('/products');
                        router.refresh();
                    }, 100);
                },
                onError: (result) => {
                    // Specific handling for Optimistic Locking
                    if (result.errors?._form?.includes(VERSION_CONFLICT_ERROR)) {
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

                    // Field Mapping
                    mapActionErrorsToForm(methods, result.errors);
                    
                    // Root Error Mapping from message
                    if (result.message && !result.errors) {
                        methods.setError('root', { message: result.message });
                    }
                }
            });
        });
    };

    return {
        methods,
        onSubmit: handleSubmit(onSubmit),
        isPending,
        isEdit,
    };
}
