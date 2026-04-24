import { getSessionContext } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2,
    AlertCircle,
    FileUp,
    ArrowRightLeft,
    Clock,
    Search
} from 'lucide-react';
import { ReconcileWorkspace } from '@/components/accounting/reconcile/reconcile-workspace';
import { getAccountsAction } from '@/actions/accounting/accounting.actions';

export default async function ReconcilePage({
    searchParams
}: {
    searchParams: { bankAccountId?: string }
}) {
    const ctx = await getSessionContext();
    if (!ctx) return null;

    const bankAccounts = await db.bankAccount.findMany({
        where: { shopId: ctx.shopId },
        include: { glAccount: true }
    });

    const selectedBankId = searchParams.bankAccountId || (bankAccounts.length > 0 ? bankAccounts[0].id : null);

    // Summary Data for Overview
    const summary = selectedBankId ? await getReconcileSummary(selectedBankId) : null;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="p-6 border-b bg-background z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            Bank Reconciliation
                            <span className="text-sm font-normal bg-primary/10 text-primary px-2 py-1 rounded-md">Phase A1.8</span>
                        </h1>
                        <p className="text-muted-foreground">เปรียบเทียบและจับคู่ยอดเงินในธนาคารกับสมุดรายวัน</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-muted/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="bg-yellow-100 p-2 rounded-full">
                                <Clock className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Uncleared Items</p>
                                <p className="text-xl font-bold">{summary?.unclearedCount || 0} รายการ</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="bg-green-100 p-2 rounded-full">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Cleared Items</p>
                                <p className="text-xl font-bold">{summary?.clearedCount || 0} รายการ</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Difference</p>
                                <p className="text-xl font-bold text-red-500">{summary?.difference?.toLocaleString() || 0} THB</p>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex flex-col justify-center">
                        <Button variant="outline" className="w-full justify-start gap-2" asChild>
                            <a href="/accounting/banks">
                                <Landmark className="h-4 w-4" />
                                Manage Bank Accounts
                            </a>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {selectedBankId ? (
                    <ReconcileWorkspace
                        bankAccounts={bankAccounts}
                        initialBankId={selectedBankId}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
                        <AlertCircle className="h-12 w-12" />
                        <p className="text-xl font-medium">กรุณาเลือกบัญชีธนาคารเพื่อเริ่มการตรวจสอบ</p>
                    </div>
                )}
            </div>
        </div>
    );
}

async function getReconcileSummary(bankAccountId: string) {
    const bankAccount = await db.bankAccount.findUnique({
        where: { id: bankAccountId }
    });
    if (!bankAccount) return null;

    const unclearedLines = await db.bankLine.count({
        where: { statement: { bankAccountId }, matchStatus: 'UNMATCHED' }
    });

    const clearedLines = await db.bankLine.count({
        where: { statement: { bankAccountId }, matchStatus: 'MATCHED' }
    });

    // Mock difference for now
    return {
        unclearedCount: unclearedLines,
        clearedCount: clearedLines,
        difference: 15420.50
    };
}

function Landmark(props: any) {
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
            <line x1="3" y1="22" x2="21" y2="22" />
            <line x1="6" y1="18" x2="6" y2="11" />
            <line x1="10" y1="18" x2="10" y2="11" />
            <line x1="14" y1="18" x2="14" y2="11" />
            <line x1="18" y1="18" x2="18" y2="11" />
            <polygon points="12 2 20 7 4 7" />
        </svg>
    )
}
