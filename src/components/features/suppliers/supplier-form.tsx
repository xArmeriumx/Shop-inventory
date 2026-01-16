'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createSupplier, updateSupplier } from '@/actions/suppliers';

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
}

interface SupplierFormProps {
  supplier?: Supplier;
}

export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const isEdit = !!supplier;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      code: (formData.get('code') as string) || null,
      contactName: (formData.get('contactName') as string) || null,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      address: (formData.get('address') as string) || null,
      taxId: (formData.get('taxId') as string) || null,
      notes: (formData.get('notes') as string) || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateSupplier(supplier.id, data)
        : await createSupplier(data);

      if (!result.success) {
        if (typeof result.errors === 'object') {
          setErrors(result.errors as Record<string, string[]>);
        } else if (result.message) {
           setErrors({ _form: [result.message] });
        }
      } else {
        router.push('/suppliers');
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
              <Label htmlFor="name">ชื่อผู้จำหน่าย *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={supplier?.name}
                placeholder="ชื่อบริษัท หรือชื่อผู้จำหน่าย"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">รหัสผู้จำหน่าย</Label>
              <Input
                id="code"
                name="code"
                defaultValue={supplier?.code || ''}
                placeholder="SUP001"
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">ชื่อผู้ติดต่อ</Label>
              <Input
                id="contactName"
                name="contactName"
                defaultValue={supplier?.contactName || ''}
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={supplier?.phone || ''}
                placeholder="0xx-xxx-xxxx"
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={supplier?.email || ''}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email[0]}</p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">ที่อยู่</Label>
              <textarea
                id="address"
                name="address"
                defaultValue={supplier?.address || ''}
                placeholder="ที่อยู่บริษัท"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">เลขประจำตัวผู้เสียภาษี</Label>
              <Input
                id="taxId"
                name="taxId"
                defaultValue={supplier?.taxId || ''}
                placeholder="เลข 13 หลัก"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">หมายเหตุ</Label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={supplier?.notes || ''}
                placeholder="บันทึกเพิ่มเติม"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มผู้จำหน่าย'}
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
