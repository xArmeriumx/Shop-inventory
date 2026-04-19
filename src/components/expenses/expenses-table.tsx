'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePagination, type PaginationInfo } from '@/components/ui/table-pagination';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { EXPENSE_CATEGORIES } from '@/schemas/expense';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { Edit, Trash2, Receipt } from 'lucide-react';
import { deleteExpense } from '@/actions/expenses';
import { toast } from 'sonner';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, description: string | null) => {
    if (!confirm(`ต้องการลบ "${description || 'รายการนี้'}" หรือไม่?`)) return;
    setDeletingId(id);
    try {
      const result = await deleteExpense(id);
      if (!result.success) toast.error(result.message || 'เกิดข้อผิดพลาด');
      else toast.success('ลบรายการสำเร็จ');
      router.refresh();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
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
                        disabled={deletingId === expense.id}
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
