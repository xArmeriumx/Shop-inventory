import { Suspense } from 'react';
import { getSuppliers } from '@/actions/suppliers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
  };
}

async function SuppliersContent({ searchParams }: PageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  
  const { data: suppliers, pagination } = await getSuppliers({
    page,
    search,
    limit: 20,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>รายการผู้จำหน่าย</CardTitle>
          <Link href="/suppliers/new">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มผู้จำหน่าย
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">ยังไม่มีผู้จำหน่าย</h3>
            <p className="text-muted-foreground mb-4">
              เริ่มเพิ่มผู้จำหน่ายเพื่อติดตามการสั่งซื้อ
            </p>
            <Link href="/suppliers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มผู้จำหน่ายแรก
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {suppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{supplier.name}</h3>
                    {supplier.code && (
                      <span className="text-xs text-muted-foreground">
                        ({supplier.code})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    {supplier.phone && (
                      <span>📞 {supplier.phone}</span>
                    )}
                    {supplier.email && (
                      <span>✉️ {supplier.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/suppliers/${supplier.id}`}>
                    <Button variant="outline" size="sm">
                      ดูรายละเอียด
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
            
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {pagination.page > 1 && (
                  <Link href={`/suppliers?page=${pagination.page - 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">← ก่อนหน้า</Button>
                  </Link>
                )}
                <span className="px-4 py-2 text-sm">
                  หน้า {pagination.page} / {pagination.totalPages}
                </span>
                {pagination.page < pagination.totalPages && (
                  <Link href={`/suppliers?page=${pagination.page + 1}${search ? `&search=${search}` : ''}`}>
                    <Button variant="outline" size="sm">ถัดไป →</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuppliersLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuppliersPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ผู้จำหน่าย</h1>
        <p className="text-muted-foreground">จัดการข้อมูลผู้จำหน่ายและประวัติการสั่งซื้อ</p>
      </div>
      
      <Suspense fallback={<SuppliersLoading />}>
        <SuppliersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
