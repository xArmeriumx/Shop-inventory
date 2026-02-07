'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerForm } from './customer-form';
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  MapPin,
  Phone,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Star,
} from 'lucide-react';

// ======================== Types ========================

interface CustomerProfileData {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    taxId: string | null;
    notes: string | null;
    createdAt: Date;
  };
  addresses: Array<{
    id: string;
    label: string | null;
    recipientName: string;
    phone: string | null;
    address: string;
    district: string | null;
    subDistrict: string | null;
    province: string | null;
    postalCode: string | null;
    isDefault: boolean;
  }>;
  stats: {
    totalOrders: number;
    totalSpent: number;
    totalProfit: number;
    totalShipments: number;
    deliveredCount: number;
    returnedCount: number;
    cancelledCount: number;
    pendingCount: number;
    shippedCount: number;
    deliveryRate: number;
    avgShippingCost: number;
    totalShippingCost: number;
    topProvider: string | null;
    providerBreakdown: Record<string, number>;
    firstOrderDate: Date | null;
    lastOrderDate: Date | null;
  };
  sales: Array<{
    id: string;
    invoiceNumber: string;
    date: Date;
    totalAmount: number;
    profit: number;
    paymentMethod: string;
    status: string;
    itemCount: number;
    shipmentCount: number;
    latestShipmentStatus: string | null;
  }>;
  shipments: Array<{
    id: string;
    shipmentNumber: string;
    status: string;
    trackingNumber: string | null;
    shippingProvider: string | null;
    shippingCost: number | null;
    recipientName: string;
    shippingAddress: string;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    saleInvoice: string;
    saleId: string;
  }>;
}

interface CustomerProfileProps {
  data: CustomerProfileData;
}

// ======================== Status Helpers ========================

const shipmentStatusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'รอจัดส่ง', variant: 'secondary' },
  SHIPPED: { label: 'จัดส่งแล้ว', variant: 'default' },
  DELIVERED: { label: 'ส่งสำเร็จ', variant: 'default' },
  RETURNED: { label: 'ส่งคืน', variant: 'destructive' },
  CANCELLED: { label: 'ยกเลิก', variant: 'outline' },
};

const saleStatusMap: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
  ACTIVE: { label: 'ปกติ', variant: 'default' },
  CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

// ======================== Main Component ========================

