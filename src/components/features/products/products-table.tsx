'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SerializedProduct } from '@/types/serialized';
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
import { formatCurrency } from '@/lib/formatters';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { Edit, Trash2, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { deleteProduct } from '@/actions/products';
import { cn } from '@/lib/utils';
import { useState, useTransition } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { Guard } from '@/components/auth/guard';
import { toast } from 'sonner';

interface ProductsTableProps {
  products: SerializedProduct[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function ProductsTable({ products, pagination }: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // RBAC: Check permissions for sensitive columns and actions
  const { hasPermission } = usePermissions();
  const canViewCost = hasPermission('PRODUCT_VIEW_COST');
  // const canDeleteProduct = hasPermission('PRODUCT_DELETE');

  const getCategoryLabel = (value: string) => {
    return PRODUCT_CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบสินค้า "${name}" หรือไม่?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteProduct(id);
      if (!result.success) {
        alert(result.message);
      } else {
        router.refresh();
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">ไม่พบสินค้า</p>
        <Button asChild className="mt-4">
          <Link href="/products/new">เพิ่มสินค้าใหม่</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table with better mobile scroll */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto -mx-px">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead className="hidden sm:table-cell">หมวดหมู่</TableHead>
                {canViewCost && <TableHead className="text-right hidden md:table-cell">ราคาทุน</TableHead>}
                <TableHead className="text-right">ราคาขาย</TableHead>
                <TableHead className="text-right">สต็อก (พร้อมขาย)</TableHead>
                <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const available = product.stock - (product.reservedStock || 0);
                const isLowStock = available <= product.minStock;
                const productImage = product.images?.[0];
                return (
                  <TableRow key={product.id} className={cn("group", !product.isActive && "opacity-60 bg-muted/30")}>
                    <TableCell className="p-2">
                      <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {productImage ? (
                          <Image
                            src={productImage}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium line-clamp-1">{product.name}</p>
                          {!product.isActive && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground border-muted-foreground">
                              ปิดใช้งาน
                            </Badge>
                          )}
                          {!product.isSaleable && product.isActive && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-orange-500 border-orange-500">
                              งดขาย
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {product.sku && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {product.sku}
                            </span>
                          )}
                          <Badge variant="secondary" className="sm:hidden text-[10px] px-1.5 py-0">
                            {getCategoryLabel(product.category)}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">
                        {getCategoryLabel(product.category)}
                      </Badge>
                    </TableCell>
                    {canViewCost && (
                      <TableCell className="text-right hidden md:table-cell">
                        {formatCurrency(product.costPrice.toString())}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(product.salePrice.toString())}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("font-semibold", isLowStock ? 'text-destructive' : 'text-green-600')}>
                          {available}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          จากทั้งหมด {product.stock}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link href={`/products/${product.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Guard permission="PRODUCT_DELETE">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(product.id, product.name)}
                            disabled={deletingId === product.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Guard>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
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
