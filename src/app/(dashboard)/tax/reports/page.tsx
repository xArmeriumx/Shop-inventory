import { VatReportDashboard } from '@/components/tax/vat-report-dashboard';
import { Metadata } from 'next';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'รายงานภาษีมูลค่าเพิ่ม | Shop Inventory ERP',
    description: 'แบบสรุปรายการภาษีซื้อและภาษีขาย (ภ.พ. 30)',
};

export default function TaxReportsPage() {
    return (
        <div className="flex-1 space-y-8 p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Link href="/tax/purchase-tax" className="hover:text-primary transition-colors">ระบบภาษี</Link>
                        <span>/</span>
                        <span className="text-foreground font-medium">รายงานภาษีมูลค่าเพิ่ม</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary" />
                        รายงานภาษีมูลค่าเพิ่ม (ภ.พ. 30)
                    </h1>
                    <p className="text-muted-foreground">
                        สรุปรายการภาษีซื้อ-ขายรายเดือน เพื่อใช้ยื่นแบบแสดงรายการภาษีมูลค่าเพิ่ม
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/settings/tax">
                        ตั้งค่าภาษี
                    </Link>
                </Button>
            </div>

            <VatReportDashboard />
        </div>
    );
}
