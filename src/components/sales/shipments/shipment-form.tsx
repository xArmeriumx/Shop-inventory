'use client';

import { useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { createShipment } from '@/actions/sales/shipments.actions';
import { shipmentFormSchema, getShipmentFormDefaults } from '@/schemas/sales/shipment-form.schema';
import type { ShipmentFormValues } from '@/schemas/sales/shipment-form.schema';
import type { Customer } from '@prisma/client';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface SaleOption {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  totalAmount: number;
  date: Date | string;
  customer: Pick<Customer, 'id' | 'name' | 'phone'> | null;
}

interface ShipmentFormProps {
  sales: SaleOption[];
  preSelectedSaleId?: string;
}

// ============================================================================
// Section: Sale Selection
// ============================================================================

function SaleSelectionSection({ sales }: { sales: SaleOption[] }) {
  const { control, setValue, watch } = useFormContext<ShipmentFormValues>();
  const selectedSaleId = watch('saleId');

  // Auto-fill recipient info when sale changes
  useEffect(() => {
    const sale = sales.find((s) => s.id === selectedSaleId);
    if (sale) {
      setValue('recipientName', sale.customer?.name || sale.customerName || '');
      setValue('recipientPhone', sale.customer?.phone || '');
    }
  }, [selectedSaleId, sales, setValue]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">เลือกรายการขาย</CardTitle>
        <CardDescription>เลือกรายการขายที่ต้องการจัดส่ง</CardDescription>
      </CardHeader>
      <CardContent>
        <Controller
          name="saleId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกรายการขาย..." />
              </SelectTrigger>
              <SelectContent>
                {sales.map((sale) => (
                  <SelectItem key={sale.id} value={sale.id}>
                    {sale.invoiceNumber} — {sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป'} (
                    {Number(sale.totalAmount).toLocaleString()} ฿)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {sales.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">ไม่มีรายการขายที่รอจัดส่ง</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Recipient Info
// ============================================================================

function RecipientSection() {
  const { register } = useFormContext<ShipmentFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ข้อมูลผู้รับ</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField name="recipientName" label="ชื่อผู้รับ" required>
          <Input id="recipientName" {...register('recipientName')} placeholder="ชื่อ-นามสกุลผู้รับ" maxLength={200} />
        </FormField>

        <FormField name="recipientPhone" label="เบอร์โทร" hint="เช่น 0812345678">
          <Input id="recipientPhone" {...register('recipientPhone')} placeholder="เช่น 0812345678" maxLength={10} inputMode="numeric" />
        </FormField>

        <FormField name="shippingAddress" label="ที่อยู่จัดส่ง" required className="sm:col-span-2">
          <Textarea
            id="shippingAddress"
            {...register('shippingAddress')}
            rows={3}
            placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
            maxLength={500}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Section: Tracking & Shipping
// ============================================================================

function TrackingSection() {
  const { register, control } = useFormContext<ShipmentFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ข้อมูลขนส่ง</CardTitle>
        <CardDescription>ถ้ากรอก Tracking หมายเลข สถานะจะเป็น &quot;ส่งแล้ว&quot; อัตโนมัติ</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <FormField name="trackingNumber" label="หมายเลข Tracking">
          <Input id="trackingNumber" {...register('trackingNumber')} placeholder="TH01488BG2TN0B" className="font-mono" />
        </FormField>

        <FormField name="shippingProvider" label="บริษัทขนส่ง">
          <Controller
            name="shippingProvider"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัทขนส่ง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Flash Express">Flash Express</SelectItem>
                  <SelectItem value="Kerry Express">Kerry Express</SelectItem>
                  <SelectItem value="J&T Express">J&T Express</SelectItem>
                  <SelectItem value="Thailand Post">ไปรษณีย์ไทย</SelectItem>
                  <SelectItem value="DHL">DHL</SelectItem>
                  <SelectItem value="Ninja Van">Ninja Van</SelectItem>
                  <SelectItem value="Best Express">Best Express</SelectItem>
                  <SelectItem value="Dee Express">Dee Express</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField name="shippingCost" label="ค่าส่ง (บาท)">
          <Input id="shippingCost" type="number" step="0.01" min="0" {...register('shippingCost', { valueAsNumber: true })} placeholder="0.00" />
        </FormField>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main: ShipmentForm
// ============================================================================

export function ShipmentForm({ sales, preSelectedSaleId }: ShipmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const methods = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: getShipmentFormDefaults({ saleId: preSelectedSaleId }),
  });

  const { handleSubmit, setError, register, watch } = methods;
  const saleId = watch('saleId');

  function onSubmit(data: ShipmentFormValues) {
    const payload = {
      ...data,
      recipientPhone: data.recipientPhone || null,
      trackingNumber: data.trackingNumber || null,
      shippingProvider: data.shippingProvider || null,
      shippingCost: data.shippingCost || null,
      notes: data.notes || null,
    };

    startTransition(async () => {
      const result = await createShipment(payload);

      if (result.success) {
        toast.success(result.message);
        router.push('/shipments');
        router.refresh();
      } else {
        if (result.errors && typeof result.errors === 'object') {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (field === '_form') {
              setError('root', { message: (messages as string[]).join(', ') });
            } else {
              setError(field as any, { message: (messages as string[])[0] });
            }
          });
        } else {
          toast.error(result.message || 'เกิดข้อผิดพลาด');
        }
      }
    });
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {methods.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {methods.formState.errors.root.message}
          </div>
        )}

        <SaleSelectionSection sales={sales} />
        <RecipientSection />
        <TrackingSection />

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">หมายเหตุ</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register('notes')} rows={2} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/shipments">
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Link>
          </Button>
          <Button type="submit" disabled={isPending || !saleId}>
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            สร้างรายการจัดส่ง
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
