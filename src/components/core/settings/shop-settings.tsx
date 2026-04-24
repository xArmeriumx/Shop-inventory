'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Store, Phone, MapPin, FileText, QrCode } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { updateShop } from '@/actions/core/shop.actions';
import { shopFormSchema, getShopFormDefaults, type ShopFormValues } from '@/schemas/core/settings-form.schema';

interface ShopSettingsProps {
    shopData: any;
}

export function ShopSettings({ shopData }: ShopSettingsProps) {
    const [isPending, startTransition] = useTransition();
    const methods = useForm<ShopFormValues>({
        resolver: zodResolver(shopFormSchema),
        defaultValues: getShopFormDefaults(shopData),
    });

    const onSubmit = (data: ShopFormValues) => {
        startTransition(async () => {
            const sanitizedData = {
                ...data,
                phone: data.phone ?? undefined,
                address: data.address ?? undefined,
                taxId: data.taxId ?? undefined,
                promptPayId: data.promptPayId ?? undefined,
                logo: data.logo ?? undefined,
            };
            const result = await updateShop(sanitizedData);
            if (result.success) {
                toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
            } else {
                if (result.errors && typeof result.errors === 'object') {
                    Object.entries(result.errors).forEach(([field, messages]) => {
                        methods.setError(field as any, { message: (messages as string[])[0] });
                    });
                }
                toast.error(result.message || 'เกิดข้อผิดพลาด');
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    ข้อมูลร้านค้า
                </CardTitle>
                <CardDescription>ข้อมูลร้านค้าจะแสดงในใบเสร็จและเอกสารต่างๆ ของระบบ</CardDescription>
            </CardHeader>
            <CardContent>
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField name="name" label="ชื่อร้าน" required>
                                <div className="relative">
                                    <Input id="shopName" {...methods.register('name')} placeholder="ระบุชื่อร้านของคุณ" className="pl-9" />
                                    <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                </div>
                            </FormField>

                            <FormField name="phone" label="เบอร์โทรศัพท์">
                                <div className="relative">
                                    <Input id="shopPhone" {...methods.register('phone')} placeholder="0xx-xxx-xxxx" className="pl-9" />
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                </div>
                            </FormField>
                        </div>

                        <FormField name="address" label="ที่อยู่ร้าน">
                            <div className="relative">
                                <Textarea id="shopAddress" {...methods.register('address')} placeholder="ที่อยู่สำหรับแสดงในใบเสร็จ" rows={2} className="pl-9 pt-2" />
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </FormField>

                        <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี">
                            <div className="relative">
                                <Input id="shopTaxId" {...methods.register('taxId')} placeholder="สำหรับออกใบกำกับภาษี (ถ้ามี)" className="pl-9" />
                                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </FormField>

                        <FormField name="promptPayId" label="PromptPay ID">
                            <div className="relative">
                                <Input id="shopPromptPayId" {...methods.register('promptPayId')} placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน" className="pl-9" />
                                <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">สำหรับสร้าง QR Code รับเงินในหน้า POS</p>
                        </FormField>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้านค้า'}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            </CardContent>
        </Card>
    );
}
