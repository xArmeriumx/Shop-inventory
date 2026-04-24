'use client';
/**
 * Step 3: Financial & Banking Defaults
 * Fields: currency, invoicePrefix, paymentMethods, fiscalYearStart,
 *         defaultAccountName, defaultAccountType, defaultBankName, promptPayId
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { GenesisStep3Input } from '@/schemas/core/onboarding.schema';
import { cn } from '@/lib/utils';

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'เงินสด' },
    { value: 'TRANSFER', label: 'โอนเงิน' },
    { value: 'CREDIT', label: 'เครดิต' },
] as const;

const FISCAL_MONTHS = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function WizardStep3Financial() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep3Input>();
    const paymentMethods = watch('paymentMethods') ?? [];
    const accountType = watch('defaultAccountType');
    const fiscalYearStart = watch('fiscalYearStart') ?? 1;

    const togglePayment = (method: string) => {
        const current = paymentMethods as string[];
        const next = current.includes(method)
            ? current.filter((m) => m !== method)
            : [...current, method];
        setValue('paymentMethods', next as GenesisStep3Input['paymentMethods'], { shouldValidate: true });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">ค่าเริ่มต้นทางการเงิน</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    กำหนดสกุลเงิน บัญชีเริ่มต้น และรอบบัญชีหลักของคุณ
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Invoice prefix */}
                <FormField name="invoicePrefix" label="Prefix เอกสาร" required hint='เช่น INV, SO, สป.'>
                    <Input
                        id="invoicePrefix"
                        placeholder="INV"
                        maxLength={10}
                        className={cn('uppercase', errors.invoicePrefix && 'border-destructive')}
                        {...register('invoicePrefix')}
                    />
                </FormField>

                {/* Currency (display only — THB locked for now) */}
                <FormField name="defaultCurrency" label="สกุลเงิน">
                    <Input id="defaultCurrency" value="THB — บาทไทย" disabled className="bg-muted/50" />
                </FormField>
            </div>

            {/* Payment methods */}
            <div className="space-y-2">
                <label className="text-[13px] font-medium">
                    วิธีชำระเงินที่รับ <span className="text-destructive">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {PAYMENT_METHODS.map(({ value, label }) => {
                        const isSelected = (paymentMethods as string[]).includes(value);
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => togglePayment(value)}
                                className={cn(
                                    'px-4 py-2 rounded-md text-sm font-medium border transition-all duration-150',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                {errors.paymentMethods && (
                    <p className="text-xs text-destructive">{errors.paymentMethods.message}</p>
                )}
            </div>

            {/* Fiscal year start */}
            <div className="space-y-2">
                <label className="text-[13px] font-medium">เดือนเริ่มต้นรอบบัญชี</label>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {FISCAL_MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isSelected = fiscalYearStart === monthNum;
                        return (
                            <button
                                key={monthNum}
                                type="button"
                                onClick={() => setValue('fiscalYearStart', monthNum)}
                                className={cn(
                                    'py-1.5 rounded text-[11px] font-medium border transition-all duration-150',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                                )}
                            >
                                {month}
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-muted-foreground">
                    รอบบัญชีจะเริ่มต้น{FISCAL_MONTHS[(fiscalYearStart - 1)]} ของทุกปี
                </p>
            </div>

            {/* Default bank/cash account */}
            <div className="rounded-lg border p-4 space-y-4">
                <div>
                    <p className="text-sm font-medium">บัญชีเงินสด / ธนาคารเริ่มต้น</p>
                    <p className="text-xs text-muted-foreground">ใช้สำหรับการกระทบยอดธนาคารและบันทึกบัญชี</p>
                </div>

                {/* Account type toggle */}
                <div className="flex gap-2">
                    {(['CASH', 'BANK'] as const).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setValue('defaultAccountType', type)}
                            className={cn(
                                'flex-1 py-2 rounded-md text-sm font-medium border transition-all',
                                accountType === type
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                            )}
                        >
                            {type === 'CASH' ? 'เงินสด' : 'บัญชีธนาคาร'}
                        </button>
                    ))}
                </div>

                <FormField name="defaultAccountName" label="ชื่อบัญชี" required>
                    <Input
                        id="defaultAccountName"
                        placeholder={accountType === 'CASH' ? 'เงินสดหน้าร้าน' : 'กสิกรไทย ออมทรัพย์'}
                        {...register('defaultAccountName')}
                        className={cn(errors.defaultAccountName && 'border-destructive')}
                    />
                </FormField>

                {accountType === 'BANK' && (
                    <FormField name="defaultBankName" label="ชื่อธนาคาร" hint="เช่น ธนาคารกสิกรไทย">
                        <Input id="defaultBankName" placeholder="ธนาคารกสิกรไทย" {...register('defaultBankName')} />
                    </FormField>
                )}
            </div>

            {/* PromptPay (optional) */}
            <FormField name="promptPayId" label="PromptPay ID" hint="เบอร์มือถือ หรือ เลขบัตรประชาชน — ใช้สร้าง QR Code บนใบเสร็จ">
                <Input
                    id="promptPayId"
                    placeholder="0812345678"
                    {...register('promptPayId')}
                />
            </FormField>
        </div>
    );
}
