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
import { INCOME_CATEGORIES } from '@/schemas/accounting/income.schema';
import { useUrlFilters } from '@/hooks';
import { Edit, Trash2, TrendingUp } from 'lucide-react';
import { deleteIncome } from '@/actions/accounting/income.actions';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useTransition } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Income {
  id: string;
  description: string | null;
  amount: number | { toString: () => string };
  category: string;
  date: Date;
}

interface IncomesTableProps {
  incomes: Income[];
  pagination: PaginationInfo;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCategoryLabel = (value: string) =>
  INCOME_CATEGORIES.find((c) => c.value === value)?.label || value;

// ─── IncomesTable ─────────────────────────────────────────────────────────────

export function IncomesTable({ incomes, pagination }: IncomesTableProps) {
  const router = useRouter();
  const { goToPage, isPending } = useUrlFilters();
  const [isPendingDelete, startTransition] = useTransition();

  const handleDelete = (id: string, description: string | null) => {
    if (!confirm(`ต้องการลบ "${description || 'รายการนี้'}" หรือไม่?`)) return;
    
    startTransition(async () => {
      await runActionWithToast(deleteIncome(id), {
        successMessage: 'ลบรายการสำเร็จ',
        onSuccess: () => router.refresh(),
      });
    });
  };

  if (incomes.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title="ไม่พบรายการรายรับ"
        action={<Button asChild><Link href="/incomes/new">เพิ่มรายรับ</Link></Button>}
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
              {incomes.map((income) => (
                <TableRow key={income.id}>
                  <TableCell>
                    <div className="text-sm">{formatDate(income.date)}</div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium line-clamp-1">{income.description}</p>
                    {/* Mobile: category inline */}
                    <div className="sm:hidden mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {getCategoryLabel(income.category)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{getCategoryLabel(income.category)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    +{formatCurrency(income.amount.toString())}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/incomes/${income.id}`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleDelete(income.id, income.description)}
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