export function CustomerProfile({ data }: CustomerProfileProps) {
  const { customer, stats, sales, shipments, addresses } = data;

  return (
    <div className="space-y-6">
      {/* ── Profile Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
            )}
            {customer.taxId && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {customer.taxId}
              </span>
            )}
            {stats.firstOrderDate && (
              <span>ลูกค้าตั้งแต่ {formatDate(stats.firstOrderDate)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="ยอดซื้อรวม"
          value={formatCurrency(stats.totalSpent)}
          sub={`${stats.totalOrders} รายการ`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="กำไรรวม"
          value={formatCurrency(stats.totalProfit)}
          sub={stats.totalOrders > 0 ? `เฉลี่ย ${formatCurrency(stats.totalProfit / stats.totalOrders)}/ออเดอร์` : undefined}
        />
        <StatCard
          icon={<Truck className="h-4 w-4" />}
          label="อัตราส่งสำเร็จ"
          value={stats.totalShipments > 0 ? formatPercent(stats.deliveryRate) : '—'}
          sub={`${stats.deliveredCount}/${stats.totalShipments - stats.cancelledCount} พัสดุ`}
        />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="ค่าขนส่งรวม"
          value={formatCurrency(stats.totalShippingCost)}
          sub={stats.topProvider ? `ใช้ ${stats.topProvider} บ่อยสุด` : undefined}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="shipments" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="shipments" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            ประวัติจัดส่ง
            {stats.totalShipments > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {stats.totalShipments}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            ประวัติการซื้อ
            {stats.totalOrders > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {stats.totalOrders}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            ที่อยู่จัดส่ง
            {addresses.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {addresses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            ข้อมูลลูกค้า
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Shipments ── */}
        <TabsContent value="shipments">
          {shipments.length === 0 ? (
            <EmptyState icon={<Truck className="h-10 w-10" />} message="ยังไม่มีประวัติจัดส่ง" />
          ) : (
            <div className="space-y-4">
              {/* Shipment mini stats */}
              <div className="flex flex-wrap gap-3">
                <MiniStat icon={<Clock className="h-3.5 w-3.5 text-yellow-500" />} label="รอจัดส่ง" count={stats.pendingCount} />
                <MiniStat icon={<Truck className="h-3.5 w-3.5 text-blue-500" />} label="กำลังส่ง" count={stats.shippedCount} />
                <MiniStat icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label="สำเร็จ" count={stats.deliveredCount} />
                <MiniStat icon={<RotateCcw className="h-3.5 w-3.5 text-orange-500" />} label="ส่งคืน" count={stats.returnedCount} />
                <MiniStat icon={<XCircle className="h-3.5 w-3.5 text-red-500" />} label="ยกเลิก" count={stats.cancelledCount} />
              </div>

              {/* Provider breakdown */}
              {Object.keys(stats.providerBreakdown).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">ขนส่งที่ใช้</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.providerBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([provider, count]) => (
                          <Badge key={provider} variant="outline" className="gap-1">
                            {provider}
                            <span className="text-muted-foreground">({count})</span>
                          </Badge>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shipments table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">เลขจัดส่ง</th>
                          <th className="px-4 py-3 text-left font-medium">ใบขาย</th>
                          <th className="px-4 py-3 text-left font-medium">Tracking</th>
                          <th className="px-4 py-3 text-left font-medium">ขนส่ง</th>
                          <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                          <th className="px-4 py-3 text-right font-medium">ค่าส่ง</th>
                          <th className="px-4 py-3 text-left font-medium">วันที่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipments.map((s) => {
                          const st = shipmentStatusMap[s.status] || { label: s.status, variant: 'outline' as const };
                          return (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <Link href={`/shipments/${s.id}`} className="text-primary hover:underline font-medium">
                                  {s.shipmentNumber}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <Link href={`/sales/${s.saleId}`} className="text-primary hover:underline">
                                  {s.saleInvoice}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {s.trackingNumber || <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3">{s.shippingProvider || '—'}</td>
                              <td className="px-4 py-3">
                                <Badge variant={st.variant}>{st.label}</Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {s.shippingCost ? formatCurrency(s.shippingCost) : '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(s.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Sales ── */}
        <TabsContent value="sales">
          {sales.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-10 w-10" />} message="ยังไม่มีประวัติการซื้อ" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">เลขใบขาย</th>
                        <th className="px-4 py-3 text-left font-medium">วันที่</th>
                        <th className="px-4 py-3 text-right font-medium">ยอดเงิน</th>
                        <th className="px-4 py-3 text-right font-medium">กำไร</th>
                        <th className="px-4 py-3 text-center font-medium">สินค้า</th>
                        <th className="px-4 py-3 text-left font-medium">ชำระ</th>
                        <th className="px-4 py-3 text-left font-medium">สถานะ</th>
                        <th className="px-4 py-3 text-left font-medium">จัดส่ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => {
                        const st = saleStatusMap[sale.status] || { label: sale.status, variant: 'default' as const };
                        const shipSt = sale.latestShipmentStatus
                          ? shipmentStatusMap[sale.latestShipmentStatus]
                          : null;
                        return (
                          <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <Link href={`/sales/${sale.id}`} className="text-primary hover:underline font-medium">
                                {sale.invoiceNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(sale.date)}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(sale.totalAmount)}</td>
                            <td className="px-4 py-3 text-right text-green-600">{formatCurrency(sale.profit)}</td>
                            <td className="px-4 py-3 text-center">{sale.itemCount}</td>
                            <td className="px-4 py-3">{sale.paymentMethod}</td>
                            <td className="px-4 py-3">
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {shipSt ? (
                                <Badge variant={shipSt.variant}>{shipSt.label}</Badge>
                              ) : sale.status !== 'CANCELLED' ? (
                                <span className="text-muted-foreground text-xs">ยังไม่จัดส่ง</span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Addresses ── */}
        <TabsContent value="addresses">
          {addresses.length === 0 ? (
            <EmptyState icon={<MapPin className="h-10 w-10" />} message="ยังไม่มีที่อยู่จัดส่ง" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <Card key={addr.id} className={addr.isDefault ? 'border-primary/50' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{addr.recipientName}</span>
                          {addr.isDefault && (
                            <Badge variant="default" className="gap-1 text-xs">
                              <Star className="h-3 w-3" /> ค่าเริ่มต้น
                            </Badge>
                          )}
                          {addr.label && (
                            <Badge variant="outline" className="text-xs">{addr.label}</Badge>
                          )}
                        </div>
                        {addr.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {addr.phone}
                          </p>
                        )}
                        <p className="text-sm">{addr.address}</p>
                        {(addr.district || addr.province) && (
                          <p className="text-sm text-muted-foreground">
                            {[addr.subDistrict, addr.district, addr.province, addr.postalCode]
                              .filter(Boolean)
                              .join(' ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Info (edit form) ── */}
        <TabsContent value="info">
          <div className="max-w-2xl">
            <CustomerForm customer={customer} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ======================== Sub-Components ========================

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-lg font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{count}</span>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        {icon}
        <p className="mt-2 text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
