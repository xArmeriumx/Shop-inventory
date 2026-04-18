'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getStockValueReport, getInventoryTurnover } from '@/actions/reports';
import { Package, AlertTriangle, TrendingDown, DollarSign, RotateCcw, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type StockValueData = Awaited<ReturnType<typeof getStockValueReport>>;
type TurnoverData = Awaited<ReturnType<typeof getInventoryTurnover>>;

export function StockValueReport() {
  const [data, setData] = useState<StockValueData | null>(null);
  const [turnover, setTurnover] = useState<TurnoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'stockValueCost' | 'margin' | 'daysSinceLastSale'>('stockValueCost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterDead, setFilterDead] = useState(false);

  useEffect(() => {
    Promise.all([getStockValueReport(), getInventoryTurnover()])
      .then(([stockData, turnoverData]) => {
        setData(stockData);
        setTurnover(turnoverData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const items = data.items
    .filter(item => !filterDead || item.isDead)
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
      const aVal = a[sortBy] ?? -1;
      const bVal = b[sortBy] ?? -1;
      return mul * ((aVal as number) - (bVal as number));
    });

  const getMarginColor = (margin: number) => {
    if (margin < 10) return 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';
    if (margin < 20) return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
    return 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300';
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => (
    <span className="ml-1 text-xs">{sortBy === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">มูลค่าสต็อก (ทุน)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatCurrency(data.summary.totalCostValue)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{formatNumber(data.summary.totalUnits)} ชิ้น / {data.summary.totalItems} รายการ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">มูลค่าสต็อก (ขาย)</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalRetailValue)}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">กำไรที่คาดหวัง {formatCurrency(data.summary.potentialProfit)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">สินค้าค้างสต็อก</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-red-600">{data.summary.deadStockCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">มูลค่า {formatCurrency(data.summary.deadStockValue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Inventory Turnover</CardTitle>
            <RotateCcw className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{turnover?.turnoverRate ?? '-'}x</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {turnover?.daysSalesOfInventory ? `${turnover.daysSalesOfInventory} วันจึงขายหมด` : 'ข้อมูลไม่เพียงพอ'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base sm:text-lg">รายละเอียดสต็อก</CardTitle>
            <button
              onClick={() => setFilterDead(f => !f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterDead 
                  ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800' 
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              {filterDead ? `แสดง Dead Stock (${data.summary.deadStockCount})` : 'ดูเฉพาะสินค้าค้าง'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-muted">
                  <th className="text-left py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('name')}>
                    สินค้า <SortIcon field="name" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold">สต็อก</th>
                  <th className="text-right py-2 px-2 font-semibold">ราคาทุน</th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('stockValueCost')}>
                    มูลค่า <SortIcon field="stockValueCost" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('margin')}>
                    Margin <SortIcon field="margin" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('daysSinceLastSale')}>
                    ขายล่าสุด <SortIcon field="daysSinceLastSale" />
                  </th>
                  <th className="text-center py-2 px-2 font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {items.map(item => (
                  <tr key={item.id} className={item.isDead ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                    <td className="py-2 px-2">
                      <div className="font-medium">{item.name}</div>
                      {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={item.isLowStock ? 'text-red-600 font-bold' : ''}>{item.stock}</span>
                    </td>
                    <td className="text-right py-2 px-2">{formatCurrency(item.costPrice)}</td>
                    <td className="text-right py-2 px-2 font-medium">{formatCurrency(item.stockValueCost)}</td>
                    <td className="text-right py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getMarginColor(item.margin)}`}>
                        {item.margin}%
                      </span>
                    </td>
                    <td className="text-right py-2 px-2 text-xs">
                      {item.lastSoldDate ? (
                        <div>
                          <div>{item.lastSoldDate}</div>
                          <div className="text-muted-foreground">{item.daysSinceLastSale} วันที่แล้ว</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">ไม่เคยขาย</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {item.isDead && (
                          <Badge variant="destructive" className="text-[10px]">Dead Stock</Badge>
                        )}
                        {item.isLowStock && (
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">Low</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      {filterDead ? 'ไม่พบสินค้าค้างสต็อก 🎉' : 'ไม่มีข้อมูลสินค้า'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-muted/50">
                  <td className="py-3 px-2">รวม ({items.length} รายการ)</td>
                  <td className="text-right py-3 px-2">
                    {formatNumber(items.reduce((s, i) => s + i.stock, 0))}
                  </td>
                  <td className="text-right py-3 px-2">-</td>
                  <td className="text-right py-3 px-2">
                    {formatCurrency(items.reduce((s, i) => s + i.stockValueCost, 0))}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
