'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile, type ProfileState } from '@/actions/settings';
import { updateShop, type ShopState } from '@/actions/shop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Store, MapPin, Phone, FileText, Package, Wallet, TrendingUp, Users, Shield, QrCode } from 'lucide-react';
import { CategoryManager } from '@/components/features/lookups/category-manager';
import { usePermissions } from '@/hooks/use-permissions';

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

interface LookupValue {
  id: string;
  code: string;
  name: string;
  color: string | null;
  isSystem: boolean;
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
    promptPayId: string | null;
  } | null;
  productCategories: LookupValue[];
  expenseCategories: LookupValue[];
  incomeCategories: LookupValue[];
}

export function SettingsForm({ initialData, shopData, productCategories, expenseCategories, incomeCategories }: SettingsFormProps) {
  const [profileState, profileAction] = useFormState(updateProfile, initialProfileState);
  const [shopState, shopAction] = useFormState(updateShop, initialShopState);
  const { hasPermission } = usePermissions();

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="mb-4 flex-wrap h-auto gap-2">
        <TabsTrigger value="profile">ผู้ใช้</TabsTrigger>
        {hasPermission('SETTINGS_SHOP') && (
          <TabsTrigger value="shop">ร้านค้า</TabsTrigger>
        )}
        {hasPermission('SETTINGS_LOOKUPS') && (
          <TabsTrigger value="categories">หมวดหมู่</TabsTrigger>
        )}
        {hasPermission('TEAM_VIEW') && (
             <a href="/settings/team" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-background/50 text-muted-foreground">
                ทีมงาน
             </a>
        )}
        {hasPermission('TEAM_VIEW') && (
             <a href="/settings/roles" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:bg-background/50 text-muted-foreground">
                จัดการ Roles
             </a>
        )}
      </TabsList>

      {/* Profile Tab */}
      <TabsContent value="profile">
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
      </TabsContent>

      {/* Shop Tab */}
      {hasPermission('SETTINGS_SHOP') && (
        <TabsContent value="shop">
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

                <div className="space-y-2">
                  <Label htmlFor="shopPromptPayId">PromptPay ID</Label>
                  <div className="relative">
                    <Input
                      id="shopPromptPayId"
                      name="promptPayId"
                      defaultValue={shopData?.promptPayId || ''}
                      placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน"
                      className="pl-9"
                    />
                    <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">สำหรับสร้าง QR Code รับเงินในหน้า POS</p>
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
        </TabsContent>
      )}

      {/* Categories Tab */}
      {hasPermission('SETTINGS_LOOKUPS') && (
        <TabsContent value="categories">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  หมวดหมู่สินค้า
                </CardTitle>
                <CardDescription>
                  จัดการหมวดหมู่สำหรับจัดกลุ่มสินค้า
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryManager 
                  title="" 
                  typeCode="PRODUCT_CATEGORY" 
                  values={productCategories} 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  หมวดหมู่ค่าใช้จ่าย
                </CardTitle>
                <CardDescription>
                  จัดการหมวดหมู่สำหรับจัดกลุ่มค่าใช้จ่าย
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryManager 
                  title="" 
                  typeCode="EXPENSE_CATEGORY" 
                  values={expenseCategories} 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  หมวดหมู่รายรับ
                </CardTitle>
                <CardDescription>
                  จัดการหมวดหมู่สำหรับจัดกลุ่มรายรับอื่นๆ (บริการ, ค่าแรง)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryManager 
                  title="" 
                  typeCode="INCOME_CATEGORY" 
                  values={incomeCategories} 
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
