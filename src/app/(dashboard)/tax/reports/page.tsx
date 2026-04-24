import { getCompanyTaxProfile } from '@/actions/tax/tax.actions';
import { getWhtCodes, getWhtEntriesAction } from '@/actions/tax/wht.actions';
import { VatReportDashboard } from '@/components/tax/vat-report-dashboard';
import { WhtLedger } from '@/components/tax/wht-ledger';
import { WhtReport } from '@/components/tax/wht-report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Metadata } from 'next';
import { FileText, ClipboardList, FilePieChart, Calculator } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import Loading from '@/app/(dashboard)/loading';

export const metadata: Metadata = {
    title: 'รายงานภาษี | Shop Inventory ERP',
    description: 'จัดการรายงานภาษีมูลค่าเพิ่ม (ภ.พ. 30) และภาษีหัก ณ ที่จ่าย',
};

export default async function TaxReportsPage() {
    const now = new Date();
    const [profileRes, whtCodes, ledgerRes] = await Promise.all([
        getCompanyTaxProfile(),
        getWhtCodes(),
        getWhtEntriesAction({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    ]);

    const profile = profileRes.success ? profileRes.data : null;

    return (
        <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Calculator className="w-8 h-8 text-primary" />
                        ศูนย์ระบบภาษี (Tax Operations)
                    </h1>
                    <p className="text-muted-foreground">
                        สรุปรายการภาษีซื้อ-ขาย และจัดการภาษีหัก ณ ที่จ่ายรายเดือน
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/settings/tax">
                        ตั้งค่าภาษี (Setup)
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="vat" className="space-y-6">
                <TabsList className="bg-muted/60 p-1">
                    <TabsTrigger value="vat" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        ภาษีมูลค่าเพิ่ม (ภ.พ. 30)
                    </TabsTrigger>
                    <TabsTrigger value="wht-ledger" className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        บัญชีภาษีหัก ณ ที่จ่าย
                    </TabsTrigger>
                    <TabsTrigger value="wht-filing" className="flex items-center gap-2">
                        <FilePieChart className="w-4 h-4" />
                        รายงานยื่นแบบ (WHT Filing)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="vat" className="space-y-4 focus-visible:outline-none">
                    <VatReportDashboard />
                </TabsContent>

                <TabsContent value="wht-ledger" className="space-y-4 focus-visible:outline-none">
                    <Suspense fallback={<Loading />}>
                        <WhtLedger
                            initialData={ledgerRes.success ? ledgerRes.data : { data: [], totalGross: 0, totalWht: 0 }}
                            shop={profile || {}}
                        />
                    </Suspense>
                </TabsContent>

                <TabsContent value="wht-filing" className="space-y-4 focus-visible:outline-none">
                    <WhtReport />
                </TabsContent>
            </Tabs>
        </div>
    );
}
