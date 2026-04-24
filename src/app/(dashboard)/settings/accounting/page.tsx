import { getAccountsAction } from '@/actions/accounting/accounting.actions';
import { getJournalsAction } from '@/actions/accounting/journal.actions';
import { AccountingBoard } from '@/components/accounting/accounting-board';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'บัญชีแยกประเภท | Shop Inventory ERP',
    description: 'บริหารจัดการผังบัญชีแยกประเภทและสมุดรายวัน (General Ledger)',
};

export default async function AccountingSettingsPage() {
    const [accRes, journalRes] = await Promise.all([
        getAccountsAction(),
        getJournalsAction({ limit: 50 })
    ]);

    const accounts = accRes.success ? (accRes.data as any[]) : [];
    const journals = journalRes.success ? (journalRes.data as any[]) : [];

    return (
        <div className="flex-1 p-8 max-w-7xl mx-auto">
            <AccountingBoard
                initialAccounts={accounts}
                initialJournals={journals}
            />
        </div>
    );
}
