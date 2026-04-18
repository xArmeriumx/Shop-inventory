'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';

import { createExpense, updateExpense } from '@/actions/expenses';
import { EXPENSE_CATEGORIES } from '@/schemas/expense';
import { expenseFormSchema, getExpenseFormDefaults } from '@/schemas/expense-form';
import type { ExpenseFormValues } from '@/schemas/expense-form';

// ============================================================================
// Types
// ============================================================================

interface Expense {
  id: string;
  description: string | null;
  amount: number | { toString: () => string };
  category: string;
  date: Date;
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface ExpenseFormProps {
  expense?: Expense;
  categories: Category[];
}

// ============================================================================
// Main: ExpenseForm
// ============================================================================

export function ExpenseForm({ expense, categories }: ExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!expense;

  const methods = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getExpenseFormDefaults(expense),
  });

  const { handleSubmit, setError, register } = methods;

  function onSubmit(data: ExpenseFormValues) {
    const payload = {
      ...data,
      amount: Number(data.amount),
      date: new Date(data.date),
      notes: data.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateExpense(expense.id, payload)
        : await createExpense(payload);

      // Expense actions use `error` field, not `errors`
      const actionErrors = (result as any).error || (result as any).errors;

      if (!result.success) {
        if (actionErrors && typeof actionErrors === 'object') {
          Object.entries(actionErrors).forEach(([field, messages]) => {
            if (field === '_form') {
              setError('root', { message: (messages as string[]).join(', ') });
            } else {
              setError(field as any, { message: (messages as string[])[0] });
            }
          });
        } else if ((result as any).message) {
          setError('root', { message: (result as any).message });
        }
      } else {
        toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'บันทึกค่าใช้จ่ายสำเร็จ');
        router.push('/expenses');
        router.refresh();
      }
    });
  }

  return (
    <FormProvider {...methods}>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {methods.formState.errors.root && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {methods.formState.errors.root.message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="description" label="รายละเอียด" required className="sm:col-span-2">
                <Input id="description" {...register('description')} placeholder="เช่น ค่าไฟฟ้าประจำเดือน" />
              </FormField>

              <FormField name="amount" label="จำนวนเงิน (บาท)" required>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </FormField>

              <FormField name="category" label="หมวดหมู่" required>
                <select
                  id="category"
                  {...register('category')}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">เลือกหมวดหมู่</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField name="date" label="วันที่" required>
                <Input id="date" type="date" {...register('date')} />
              </FormField>

              <FormField name="notes" label="หมายเหตุ" className="sm:col-span-2">
                <textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </FormField>
            </div>

            {/* Action Bar */}
            <div className="flex gap-2 pt-4 border-t">
              <Button type="submit" disabled={isPending} className="px-8">
                {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึกค่าใช้จ่าย'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                ยกเลิก
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
