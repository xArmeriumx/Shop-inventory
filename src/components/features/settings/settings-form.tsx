'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile, type ProfileState } from '@/actions/settings';
import { updateShop, type ShopState } from '@/actions/shop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Store, MapPin, Phone, FileText } from 'lucide-react';

const initialProfileState: ProfileState = {};
const initialShopState: ShopState = {};

function SubmitButton({ text = 'บันทึกการเปลี่ยนแปลง' }: { text?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : text}
    </Button>
  );
}

interface SettingsFormProps {
  initialData: {
    name: string | null;
    email: string;
  };
  shopData: {
    name: string;
    address: string | null;
    phone: string | null;
    logo: string | null;
    taxId: string | null;
  } | null;
}

export function SettingsForm({ initialData, shopData }: SettingsFormProps) {
  const [profileState, profileAction] = useFormState(updateProfile, initialProfileState);
  const [shopState, shopAction] = useFormState(updateShop, initialShopState);

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลผู้ใช้</CardTitle>
          <CardDescription>
            แก้ไขข้อมูลชื่อผู้ใช้งานของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
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
                <Label htmlFor="name">ชื่อผู้ใช้</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={initialData.name || ''}
                  placeholder="ระบุชื่อของคุณ"
                />
                {profileState.fieldErrors?.name && (
                  <p className="text-sm text-red-500">{profileState.fieldErrors.name[0]}</p>
                )}
              </div>
            </div>

            {profileState.error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{profileState.error}</p>
            )}

            {profileState.success && (
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded">บันทึกข้อมูลเรียบร้อยแล้ว</p>
            )}

            <div className="flex justify-end">
              <SubmitButton text="บันทึกข้อมูลผู้ใช้" />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Shop Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            ข้อมูลร้านค้า
          </CardTitle>
          <CardDescription>
            ข้อมูลร้านค้าจะแสดงในใบเสร็จและเอกสารต่างๆ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={shopAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shopName">ชื่อร้าน *</Label>
                <div className="relative">
                  <Input
                    id="shopName"
                    name="name"
                    defaultValue={shopData?.name || ''}
                    placeholder="ระบุชื่อร้านของคุณ"
                    className="pl-9"
                  />
                  <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                {shopState.fieldErrors?.name && (
                  <p className="text-sm text-red-500">{shopState.fieldErrors.name[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopPhone">เบอร์โทรศัพท์</Label>
                <div className="relative">
                  <Input
                    id="shopPhone"
                    name="phone"
                    defaultValue={shopData?.phone || ''}
                    placeholder="0xx-xxx-xxxx"
                    className="pl-9"
                  />
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopAddress">ที่อยู่ร้าน</Label>
              <div className="relative">
                <Textarea
                  id="shopAddress"
                  name="address"
                  defaultValue={shopData?.address || ''}
                  placeholder="ที่อยู่สำหรับแสดงในใบเสร็จ"
                  rows={2}
                  className="pl-9 pt-2"
                />
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopTaxId">เลขประจำตัวผู้เสียภาษี</Label>
              <div className="relative">
                <Input
                  id="shopTaxId"
                  name="taxId"
                  defaultValue={shopData?.taxId || ''}
                  placeholder="สำหรับออกใบกำกับภาษี (ถ้ามี)"
                  className="pl-9"
                />
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {shopState.error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{shopState.error}</p>
            )}

            {shopState.success && (
              <p className="text-sm text-green-600 bg-green-50 p-2 rounded">บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว</p>
            )}

            <div className="flex justify-end">
              <SubmitButton text="บันทึกข้อมูลร้านค้า" />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
