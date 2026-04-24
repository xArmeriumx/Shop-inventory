import { Suspense } from 'react';
import Link from 'next/link';
import { getLowStockProductsPaginated } from '@/actions/inventory/products.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Search, AlertTriangle } from 'lucide-react';
// import { formatCurrency } from '@/lib/utils'; // Removed to fix build error
// import { Pagination } from '@/components/ui/pagination'; // Removed as we use manual pagination

// Since this is a server component, we receive searchParams as props
interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
  };
}

export default async function LowStockPage({ searchParams }: PageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const limit = 20;

  // 1. Fetch Data directly on server
  const result = await getLowStockProductsPaginated({
    page,
    limit,
    search,
  });

  if (!result.success || !result.data) {
    // Falls back to empty state if action fails
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">เกิดข้อผิดพลาด</h1>
        <p className="text-muted-foreground">ไม่สามารถดึงข้อมูลสินค้าใกล้หมดได้</p>
      </div>
    );
  }

  const { data: products, pagination } = result.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-red-600 flex items-center gap-2">

              สินค้าใกล้หมด (Low Stock)
            </h1>
            <p className="text-muted-foreground">
              รายการสินค้าที่ต้องเติมสต็อกด่วน
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-base font-medium">
              พบ {pagination.total} รายการ
            </CardTitle>

            {/* Simple Search Form using native behavior (Form submission reloads with params) */}
            {/* For better UX, client component search is preferred, but this is zero-js fallback friendly */}
            <form className="flex w-full md:w-auto max-w-sm items-center space-x-2">
              <Input
                type="search"
                placeholder="ค้นหาชื่อ หรือ SKU..."
                name="search"
                defaultValue={search}
              />
              <Button type="submit" size="sm">
                <Search className="h-4 w-4 mr-2" />
                ค้นหา
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="hidden md:table-cell">หมวดหมู่</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">ราคาต้นทุน</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">จุดสั่งซื้อ (Min)</TableHead>
                  <TableHead className="text-center">คงเหลือ (Stock)</TableHead>
                  <TableHead className="text-center hidden md:table-cell">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      ไม่พบสินค้าใกล้หมด
                    </TableCell>
                  </TableRow>
                ) : (
                  (products as any[]).map((product: any) => {
                    const isCritical = product.stock === 0;
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground">{product.sku || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className="font-normal">
                            {product.category || 'ไม่ระบุ'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {Number(product.costPrice).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground hidden lg:table-cell">
                          {product.minStock}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-lg font-bold ${isCritical ? 'text-red-600' : 'text-orange-500'}`}>
                            {product.stock}
                          </span>
                          <span className="text-xs text-muted-foreground block lg:hidden">
                            Min: {product.minStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          {isCritical ? (
                            <Badge variant="destructive">หมดแล้ว</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">
                              ใกล้หมด
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/products/${product.id}?action=restock`}>
                            <Button size="sm" variant="default">
                              เติม
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              {pagination.hasPrevPage ? (
                <Link href={`/products/low-stock?page=${page - 1}&search=${search}`}>
                  <Button variant="outline" size="sm">ก่อนหน้า</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>ก่อนหน้า</Button>
              )}

              <div className="text-sm font-medium">
                หน้า {page} / {pagination.totalPages}
              </div>

              {pagination.hasNextPage ? (
                <Link href={`/products/low-stock?page=${page + 1}&search=${search}`}>
                  <Button variant="outline" size="sm">ถัดไป</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled>ถัดไป</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
