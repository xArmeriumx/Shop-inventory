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

  const { supplier, purchases, stats } = data;

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
        <Button asChild>
          <Link href={`/purchases/new?supplierId=${supplier.id}`}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Total Spend</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Orders</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold">{stats.orderCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Last Order</span>
            </div>
            <p className="text-sm sm:text-lg font-bold">
              {stats.lastPurchaseDate ? formatThaiDate(stats.lastPurchaseDate) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

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
