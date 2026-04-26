'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Badge,
  EmptyState,
  TablePagination,
} from '@/components/ui';
import type { PaginationInfo } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { EXPENSE_CATEGORIES } from '@/schemas/accounting/expense.schema';
import { useUrlFilters } from '@/hooks';
import { Edit, Trash2, Receipt } from 'lucide-react';
import { deleteExpense } from '@/actions/accounting/expense.actions';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useTransition } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  description: string | null;
  amount: number | { toString: () => string };
  category: string;
  date: Date;
}

interface ExpensesTableProps {
  expenses: Expense[];
  pagination: PaginationInfo;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCategoryLabel = (value: string) =>
  EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;

// ─── ExpensesTable ────────────────────────────────────────────────────────────

export function ExpensesTable({ expenses, pagination }: ExpensesTableProps) {
  const router = useRouter();
  const { goToPage, isPending } = useUrlFilters();
  const [isPendingDelete, startTransition] = useTransition();

  const handleDelete = (id: string, description: string | null) => {
    if (!confirm(`ต้องการลบ "${description || 'รายการนี้'}" หรือไม่?`)) return;
    
    startTransition(async () => {
      await runActionWithToast(deleteExpense(id), {
        successMessage: 'ลบรายการสำเร็จ',
        onSuccess: () => router.refresh(),
      });
    });
  };

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-12 w-12" />}
        title="ไม่พบรายการค่าใช้จ่าย"
        action={<Button asChild><Link href="/expenses/new">บันทึกค่าใช้จ่าย</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead className="hidden sm:table-cell">หมวดหมู่</TableHead>
                <TableHead className="text-right">จำนวนเงิน</TableHead>
                <TableHead className="w-[80px] sm:w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <div className="text-sm">{formatDate(expense.date)}</div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium line-clamp-1">{expense.description}</p>
                    {/* Mobile: category inline */}
                    <div className="sm:hidden mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {getCategoryLabel(expense.category)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{getCategoryLabel(expense.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    -{formatCurrency(expense.amount.toString())}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/expenses/${expense.id}`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleDelete(expense.id, expense.description)}
                        disabled={isPendingDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <TablePagination pagination={pagination} onPageChange={goToPage} isPending={isPending} />
    </div>
  );
}
