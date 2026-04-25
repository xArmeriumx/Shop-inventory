'use client';
/**
 * Step 3: Financial & Banking Defaults
 * Fields: currency, invoicePrefix, paymentMethods, fiscalYearStart,
 *         defaultAccountName, defaultAccountType, defaultBankName, promptPayId
 */
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { GenesisStep3Input } from '@/schemas/core/onboarding.schema';
import { cn } from '@/lib/utils';
import { Banknote, CreditCard, Landmark, CalendarDays, QrCode, FileText } from 'lucide-react';

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
        <div className="space-y-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-primary">การตั้งค่าการเงิน</h2>
                <p className="text-muted-foreground font-medium">
                    กำหนดค่าพื้นฐานด้านบัญชีและช่องทางการรับเงินของกิจการ
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice prefix */}
                <FormField name="invoicePrefix" label="Prefix เอกสารเริ่มต้น" required hint='เช่น INV, SO, สป.'>
                    <div className="relative group">
                        <Input
                            id="invoicePrefix"
                            placeholder="INV"
                            maxLength={10}
                            className={cn('h-12 uppercase font-black text-lg pl-10 border-2', errors.invoicePrefix && 'border-destructive')}
                            {...register('invoicePrefix')}
                        />
                        <FileText className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary" />
                    </div>
                </FormField>

                {/* Currency */}
                <FormField name="defaultCurrency" label="สกุลเงินที่ใช้งาน">
                    <div className="relative group">
                        <Input id="defaultCurrency" value="THB — บาทไทย" disabled className="h-12 pl-10 bg-muted/40 font-bold border-2" />
                        <Banknote className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/40" />
                    </div>
                </FormField>
            </div>

            {/* Payment methods */}
            <div className="space-y-4">
                <label className="text-sm font-black uppercase tracking-widest text-muted-foreground">ช่องทางชำระเงินที่รองรับ</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PAYMENT_METHODS.map(({ value, label }) => {
                        const isSelected = (paymentMethods as string[]).includes(value);
                        return (
                            <button
                                key={value}
                                type="button"
                                onClick={() => togglePayment(value)}
                                className={cn(
                                    'h-14 rounded-2xl flex items-center justify-center gap-3 text-sm font-bold border-2 transition-all duration-300',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10'
                                        : 'border-border bg-card/40 hover:border-primary/40'
                                )}
                            >
                                {value === 'CASH' && <Banknote className="h-5 w-5" />}
                                {value === 'TRANSFER' && <Landmark className="h-5 w-5" />}
                                {value === 'CREDIT' && <CreditCard className="h-5 w-5" />}
                                {label}
                            </button>
                        );
                    })}
                </div>
                {errors.paymentMethods && (
                    <p className="text-xs text-destructive font-bold">{errors.paymentMethods.message}</p>
                )}
            </div>

            {/* Fiscal year start */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    เดือนเริ่มต้นรอบบัญชี
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                    {FISCAL_MONTHS.map((month, idx) => {
                        const monthNum = idx + 1;
                        const isSelected = fiscalYearStart === monthNum;
                        return (
                            <button
                                key={monthNum}
                                type="button"
                                onClick={() => setValue('fiscalYearStart', monthNum)}
                                className={cn(
                                    'h-12 rounded-xl text-xs font-bold border-2 transition-all duration-200',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                        : 'border-border bg-card/40 hover:border-primary/30'
                                )}
                            >
                                {month}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Default bank/cash account */}
            <div className="rounded-3xl border-2 p-6 bg-muted/5 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-lg font-black text-primary">บัญชีการเงินเริ่มต้น</p>
                        <p className="text-xs text-muted-foreground font-medium italic">ระบบจะสร้างผังบัญชี (Chart of Accounts) ให้ตามประเภทที่เลือก</p>
                    </div>
                    {/* Account type toggle */}
                    <div className="flex bg-muted p-1 rounded-2xl border-2 border-border">
                        {(['CASH', 'BANK'] as const).map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setValue('defaultAccountType', type)}
                                className={cn(
                                    'px-4 py-2 rounded-xl text-xs font-bold transition-all',
                                    accountType === type
                                        ? 'bg-background text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {type === 'CASH' ? 'เงินสด' : 'บัญชีธนาคาร'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField name="defaultAccountName" label="ชื่อบัญชีหลัก" required>
                        <Input
                            id="defaultAccountName"
                            placeholder={accountType === 'CASH' ? 'เงินสดหน้าร้าน' : 'กสิกรไทย ออมทรัพย์'}
                            {...register('defaultAccountName')}
                            className="h-12 bg-background border-2 font-bold"
                        />
                    </FormField>

                    {accountType === 'BANK' ? (
                        <FormField name="defaultBankName" label="ชื่อสถาบันการเงิน" hint="เช่น ธนาคารกสิกรไทย">
                            <Input id="defaultBankName" placeholder="ธนาคารกสิกรไทย" {...register('defaultBankName')} className="h-12 bg-background border-2 font-bold" />
                        </FormField>
                    ) : (
                        <FormField name="promptPayId" label="PromptPay ID (QR Payment)" hint="เบอร์มือถือ หรือ เลขบัตรประชาชน">
                            <div className="relative group">
                                <Input
                                    id="promptPayId"
                                    placeholder="0812345678"
                                    {...register('promptPayId')}
                                    className="h-12 pl-10 bg-background border-2 font-mono"
                                />
                                <QrCode className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary" />
                            </div>
                        </FormField>
                    )}
                </div>
            </div>
        </div>
    );
}
