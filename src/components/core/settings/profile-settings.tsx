'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User, ShieldCheck, Save, Fingerprint } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { updateProfile } from '@/actions/core/settings.actions';
import { profileFormSchema, getProfileFormDefaults, type ProfileFormValues } from '@/schemas/core/settings-form.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { Badge } from '@/components/ui/badge';

interface ProfileSettingsProps {
    initialData: { name: string | null; email: string };
}

export function ProfileSettings({ initialData }: ProfileSettingsProps) {
    const [isPending, startTransition] = useTransition();
    
    const methods = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: getProfileFormDefaults(initialData),
    });

    const onSubmit = (data: ProfileFormValues) => {
        startTransition(async () => {
            await runActionWithToast(updateProfile(data), {
                successMessage: 'ปรับปรุงข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว',
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
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <User className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <CardTitle className="text-xl">ข้อมูลส่วนตัว (User Profile)</CardTitle>
                        <CardDescription>จัดการข้อมูลชื่อที่ใช้แสดงและการตั้งค่าบัญชีพื้นฐานของคุณ</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    บัญชีผู้ใช้งาน (Email Account)
                                    <Badge variant="outline" className="text-[9px] font-normal py-0 px-1.5 h-4 ml-auto">Read Only</Badge>
                                </Label>
                                <div className="relative group">
                                    <Input
                                        id="email"
                                        value={initialData.email}
                                        readOnly
                                        className="pl-9 bg-muted/30 text-muted-foreground cursor-not-allowed border-dashed"
                                    />
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1.5 px-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    ที่อยู่อีเมลถูกล็อกไว้เพื่อความปลอดภัยของบัญชี
                                </p>
                            </div>

                            <FormField name="name" label="ชื่อที่ใช้แสดง (Display Name)" required hint="จะปรากฏในระบบ Logs และเอกสารที่รับผิดชอบ">
                                <div className="relative group">
                                    <Input 
                                        id="name" 
                                        {...methods.register('name')} 
                                        placeholder="ระบุชื่อของคุณ" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors"
                                        disabled={isPending}
                                    />
                                    <Fingerprint className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>
                        </div>

                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex gap-3 text-primary text-xs">
                            <InfoIcon className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-1 italic">Identity Policy</p>
                                <p className="opacity-80 leading-relaxed">การเปลี่ยนชื่อที่ใช้แสดงจะมีผลทันทีต่อบันทึกประวัติ (Audit Logs) และการทำรายการใหม่ๆ ทั่วทั้งระบบ เพื่อให้ทีมงานสามารถระบุตัวตนของคุณได้ถูกต้อง</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button type="submit" disabled={isPending} className="px-8 shadow-sm">
                                <Save className="mr-2 h-4 w-4" />
                                {isPending ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลส่วนตัว'}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            </CardContent>
        </Card>
    );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
