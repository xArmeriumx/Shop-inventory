'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, User, ShieldCheck, Save, Fingerprint, Loader2 } from 'lucide-react';

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

    // Get initials for Avatar
    const initials = (initialData.name || 'User')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="grid gap-8 lg:grid-cols-12 max-w-6xl mx-auto">
            {/* Left Column: Personal Identity Card */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="overflow-hidden border-2 shadow-xl shadow-primary/5 rounded-3xl">
                    <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent relative" />
                    <CardContent className="pt-0 flex flex-col items-center text-center -mt-12">
                        <div className="h-24 w-24 rounded-3xl bg-background border-4 border-background shadow-2xl flex items-center justify-center text-3xl font-black text-primary relative group overflow-hidden">
                            <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                            {initials}
                        </div>
                        <div className="mt-4 space-y-1">
                            <h3 className="text-xl font-black tracking-tight">{initialData.name || 'คุณยังไม่ได้ตั้งชื่อ'}</h3>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <Mail className="h-3 w-3" />
                                {initialData.email}
                            </div>
                        </div>
                        <div className="mt-6 w-full pt-6 border-t space-y-3">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-semibold uppercase tracking-widest">Account Status</span>
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">Verified ERP User</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Info */}
                <div className="rounded-3xl bg-muted/30 border-2 border-dashed p-6 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="text-sm font-black uppercase tracking-widest leading-none">Security Tip</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        เราแนะนำให้คุณเปลี่ยนรหัสผ่านทุกๆ 90 วัน เพื่อความปลอดภัยสูงสุดของข้อมูลร้านค้าของคุณ
                    </p>
                </div>
            </div>

            {/* Right Column: Profile Form */}
            <div className="lg:col-span-8">
                <Card className="rounded-3xl border-2 shadow-md overflow-hidden">
                    <CardHeader className="bg-muted/10 pb-8 pt-8 px-8 border-b-2">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-foreground text-background flex items-center justify-center">
                                <Fingerprint className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">จัดการตัวตนของคุณ</CardTitle>
                                <CardDescription className="text-sm font-medium">ระบุชื่อและข้อมูลพื้นฐานของคุณให้ถูกต้องเพื่อใช้ในการออกเอกสารสำคัญ</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <FormProvider {...methods}>
                            <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
                                <div className="grid gap-8">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            บัญชีผู้ใช้งาน
                                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full lowercase font-bold">System Locked</span>
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="email"
                                                value={initialData.email}
                                                readOnly
                                                className="h-12 pl-10 bg-muted/10 text-muted-foreground/60 cursor-not-allowed border-2 border-dashed font-mono"
                                            />
                                            <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/30" />
                                        </div>
                                    </div>

                                    <FormField name="name" label="ชื่อที่ใช้แสดง (Display Name)" required hint="ชื่อนี้จะปรากฏใน Audit Logs และหน้า Dashboard ของทีมงาน">
                                        <div className="relative group">
                                            <Input 
                                                id="name" 
                                                {...methods.register('name')} 
                                                placeholder="ระบุชื่อจริง หรือ ชื่อในระบบงานของคุณ" 
                                                className="h-14 pl-12 text-lg font-bold bg-muted/20 focus-visible:bg-background transition-all border-2"
                                                disabled={isPending}
                                            />
                                            <User className="absolute left-4 top-4 h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        </div>
                                    </FormField>
                                </div>

                                <div className="flex items-center justify-between pt-8 border-t-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Update will sync across all modules
                                    </div>
                                    <Button 
                                        type="submit" 
                                        disabled={isPending} 
                                        className="h-14 px-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                                    >
                                        {isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                กำลังบันทึก...
                                            </>
                                        ) : (
                                            <>
                                                บันทึกข้อมูล
                                                <Save className="ml-2 h-5 w-5" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </FormProvider>
                    </CardContent>
                </Card>
            </div>
        </div>
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
