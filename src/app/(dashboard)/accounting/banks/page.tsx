import { getSessionContext } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, Building2, Landmark } from 'lucide-react';
import { BankAccountFormModal } from '@/components/accounting/banks/bank-account-form-modal';
import { getAccountsAction } from '@/actions/accounting/accounting.actions';

export default async function BankAccountsPage() {
    const ctx = await getSessionContext();
    if (!ctx) return null;

    const bankAccounts = await (db as any).bankAccount.findMany({
        where: { shopId: ctx.shopId },
        include: { glAccount: true }
    });

    const accountsRes = await getAccountsAction();
    const postableAccounts = accountsRes.success ? (accountsRes.data as any[]).filter((a: any) => a.isPostable) : [];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">บัญชีธนาคาร</h1>
                    <p className="text-muted-foreground">จัดการบัญชีธนาคารและเชื่อมโยงกับผังบัญชี (CoA)</p>
                </div>
                <BankAccountFormModal postableAccounts={postableAccounts}>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        เพิ่มบัญชีธนาคาร
                    </Button>
                </BankAccountFormModal>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bankAccounts.map((bank: any) => (
                    <Card key={bank.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Landmark className="h-16 w-16" />
                        </div>
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="bg-primary/10 p-3 rounded-full">
                                <Building2 className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">{bank.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{bank.bankName}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Account Number</p>
                                <p className="font-mono text-lg">{bank.accountNo}</p>
                            </div>
                            <div className="pt-4 border-t flex justify-between items-end">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Linked CoA</p>
                                    <p className="text-sm font-medium">{bank.glAccount.code} - {bank.glAccount.name}</p>
                                </div>
                                <Button variant="ghost" size="sm">Manage</Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {bankAccounts.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-xl opacity-50">
                        <Wallet className="h-12 w-12 mb-4" />
                        <p className="text-lg font-medium">ยังไม่มีบัญชีธนาคาร</p>
                        <p className="text-sm">กดปุ่ม &quot;เพิ่มบัญชีธนาคาร&quot; เพื่อเริ่มต้น</p>
                    </div>
                )}
            </div>
        </div>
    );
}
