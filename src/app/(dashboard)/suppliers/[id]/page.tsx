import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Plus,
  Package,
  Clock,
  Wallet,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getSupplierProfile } from '@/actions/suppliers';
import { formatCurrency } from '@/lib/formatters';

function formatThaiDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(d, 'Asia/Bangkok');
  return format(zonedDate, 'd MMM yyyy', { locale: th });
}

export default async function SupplierProfilePage({ params }: { params: { id: string } }) {
  let data;

  try {
    data = await getSupplierProfile(params.id);
  } catch {
    notFound();
  }

  if (!data) notFound();
  const { supplier, purchases, stats, topProducts } = data as any;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
          {supplier.code && (
            <p className="text-sm text-muted-foreground">Code: {supplier.code}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Supplier
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/purchases/new?supplierId=${supplier.id}`}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs">ยอดซื้อรวม</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(stats.totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <span className="text-xs">จำนวนออเดอร์</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{stats.orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="h-4 w-4 text-purple-600" />
              <span className="text-xs">เฉลี่ย/ออเดอร์</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-xs">ความถี่สั่งซื้อ</span>
            </div>
            <p className="text-lg sm:text-xl font-bold">
              {stats.avgDaysBetweenOrders > 0 ? `${stats.avgDaysBetweenOrders} วัน` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4 text-teal-600" />
              <span className="text-xs">สั่งล่าสุด</span>
            </div>
            <p className="text-sm sm:text-lg font-bold">
              {stats.lastPurchaseDate ? formatThaiDate(stats.lastPurchaseDate) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      {topProducts && topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              สินค้าที่ซื้อบ่อย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[450px]">
                <thead>
                  <tr className="border-b-2 border-muted">
                    <th className="text-left py-2 px-2 font-semibold">สินค้า</th>
                    <th className="text-right py-2 px-2 font-semibold">จำนวนรวม</th>
                    <th className="text-right py-2 px-2 font-semibold">มูลค่า</th>
                    <th className="text-right py-2 px-2 font-semibold">ออเดอร์</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {topProducts.map((product: any) => (
                    <tr key={product.productId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-2">
                        <Link href={`/products/${product.productId}`} className="hover:underline">
                          <div className="font-medium">{product.name}</div>
                          {product.sku && <div className="text-xs text-muted-foreground">{product.sku}</div>}
                        </Link>
                      </td>
                      <td className="text-right py-2 px-2">{product.totalQuantity}</td>
                      <td className="text-right py-2 px-2 font-medium">{formatCurrency(product.totalCost)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{product.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {supplier.contactName && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{supplier.contactName}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                {supplier.phone}
              </a>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                {supplier.email}
              </a>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{supplier.address}</span>
            </div>
          )}
          {!supplier.contactName && !supplier.phone && !supplier.email && !supplier.address && (
            <p className="text-sm text-muted-foreground">No contact information</p>
          )}
        </CardContent>
      </Card>

      {/* Purchase History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Purchase History</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/purchases?supplierId=${supplier.id}`}>View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No purchase history
              <br />
              <Button asChild className="mt-4" size="sm">
                <Link href={`/purchases/new?supplierId=${supplier.id}`}>Create First Purchase</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase: any) => (
                <Link
                  key={purchase.id}
                  href={`/purchases/${purchase.id}`}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{formatThaiDate(purchase.date)}</span>
                      <Badge
                        variant={purchase.status === 'CANCELLED' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {purchase.status === 'CANCELLED' ? 'Cancelled' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {purchase.items.map((i: any) => `${i.product.name} ×${i.quantity}`).join(', ')}
                      {purchase.items.length >= 3 && '...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(purchase.totalCost)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {supplier.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
