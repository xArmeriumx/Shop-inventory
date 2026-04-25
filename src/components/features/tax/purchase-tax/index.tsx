'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { purchaseTaxFormSchema, getPurchaseTaxDefaultValues, type PurchaseTaxFormValues } from '@/schemas/purchase-tax-form';
import { postPurchaseTax, voidPurchaseTax } from '@/actions/tax/tax.actions';
import { runActionWithToast } from '@/lib/mutation-utils';

// Modular Sections
import { TaxDocumentHeader } from './sections/tax-document-header';
import { TaxInvoiceSection } from './sections/tax-invoice-section';
import { VendorSnapshotSection } from './sections/vendor-snapshot-section';
import { FinancialSummarySection } from './sections/financial-summary-section';
import { PurchaseItemsSection } from './sections/purchase-items-section';

interface PurchaseTaxFeatureProps {
  initialData: any;
}

/**
 * PurchaseTaxFeature — The Orchestrator
 * PATTERN: Triple-Layer Architecture (Phase 3)
 * Handles Form Context and Submission logic.
 */
export function PurchaseTaxFeature({ initialData }: PurchaseTaxFeatureProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const methods = useForm<PurchaseTaxFormValues>({
    resolver: zodResolver(purchaseTaxFormSchema),
    defaultValues: getPurchaseTaxDefaultValues(initialData),
  });

  const { handleSubmit, trigger } = methods;

  const isPosted = initialData.status === 'POSTED';
  const isVoided = initialData.status === 'VOIDED';
  const isReadOnly = isPosted || isVoided;

  /**
   * Handle Post — Finalize tax document
   */
  const handlePost = async () => {
    const isValid = await trigger();
    if (!isValid) return;

    startTransition(async () => {
      const values = methods.getValues();
      await runActionWithToast(postPurchaseTax(initialData.id, {
        vendorDocNo: values.vendorDocNo,
        vendorDocDate: new Date(values.vendorDocDate),
        claimStatus: values.claimStatus,
        claimReason: values.claimReason,
      }), {
        loadingMessage: 'กำลังบันทึกข้อมูลและลงรายงานภาษี...',
        successMessage: 'ลงบัญชีภาษีซื้อเรียบร้อยแล้ว',
        onSuccess: () => router.refresh(),
      });
    });
  };

  /**
   * Handle Void — Cancel document
   */
  const handleVoid = async () => {
    startTransition(async () => {
      await runActionWithToast(voidPurchaseTax(initialData.id), {
        loadingMessage: 'กำลังยกเลิกเอกสาร...',
        successMessage: 'ยกเลิกเอกสารภาษีซื้อเรียบร้อยแล้ว',
        onSuccess: () => router.refresh(),
      });
    });
  };

  return (
    <FormProvider {...methods}>
      <div className="space-y-8 animate-in fade-in duration-500">
        <TaxDocumentHeader 
          data={initialData} 
          isPending={isPending}
          onPost={handlePost}
          onVoid={handleVoid}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Main Form Area */}
            <TaxInvoiceSection isReadOnly={isReadOnly} isPending={isPending} />
            <PurchaseItemsSection items={initialData.items} />
          </div>

          <div className="space-y-8">
            {/* Sidebar Area */}
            <FinancialSummarySection data={initialData} />
            <VendorSnapshotSection data={initialData} />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
