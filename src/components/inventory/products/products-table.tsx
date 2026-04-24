'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SerializedProduct } from '@/types/serialized';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Badge,
  EmptyState,
  PaginationControl,
} from '@/components/ui';
import { formatCurrency } from '@/lib/formatters';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { Edit, Trash2, Package } from 'lucide-react';
import { deleteProduct } from '@/actions/inventory/products.actions';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks';
import { Guard } from '@/components/core/auth/guard';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCategoryLabel = (value: string) =>
  PRODUCT_CATEGORIES.find((c) => c.value === value)?.label || value;

// ─── ProductsTable ────────────────────────────────────────────────────────────

export function ProductsTable({ products, pagination }: ProductsTableProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canViewCost = hasPermission('PRODUCT_VIEW_COST');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบสินค้า "${name}" หรือไม่?`)) return;
    setDeletingId(id);
    try {
      const result = await deleteProduct(id);
      if (!result.success) toast.error(result.message);
      else { toast.success('ลบสินค้าสำเร็จ'); router.refresh(); }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title="ไม่พบสินค้า"
        action={<Button asChild><Link href="/products/new">เพิ่มสินค้าใหม่</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto -mx-px">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12" />
                <TableHead className="font-bold">สินค้า</TableHead>
                <TableHead className="hidden sm:table-cell font-bold">หมวดหมู่</TableHead>
                {canViewCost && <TableHead className="text-right hidden md:table-cell font-bold">ราคาทุน</TableHead>}
                <TableHead className="text-right font-bold">ราคาขาย</TableHead>
                <TableHead className="text-right font-bold">สต็อก (พร้อมขาย)</TableHead>
                <TableHead className="w-[80px] sm:w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const available = product.stock - (product.reservedStock || 0);
                const isLowStock = available <= product.minStock;
                const productImage = product.images?.[0];
                return (
                  <TableRow key={product.id} className={cn('group', !product.isActive && 'opacity-60 bg-muted/30')}>
                    {/* Thumbnail */}
                    <TableCell className="p-2">
                      <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border/40">
                        {productImage ? (
                          <Image src={productImage} alt={product.name} fill className="object-cover" sizes="40px" />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>

                    {/* Name + SKU */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold line-clamp-1">{product.name}</p>
                          {!product.isActive && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground border-muted-foreground">ปิดใช้งาน</Badge>
                          )}
                          {!product.isSaleable && product.isActive && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-orange-500 border-orange-500">งดขาย</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {product.sku && <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>}
                          <Badge variant="secondary" className="sm:hidden text-[10px] px-1.5 py-0">
                            {getCategoryLabel(product.category)}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>

                    {/* Category (desktop) */}
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{getCategoryLabel(product.category)}</Badge>
                    </TableCell>

                    {/* Cost (RBAC) */}
                    {canViewCost && (
                      <TableCell className="text-right hidden md:table-cell">
                        {formatCurrency(product.costPrice.toString())}
                      </TableCell>
                    )}

                    {/* Sale Price */}
                    <TableCell className="text-right font-bold text-primary">
                      {formatCurrency(product.salePrice.toString())}
                    </TableCell>

                    {/* Stock */}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn('font-bold', isLowStock ? 'text-destructive' : 'text-green-600')}>
                          {available}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          จริง {product.stock} | จอง {product.reservedStock || 0}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" asChild>
                          <Link href={`/products/${product.id}`}><Edit className="h-4 w-4" /></Link>
                        </Button>
                        <Guard permission="PRODUCT_DELETE">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
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

      <PaginationControl pagination={pagination} />
    </div>
  );
}
