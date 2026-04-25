'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Library, FileText, BarChart3, Plus, RefreshCw } from 'lucide-react';
import { AccountTable } from './account-table';
import { JournalTable } from './journal-table';
import { JournalFormModal } from './journal-form-modal';
import { AccountFormModal } from './account-form-modal';
import { TrialBalanceView } from './trial-balance-view';
import { Badge } from '@/components/ui/badge';

interface AccountingBoardProps {
    initialAccounts: any[];
    initialJournals: any[];
}

export function AccountingBoard({ initialAccounts, initialJournals }: AccountingBoardProps) {
    const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('coa');
    const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

    const handleDrillDown = (accountId: string) => {
        setSelectedAccountId(accountId);
        setActiveTab('journals');
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">ระบบบัญชีแยกประเภท (General Ledger)</h1>
                    <div className="flex items-center gap-2">
                        <p className="text-muted-foreground text-sm">
                            บริหารจัดการผังบัญชีและประวัติการลงรายการสมุดรายวัน
                        </p>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 uppercase tracking-wider text-primary border-primary/20 bg-primary/5">
                            {mode} View
                        </Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-muted/30 p-1 rounded-lg border mr-2">
                        <Button
                            variant={mode === 'simple' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setMode('simple')}
                        >
                            มุมมองทั่วไป
                        </Button>
                        <Button
                            variant={mode === 'advanced' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setMode('advanced')}
                        >
                            โหมดบัญชี (Advanced)
                        </Button>
                    </div>

                    {mode === 'advanced' && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 h-9 border-dashed text-primary hover:text-primary hover:bg-primary/5"
                            onClick={() => setIsAccountModalOpen(true)}
                        >
                            <Plus className="w-4 h-4" />
                            เพิ่มผังบัญชี
                        </Button>
                    )}

                    <Button
                        className="gap-2 shadow-md h-9 bg-primary hover:bg-primary/90"
                        onClick={() => setIsJournalModalOpen(true)}
                    >
                        <Plus className="w-4 h-4" />
                        ลงรายการใหม่ (JV)
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex items-center justify-between border-b pb-1">
                    <TabsList className="bg-transparent p-0 gap-6">
                        <TabsTrigger
                            value="coa"
                            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
                        >
                            <Library className="w-4 h-4" />
                            ผังบัญชี (Chart of Accounts)
                        </TabsTrigger>
                        <TabsTrigger
                            value="journals"
                            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
                        >
                            <FileText className="w-4 h-4" />
                            สมุดรายวันทั่วไป (General Journal)
                        </TabsTrigger>
                        <TabsTrigger
                            value="reports"
                            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none"
                        >
                            <BarChart3 className="w-4 h-4" />
                            งบทดลอง (Trial Balance)
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="coa" className="mt-0 focus-visible:outline-none">
                    {initialAccounts.length > 0 ? (
                        <AccountTable data={initialAccounts} mode={mode} />
                    ) : (
                        <div className="text-center py-20 border rounded-xl border-dashed bg-muted/5">
                            <Library className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium text-muted-foreground">ไม่พบข้อมูลผังบัญชี</h3>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="journals" className="mt-0 focus-visible:outline-none">
                    <JournalTable
                        data={initialJournals}
                        mode={mode}
                        filterByAccountId={selectedAccountId}
                        onClearFilter={() => setSelectedAccountId(undefined)}
                    />
                </TabsContent>

                <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
                    <TrialBalanceView mode={mode} onDrillDown={handleDrillDown} />
                </TabsContent>
            </Tabs>

            <JournalFormModal
                isOpen={isJournalModalOpen}
                onClose={() => setIsJournalModalOpen(false)}
                accounts={initialAccounts}
            />

            <AccountFormModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                accounts={initialAccounts}
            />
        </div>
    );
}
