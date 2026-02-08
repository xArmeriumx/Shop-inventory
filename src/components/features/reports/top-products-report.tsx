'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getTopProducts, getSalesByCategory } from '@/actions/reports';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type TopProductsData = Awaited<ReturnType<typeof getTopProducts>>;
type CategoryData = Awaited<ReturnType<typeof getSalesByCategory>>;

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d', '#4f46e5', '#059669', '#ea580c'];

interface TopProductsReportProps {
  startDate?: string;
  endDate?: string;
}

export function TopProductsReport({ startDate, endDate }: TopProductsReportProps) {
  const [products, setProducts] = useState<TopProductsData | null>(null);
  const [categories, setCategories] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTopProducts(startDate, endDate, 10),
      getSalesByCategory(startDate, endDate),
    ])
      .then(([topData, catData]) => {
        setProducts(topData);
        setCategories(catData);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!products || !categories) return null;

  // Chart data for top products
  const chartData = products.map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    revenue: p.revenue,
    profit: p.estimatedProfit,
  }));

  // Pie data for categories
  const pieData = categories.map(c => ({
    name: c.category,
    value: c.revenue,
    percentage: c.percentage,
  }));

  return (
    <div className="space-y-4">
      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Products Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">สินค้าขายดี Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={100} fontSize={11} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="revenue" name="รายรับ" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="profit" name="กำไร" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sales by Category Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">สัดส่วนยอดขาย ตามหมวดหมู่</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      labelLine={true}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  ไม่มีข้อมูลในช่วงเวลานี้
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">รายละเอียด สินค้าขายดี</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-muted">
                  <th className="text-center py-2 px-2 font-semibold w-10">#</th>
                  <th className="text-left py-2 px-2 font-semibold">สินค้า</th>
                  <th className="text-right py-2 px-2 font-semibold">จำนวนขาย</th>
                  <th className="text-right py-2 px-2 font-semibold">รายรับ</th>
                  <th className="text-right py-2 px-2 font-semibold">กำไรโดยประมาณ</th>
                  <th className="text-right py-2 px-2 font-semibold">จำนวนออร์เดอร์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {products.map((p, i) => (
                  <tr key={p.productId}>
                    <td className="text-center py-2 px-2 font-bold text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="font-medium">{p.name}</div>
                      {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                    </td>
                    <td className="text-right py-2 px-2">{formatNumber(p.quantity)}</td>
                    <td className="text-right py-2 px-2 font-medium text-blue-600">{formatCurrency(p.revenue)}</td>
                    <td className="text-right py-2 px-2 font-medium text-green-600">{formatCurrency(p.estimatedProfit)}</td>
                    <td className="text-right py-2 px-2">{p.orderCount}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูลในช่วงเวลานี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">ยอดขายแยกตามหมวดหมู่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-muted">
                  <th className="text-left py-2 px-2 font-semibold">หมวดหมู่</th>
                  <th className="text-right py-2 px-2 font-semibold">จำนวน</th>
                  <th className="text-right py-2 px-2 font-semibold">รายรับ</th>
                  <th className="text-right py-2 px-2 font-semibold">กำไร</th>
                  <th className="text-right py-2 px-2 font-semibold">สัดส่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {categories.map((c, i) => (
                  <tr key={c.category}>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-medium">{c.category}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2">{formatNumber(c.quantity)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(c.revenue)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(c.profit)}</td>
                    <td className="text-right py-2 px-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${c.percentage}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{c.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
