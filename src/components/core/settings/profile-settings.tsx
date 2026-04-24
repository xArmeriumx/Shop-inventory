'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { updateProfile } from '@/actions/core/settings.actions';
import { profileFormSchema, getProfileFormDefaults, type ProfileFormValues } from '@/schemas/core/settings-form.schema';

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
            const result = await updateProfile(data);
            if (result.success) {
                toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
            } else {
                if (result.errors && typeof result.errors === 'object') {
                    Object.entries(result.errors).forEach(([field, messages]) => {
                        methods.setError(field as keyof ProfileFormValues, { message: (messages as string[])[0] });
                    });
                }
                toast.error(result.message || 'เกิดข้อผิดพลาด');
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>ข้อมูลผู้ใช้</CardTitle>
                <CardDescription>จัดการข้อมูลโปรไฟล์และชื่อที่ใช้แสดงของคุณ</CardDescription>
            </CardHeader>
            <CardContent>
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="email">อีเมล</Label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        value={initialData.email}
                                        disabled
                                        className="pl-9 bg-muted text-muted-foreground"
                                    />
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">อีเมลไม่สามารถแก้ไขได้</p>
                            </div>

                            <FormField name="name" label="ชื่อผู้ใช้">
                                <Input id="name" {...methods.register('name')} placeholder="ระบุชื่อของคุณ" />
                            </FormField>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผู้ใช้'}
                            </Button>
                        </div>
                    </form>
                </FormProvider>
            </CardContent>
        </Card>
    );
}
