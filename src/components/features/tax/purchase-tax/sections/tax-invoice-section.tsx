'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { FileText, Calendar, ShieldCheck } from 'lucide-react';
import { FormField } from '@/components/shared/form-field'; // Standard wrapper
import { PurchaseTaxFormValues } from '@/schemas/purchase-tax-form';

interface TaxInvoiceSectionProps {
  isReadOnly: boolean;
  isPending: boolean;
}

export function TaxInvoiceSection({ isReadOnly, isPending }: TaxInvoiceSectionProps) {
  const { register, setValue, watch, formState: { errors } } = useFormContext<PurchaseTaxFormValues>();

  const claimStatus = watch('claimStatus');

  return (
    <Card className="rounded-[2rem] border-primary/10 shadow-xl overflow-hidden group hover:border-primary/30 transition-all duration-300">
      <CardHeader className="bg-primary/5 pb-6">
        <CardTitle className="text-lg font-black flex items-center gap-3 tracking-tight">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
            <FileText className="h-5 w-5" />
          </div>
          ข้อมูลใบกำกับภาษีด้านซัพพลายเออร์
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <FormField
              label="เลขที่ใบกำกับภาษี (Tax Invoice No.)"
              icon={<FileText className="h-3 w-3" />}
              error={errors.vendorDocNo?.message}
              required
            >
              <Input
                placeholder="ระบุเลขที่จากเอกสารต้นฉบับ"
                className="h-12 text-lg font-bold rounded-xl border-2 focus-visible:ring-primary"
                {...register('vendorDocNo')}
                disabled={isReadOnly || isPending}
              />
            </FormField>

            <FormField
              label="วันที่ในใบกำกับภาษี (Issue Date)"
              icon={<Calendar className="h-3 w-3" />}
            >
              <Input
                type="date"
                className="h-12 font-medium rounded-xl border-2"
                {...register('vendorDocDate')}
                disabled={isReadOnly || isPending}
              />
            </FormField>
          </div>

          <div className="space-y-4 bg-muted/20 p-6 rounded-[1.5rem] border border-primary/10">
            <FormField
              label="สิทธิการขอคืนภาษี (Claim Policy)"
              icon={<ShieldCheck className="h-3 w-3" />}
            >
              <Select
                disabled={isReadOnly || isPending}
                value={claimStatus}
                onValueChange={(v) => setValue('claimStatus', v as any)}
              >
                <SelectTrigger className="h-12 font-bold rounded-xl border-2 bg-background">
                  <SelectValue placeholder="เลือกสิทธิการเคลม" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-2 shadow-2xl">
                  <SelectItem value="CLAIMABLE" className="font-medium text-green-600">ขอคืนภาษีมูลค่าเพิ่มได้ (ปกติ)</SelectItem>
                  <SelectItem value="WAITING_DOC" className="font-medium text-blue-600">รอเอกสารต้นฉบับ (ยังไม่ลงรายงาน)</SelectItem>
                  <SelectItem value="NON_CLAIMABLE" className="font-medium text-destructive">ไม่ขอคืนภาษี (ภาษีซื้อต้องห้าม)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/10 animate-in fade-in duration-300">
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                {claimStatus === 'CLAIMABLE' && "ระบบจะนำยอดยื่นในรายงานภาษีซื้อ (ภ.พ. 30) ของเดือนภาษีปัจจุบัน"}
                {claimStatus === 'WAITING_DOC' && "ระบบจะจองสิทธิ์ไว้ แต่ยังไม่คำนวณในรายงานเดือนนี้จนกว่าจะได้รับเอกสาร"}
                {claimStatus === 'NON_CLAIMABLE' && "รายการนี้จะถูกคัดชื่อออกจากการคำนวณภาษีมูลค่าเพิ่มโดยสิ้นเชิง"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
