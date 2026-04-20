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
import { Edit, Trash2, Phone, Mail } from 'lucide-react';
import { deleteCustomer } from '@/actions/customers';
import { useState, useTransition } from 'react';
import { PaginationControl } from '@/components/ui/pagination-control';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface CustomersTableProps {
  customers: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function CustomersTable({ customers, pagination }: CustomersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบลูกค้า "${name}" หรือไม่?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteCustomer(id);
      if (!result.success) {
        alert(result.message);
      }
      router.refresh();
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (customers.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบลูกค้า</p>
        <Button asChild className="mt-4">
          <Link href="/customers/new">เพิ่มลูกค้าใหม่</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">ชื่อลูกค้า</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">ติดต่อ</TableHead>
                <TableHead className="hidden md:table-cell font-bold">ที่อยู่</TableHead>
                <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="font-bold text-primary hover:underline">
                      {customer.name}
                    </Link>
                    {/* Mobile: show contact inline */}
                    <div className="sm:hidden text-xs text-muted-foreground mt-0.5 space-y-0.5">
                      {customer.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="space-y-1 text-sm">
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {customer.address || '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" asChild>
                        <Link href={`/customers/${customer.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => handleDelete(customer.id, customer.name)}
                        disabled={deletingId === customer.id}
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

      <div className="px-4">
        <PaginationControl pagination={pagination} />
      </div>
    </div>
  );
}
