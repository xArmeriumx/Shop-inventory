'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile, type ProfileState } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

const initialState: ProfileState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
    </Button>
  );
}

interface SettingsFormProps {
  initialData: {
    name: string | null;
    email: string;
  };
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const [state, formAction] = useFormState(updateProfile, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        <CardDescription>
          แก้ไขข้อมูลชื่อร้านหรือชื่อผู้ใช้งานของคุณ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ / ชื่อร้าน</Label>
              <Input
                id="name"
                name="name"
                defaultValue={initialData.name || ''}
                placeholder="ระบุชื่อร้านของคุณ"
              />
              {state.fieldErrors?.name && (
                <p className="text-sm text-red-500">{state.fieldErrors.name[0]}</p>
              )}
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{state.error}</p>
          )}

          {state.success && (
            <p className="text-sm text-green-600 bg-green-50 p-2 rounded">บันทึกข้อมูลเรียบร้อยแล้ว</p>
          )}

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
