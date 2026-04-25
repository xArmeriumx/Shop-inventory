'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, LogOut, Lock, KeyRound, CheckCircle2, ShieldAlert, Save, RefreshCw } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { changePassword, revokeAllMySessions } from '@/actions/core/security.actions';
import { changePasswordSchema, getChangePasswordDefaults, type ChangePasswordValues } from '@/schemas/core/security.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { Separator } from '@/components/ui/separator';

export function SecuritySettings() {
    const [isPending, startTransition] = useTransition();
    
    const methods = useForm<ChangePasswordValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: getChangePasswordDefaults(),
    });

    const onPasswordSubmit = (data: ChangePasswordValues) => {
        startTransition(async () => {
            await runActionWithToast(changePassword(data), {
                successMessage: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว ระบบจะให้คุณเข้าสู่ระบบใหม่เพื่อความปลอดภัย',
                onSuccess: () => {
                    methods.reset();
                    // Force sign out after password change for security
                    setTimeout(() => signOut(), 2000);
                },
                onError: (result) => {
                    if (result.errors) {
                        mapActionErrorsToForm(methods, result.errors);
                    }
                }
            });
        });
    };

    const handleRevokeAll = () => {
        startTransition(async () => {
            await runActionWithToast(revokeAllMySessions(), {
                successMessage: 'ยกเลิกเซสชันทั้งหมดแล้ว กำลังนำท่านไปยังหน้าล็อกอิน...',
                onSuccess: () => {
                    setTimeout(() => signOut(), 1500);
                }
            });
        });
    };

    return (
        <div className="grid gap-6">
            {/* Password Section */}
            <Card className="overflow-hidden border-none shadow-md">
                <CardHeader className="bg-muted/30 pb-6">
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-xl">เปลี่ยนรหัสผ่าน (Change Password)</CardTitle>
                            <CardDescription>รหัสผ่านที่คาดเดายากจะช่วยเพิ่มความปลอดภัยให้กับบัญชีของคุณ</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <FormProvider {...methods}>
                        <form onSubmit={methods.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-xl">
                            <FormField name="currentPassword" label="รหัสผ่านปัจจุบัน" required>
                                <div className="relative group">
                                    <Input 
                                        type="password" 
                                        {...methods.register('currentPassword')} 
                                        placeholder="••••••••" 
                                        className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors"
                                        disabled={isPending}
                                    />
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                                </div>
                            </FormField>

                            <Separator className="my-4 opacity-50" />

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField name="newPassword" label="รหัสผ่านใหม่" required hint="ขั้นต่ำ 8 ตัวอักษร, มีพิมพ์ใหญ่, พิมพ์เล็ก และตัวเลข">
                                    <div className="relative group">
                                        <Input 
                                            type="password" 
                                            {...methods.register('newPassword')} 
                                            placeholder="••••••••" 
                                            className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors"
                                            disabled={isPending}
                                        />
                                        <RefreshCw className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                                    </div>
                                </FormField>

                                <FormField name="confirmPassword" label="ยืนยันรหัสผ่านใหม่" required>
                                    <div className="relative group">
                                        <Input 
                                            type="password" 
                                            {...methods.register('confirmPassword')} 
                                            placeholder="••••••••" 
                                            className="pl-9 bg-muted/20 focus-visible:bg-background transition-colors"
                                            disabled={isPending}
                                        />
                                        <CheckCircle2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                                    </div>
                                </FormField>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button type="submit" disabled={isPending} className="px-8">
                                    <Save className="mr-2 h-4 w-4" />
                                    {isPending ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่านใหม่'}
                                </Button>
                            </div>
                        </form>
                    </FormProvider>
                </CardContent>
            </Card>

            {/* Session Section */}
            <Card className="border-destructive/20 shadow-destructive/5 overflow-hidden">
                <CardHeader className="bg-destructive/5 pb-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        <div>
                            <CardTitle className="text-xl">จัดการเซสชัน (Active Sessions)</CardTitle>
                            <CardDescription className="text-destructive/70">หากคุณพบความผิดปกติหรือต้องการยกเลิกการเข้าถึงจากอุปกรณ์อื่น</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-destructive/10 bg-destructive/5">
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-destructive flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin-slow" />
                                ออกจากระบบในทุกอุปกรณ์ (Force Revoke)
                            </p>
                            <p className="text-xs text-muted-foreground">
                                การดำเนินการนี้จะทำให้บัญชีนี้ถูกออกจากระบบในอุปกรณ์ทุบเครื่องทันที รวมถึงเบราว์เซอร์นี้ด้วย
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleRevokeAll}
                            disabled={isPending}
                            className="shrink-0 gap-2 shadow-sm"
                        >
                            <LogOut className="h-4 w-4" />
                            เตะเซสชันและออกจากระบบ
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
