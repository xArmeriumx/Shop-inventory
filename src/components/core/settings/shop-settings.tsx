'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store, Phone, MapPin, FileText, QrCode, Save, Info, ShoppingCart, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { updateShop } from '@/actions/core/shop.actions';
import { shopFormSchema, getShopFormDefaults, type ShopFormValues } from '@/schemas/core/settings-form.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

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
            await runActionWithToast(updateShop(data), {
                successMessage: 'ปรับปรุงข้อมูลร้านค้าสำเร็จแล้ว',
                onError: (result) => {
                    if (result.errors) {
                        mapActionErrorsToForm(methods, result.errors);
                    }
                }
            });
        });
    };

    return (
        <Card className="overflow-hidden border-none shadow-md">
            <CardHeader className="bg-muted/30 pb-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Store className="h-5 w-5 text-primary" />
                            ข้อมูลโปรไฟล์ร้านค้า
                        </CardTitle>
                        <CardDescription>ตั้งค่าข้อมูลสำคัญที่จะไปปรากฏในใบเสร็จและเอกสารธุรกรรมต่างๆ</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="grid gap-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <FormField name="name" label="ชื่อร้าน (Business Name)" required hint="จะปรากฏที่หัวเอกสารทุกฉบับ">
                                <div className="relative group">
                                    <Input 
                                        id="shopName" 
                                        {...methods.register('name')} 
                                        placeholder="ระบุชื่อร้านของคุณ" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors" 
                                        disabled={isPending}
                                    />
                                    <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>

                            <FormField name="phone" label="เบอร์โทรศัพท์ติดต่อ" hint="ใช้ในการติดต่อรับการชำระเงิน">
                                <div className="relative group">
                                    <Input 
                                        id="shopPhone" 
                                        {...methods.register('phone')} 
                                        placeholder="0xx-xxx-xxxx" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors" 
                                        disabled={isPending}
                                    />
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>
                        </div>

                        <FormField name="address" label="ที่อยู่ร้าน / ที่อยู่จดทะเบียน" hint="ที่อยู่ฉบับเต็มสำหรับออกใบกำกับภาษี">
                            <div className="relative group">
                                <Textarea 
                                    id="shopAddress" 
                                    {...methods.register('address')} 
                                    placeholder="88/8 หมู่ 8 แขวง... เขต... กรุงเทพฯ..." 
                                    rows={3} 
                                    className="pl-9 pt-2 bg-muted/20 focus-visible:bg-background transition-colors resize-none" 
                                    disabled={isPending}
                                />
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            </div>
                        </FormField>

                        <div className="grid gap-6 md:grid-cols-2">
                            <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" hint="13 หลักสำหรับออกใบกำกับภาษี">
                                <div className="relative group">
                                    <Input 
                                        id="shopTaxId" 
                                        {...methods.register('taxId')} 
                                        placeholder="0123456789012" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors font-mono" 
                                        disabled={isPending}
                                    />
                                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>

                            <FormField name="salesFlowMode" label="โหมดการทำงานของระบบ (Operation Mode)" hint="เลือกโหมดที่เหมาะสมกับธุรกิจของคุณ">
                                <div className="grid grid-cols-2 gap-4">
                                    <label className={`
                                        flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all
                                        ${methods.watch('salesFlowMode') === 'RETAIL' 
                                            ? 'border-primary bg-primary/5 text-primary' 
                                            : 'border-muted bg-muted/10 grayscale hover:grayscale-0'}
                                    `}>
                                        <input 
                                            type="radio" 
                                            value="RETAIL" 
                                            {...methods.register('salesFlowMode')} 
                                            className="sr-only"
                                        />
                                        <ShoppingCart className="h-6 w-6 mb-2" />
                                        <span className="font-bold text-sm">Retail Mode</span>
                                        <span className="text-[10px] opacity-70 text-center">ขายปลีก/ส่ง เน้นออกบิลไว</span>
                                    </label>
                                    
                                    <label className={`
                                        flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all
                                        ${methods.watch('salesFlowMode') === 'ERP' 
                                            ? 'border-primary bg-primary/5 text-primary' 
                                            : 'border-muted bg-muted/10 grayscale hover:grayscale-0'}
                                    `}>
                                        <input 
                                            type="radio" 
                                            value="ERP" 
                                            {...methods.register('salesFlowMode')} 
                                            className="sr-only"
                                        />
                                        <TrendingUp className="h-6 w-6 mb-2" />
                                        <span className="font-bold text-sm">ERP Mode</span>
                                        <span className="text-[10px] opacity-70 text-center">ครบวงจร เน้นคุมสต็อก/ภาษี</span>
                                    </label>
                                </div>
                            </FormField>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                             <FormField name="promptPayId" label="PromptPay ID" hint="เบอร์มือถือ หรือ เลขบัตรประชาชน">
                                <div className="relative group">
                                    <Input 
                                        id="shopPromptPayId" 
                                        {...methods.register('promptPayId')} 
                                        placeholder="สำหรับรับเงินผ่าน QR Code" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors font-mono" 
                                        disabled={isPending}
                                    />
                                    <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-blue-800 text-xs">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-1">ข้อมูลสำคัญ (Legal Identity)</p>
                                <p className="opacity-80">การแก้ไขข้อมูลเลขประจำตัวผู้เสียภาษีและที่อยู่จะมีผลต่อเอกสารทุกฉบับที่ถูกออกหลังจากนี้ กรุณาตรวจสอบความถูกต้องตามทะเบียนพาณิชย์</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button type="submit" disabled={isPending} className="px-8 shadow-sm">
                                <Save className="mr-2 h-4 w-4" />
                                {isPending ? 'กำลังบันทึกข้อมูล...' : 'บันทึกโปรไฟล์ร้านค้า'}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            </CardContent>
        </Card>
    );
}
