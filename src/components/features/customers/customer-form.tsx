'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createCustomer, updateCustomer } from '@/actions/customers';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
}

interface CustomerFormProps {
  customer?: Customer;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const isEdit = !!customer;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: (formData.get('phone') as string) || null,
      address: (formData.get('address') as string) || null,
      taxId: (formData.get('taxId') as string) || null,
      notes: (formData.get('notes') as string) || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomer(customer.id, data)
        : await createCustomer(data);

      if (!result.success) {
        // Handle validation errors or string error
        if (typeof result.errors === 'object') {
          setErrors(result.errors as Record<string, string[]>);
        } else if (result.message) {
           setErrors({ _form: [result.message] });
        }
      } else {
        router.push('/customers');
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
              <Label htmlFor="name">ชื่อลูกค้า *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={customer?.name}
                placeholder="ชื่อ-นามสกุล หรือชื่อบริษัท"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={customer?.phone || ''}
                placeholder="0xx-xxx-xxxx"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="taxId"
                name="taxId"
                defaultValue={customer?.taxId || ''}
                placeholder="เลข 13 หลัก"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">ที่อยู่ 
                <span className="text-muted-foreground text-xs font-normal ml-2">(จำเป็นสำหรับออกใบกำกับภาษี)</span>
              </Label>
              <textarea
                id="address"
                name="address"
                defaultValue={customer?.address || ''}
                placeholder="ที่อยู่สำหรับจัดส่ง"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">หมายเหตุ</Label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={customer?.notes || ''}
                placeholder="บันทึกเพิ่มเติม"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
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
