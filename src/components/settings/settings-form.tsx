'use client';

import { useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormField } from '@/components/ui/form-field';
import { Mail, Store, MapPin, Phone, FileText, Package, Wallet, TrendingUp, Shield, QrCode, LogOut, AlertTriangle } from 'lucide-react';

import { CategoryManager } from '@/components/lookups/category-manager';
import { usePermissions } from '@/hooks/use-permissions';
import { updateProfile } from '@/actions/settings';
import { updateShop } from '@/actions/shop';
import { revokeAllMySessions } from '@/actions/security';
import {
  profileFormSchema, getProfileFormDefaults, type ProfileFormValues,
  shopFormSchema, getShopFormDefaults, type ShopFormValues
} from '@/schemas/settings-form';

// ============================================================================
// Section: ProfileSettings
// ============================================================================

function ProfileSettings({ initialData }: { initialData: { name: string | null, email: string } }) {
  const [isPending, startTransition] = useTransition();
  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: getProfileFormDefaults(initialData),
  });

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success('บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว');
      } else {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            methods.setError(field as any, { message: (messages as string[])[0] });
          });
        }
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ข้อมูลผู้ใช้</CardTitle>
        <CardDescription>แก้ไขข้อมูลชื่อผู้ใช้งานของคุณ</CardDescription>
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

            <div className="flex justify-end">
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

// ============================================================================
// Section: ShopSettings
// ============================================================================

function ShopSettings({ shopData }: { shopData: any }) {
  const [isPending, startTransition] = useTransition();
  const methods = useForm<ShopFormValues>({
    resolver: zodResolver(shopFormSchema),
    defaultValues: getShopFormDefaults(shopData),
  });

  const onSubmit = (data: ShopFormValues) => {
    startTransition(async () => {
      const result = await updateShop(data as any);
      if (result.success) {
        toast.success('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว');
      } else {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            methods.setError(field as any, { message: (messages as string[])[0] });
          });
        }
        toast.error(result.error || 'เกิดข้อผิดพลาด');
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
        <CardDescription>ข้อมูลร้านค้าจะแสดงในใบเสร็จและเอกสารต่างๆ</CardDescription>
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

            <div className="flex justify-end">
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

// ============================================================================
// Main Application Form
// ============================================================================

interface LookupValue {
  id: string;
  code: string;
  name: string;
  color: string | null;
  isSystem: boolean;
}

interface SettingsFormProps {
  initialData: { name: string | null; email: string };
  shopData: any;
  productCategories: LookupValue[];
  expenseCategories: LookupValue[];
  incomeCategories: LookupValue[];
}

export function SettingsForm({ initialData, shopData, productCategories, expenseCategories, incomeCategories }: SettingsFormProps) {
  const { hasPermission } = usePermissions();
  const [isRevoking, startRevokeTransition] = useTransition();

  const handleRevokeAllSessions = () => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบในทุกอุปกรณ์? (รวมถึงอุปกรณ์นี้ด้วย)')) {
      startRevokeTransition(async () => {
        const result = await revokeAllMySessions();
        if (result?.success) {
          toast.success(result.message || 'ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว');
          window.location.reload();
        } else {
          toast.error(result?.message || 'เกิดข้อผิดพลาด');
        }
      });
    }
  };

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="mb-4 flex-wrap h-auto gap-2">
        <TabsTrigger value="profile">ผู้ใช้</TabsTrigger>
        {hasPermission('SETTINGS_SHOP') && <TabsTrigger value="shop">ร้านค้า</TabsTrigger>}
        {hasPermission('SETTINGS_SHOP') && <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>}
        {hasPermission('SETTINGS_ROLES') && (
          <a href="/settings/team" className="inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium hover:bg-background/50 text-muted-foreground">ทีมงาน</a>
        )}
        {hasPermission('SETTINGS_ROLES') && (
          <a href="/settings/roles" className="inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium hover:bg-background/50 text-muted-foreground">จัดการ Roles</a>
        )}
        {(hasPermission('SETTINGS_ROLES') || hasPermission('SETTINGS_SHOP')) && (
          <a href="/settings/audit" className="inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium hover:bg-background/50 text-muted-foreground">Audit Logs</a>
        )}
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <ProfileSettings initialData={initialData} />
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Shield className="h-5 w-5" />
              ความปลอดภัย
            </CardTitle>
            <CardDescription>จัดการความปลอดภัยของบัญชีผู้ใช้งาน</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-red-50/50">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ออกจากระบบทุกอุปกรณ์
                </h4>
                <p className="text-sm text-muted-foreground mt-1">เตะอุปกรณ์ทั้งหมด (รวมถึงเครื่องนี้) ออกจากระบบทันที</p>
              </div>
              <Button variant="destructive" onClick={handleRevokeAllSessions} disabled={isRevoking}>
                <LogOut className="h-4 w-4 mr-2" />
                {isRevoking ? 'กำลังดำเนินการ...' : 'ออกจากระบบทุกอุปกรณ์'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="shop">
        <ShopSettings shopData={shopData} />
      </TabsContent>

      <TabsContent value="categories" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> หมวดหมู่สินค้า</CardTitle>
          </CardHeader>
          <CardContent><CategoryManager title="" typeCode="PRODUCT_CATEGORY" values={productCategories} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> หมวดหมู่ค่าใช้จ่าย</CardTitle>
          </CardHeader>
          <CardContent><CategoryManager title="" typeCode="EXPENSE_CATEGORY" values={expenseCategories} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> หมวดหมู่รายรับ</CardTitle>
          </CardHeader>
          <CardContent><CategoryManager title="" typeCode="INCOME_CATEGORY" values={incomeCategories} /></CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
