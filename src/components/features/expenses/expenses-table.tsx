'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { EXPENSE_CATEGORIES } from '@/schemas/expense';
import { Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { deleteExpense } from '@/actions/expenses';
import { useState, useTransition } from 'react';

interface Expense {
  id: string;
  description: string | null;
  amount: number | { toString: () => string };
  category: string;
  date: Date;
}

interface ExpensesTableProps {
  expenses: Expense[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function ExpensesTable({ expenses, pagination }: ExpensesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getCategoryLabel = (value: string) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleDelete = async (id: string, description: string | null) => {
    if (!confirm(`ต้องการลบ "${description || 'รายการนี้'}" หรือไม่?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteExpense(id);
      if (result.error) {
        alert(result.error);
      }
      router.refresh();
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบรายการค่าใช้จ่าย</p>
        <Button asChild className="mt-4">
          <Link href="/expenses/new">บันทึกค่าใช้จ่าย</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead>หมวดหมู่</TableHead>
              <TableHead className="text-right">จำนวนเงิน</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>
                  <div className="text-sm">{formatDate(expense.date)}</div>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{expense.description}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {getCategoryLabel(expense.category)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">
                  -{formatCurrency(expense.amount.toString())}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/expenses/${expense.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          แสดง {((pagination.page - 1) * pagination.limit) + 1} -{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} จาก{' '}
          {pagination.total} รายการ
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrevPage || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            หน้า {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage || isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
