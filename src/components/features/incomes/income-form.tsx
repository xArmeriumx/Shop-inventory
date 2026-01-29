'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createIncome, updateIncome } from '@/actions/incomes';

interface Income {
  id: string;
  description: string | null;
  amount: number | { toString: () => string };
  category: string;
  date: Date;
  notes?: string | null;
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface IncomeFormProps {
  income?: Income;
  categories: Category[];
}

export function IncomeForm({ income, categories }: IncomeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const isEdit = !!income;

  const formatDateForInput = (date: Date) => {
    return new Date(date).toISOString().split('T')[0];
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      description: formData.get('description') as string,
      amount: parseFloat(formData.get('amount') as string) || 0,
      category: formData.get('category') as any,
      date: new Date(formData.get('date') as string),
      notes: (formData.get('notes') as string) || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateIncome(income.id, data)
        : await createIncome(data);

      if (result.error) {
        setErrors(result.error as Record<string, string[]>);
      } else {
        router.push('/incomes');
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errors._form && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors._form.join(', ')}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">รายละเอียด *</Label>
              <Input
                id="description"
                name="description"
                defaultValue={income?.description || ''}
                placeholder="เช่น ค่าซ่อมแอร์ลูกค้า"
                required
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">จำนวนเงิน (บาท) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={income?.amount.toString()}
                placeholder="0.00"
                required
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่ *</Label>
              <select
                id="category"
                name="category"
                defaultValue={income?.category}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">วันที่ *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={income ? formatDateForInput(income.date) : formatDateForInput(new Date())}
                required
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date[0]}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">หมายเหตุ</Label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={income?.notes || ''}
                placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึกรายรับ'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
