import { getCompanyTaxProfile, listTaxCodes } from '@/actions/tax/tax.actions';
import { getWhtCodes, getWhtEntriesAction } from '@/actions/tax/wht.actions';
import { CompanyTaxProfileForm } from '@/components/tax/company-tax-profile-form';
import { TaxCodeTable } from '@/components/tax/tax-code-table';
import { WhtCodeTable } from '@/components/tax/wht-code-table';
import { WhtLedger } from '@/components/tax/wht-ledger';
import { WhtReport } from '@/components/tax/wht-report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Metadata } from 'next';
import { Building2, ListTree, Calculator, ShieldCheck, ClipboardList, FilePieChart } from 'lucide-react';

export const metadata: Metadata = {
    title: 'ตั้งค่าภาษี | Shop Inventory ERP',
    description: 'จัดการผังภาษีและข้อมูลนิติบุคคล',
};

export default async function TaxSettingsPage() {
    const now = new Date();
    const [profileRes, codesRes, whtCodes, ledgerRes] = await Promise.all([
        getCompanyTaxProfile(),
        listTaxCodes(),
        getWhtCodes(),
        getWhtEntriesAction({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    ]);

    const profile = profileRes.success ? profileRes.data : null;
    const codes = codesRes.success ? (codesRes.data as any[]) : [];

    return (
        <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">การตั้งค่าภาษี (Tax Settings)</h1>
                <p className="text-muted-foreground mt-1">
                    กำหนดโครงสร้างภาษี ข้อมูลผู้เสียภาษี และผังรหัสภาษีที่ถูกต้องตามกฎหมาย
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="bg-muted/60 p-1">
                    <TabsTrigger value="profile" className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        ข้อมูลบริษัท
                    </TabsTrigger>
                    <TabsTrigger value="codes" className="flex items-center gap-2">
                        <ListTree className="w-4 h-4" />
                        ผังรหัสภาษี (VAT)
                    </TabsTrigger>
                    <TabsTrigger value="wht" className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        รหัสภาษีหัก ณ ที่จ่าย
                    </TabsTrigger>
                    <TabsTrigger value="ledger" className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        บัญชีภาษีหัก ณ ที่จ่าย (50 ทวิ)
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="flex items-center gap-2">
                        <FilePieChart className="w-4 h-4" />
                        รายงานภาษีนำส่ง (Filings)
                    </TabsTrigger>
                    <TabsTrigger value="engine" className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        กฎการคำนวณ
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4 focus-visible:outline-none">
                    <CompanyTaxProfileForm initialData={profile} />
                </TabsContent>

                <TabsContent value="codes" className="space-y-4 focus-visible:outline-none">
                    <TaxCodeTable initialData={codes} />
                </TabsContent>

                <TabsContent value="wht" className="space-y-4 focus-visible:outline-none">
                    <WhtCodeTable data={whtCodes} />
                </TabsContent>

                <TabsContent value="ledger" className="space-y-4 focus-visible:outline-none">
                    <WhtLedger
                        initialData={ledgerRes.success ? ledgerRes.data : { data: [], totalGross: 0, totalWht: 0 }}
                        shop={profile || {}}
                    />
                </TabsContent>

                <TabsContent value="reports" className="space-y-4 focus-visible:outline-none">
                    <WhtReport />
                </TabsContent>

                <TabsContent value="engine" className="space-y-4 focus-visible:outline-none text-center py-20 border rounded-xl border-dashed bg-muted/5">
                    <Calculator className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        ส่วนขยายสำหรับการตั้งค่ากฎการคำนวณภาษีขั้นสูง (Advanced Tax Matrix)
                        จะพร้อมใช้งานในเวอร์ชันถัดไป
                    </p>
                </TabsContent>
            </Tabs>
        </div>
    );
}
