import { Package, TrendingUp, ShoppingCart, Warehouse } from 'lucide-react';
import { MetricGrid, type MetricCardProps } from '@/components/ui/metric-card';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { formatCurrency } from '@/lib/formatters';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
    todaySales: { revenue: number; profit: number; count: number };
    totalProducts: number;
    stockValue: { total: number; itemCount: number };
}

// ─── DashboardSummaryGrid ────────────────────────────────────────────────────

/**
 * Top-level KPI stat cards for the dashboard.
 * Receives pre-fetched stats from the page and maps them to MetricGrid.
 */
export function DashboardSummaryGrid({ stats }: { stats: DashboardStats }) {
    const items: MetricCardProps[] = [
        {
            label: 'วันนี้ยอดขาย',
            value: formatCurrency(stats.todaySales.revenue.toString()),
            hint: `${stats.todaySales.count} รายการ`,
            icon: <ShoppingCart className="h-4 w-4" />,
            iconClassName: 'text-blue-600',
        },
        {
            label: 'วันนี้กำไร',
            value: formatCurrency(stats.todaySales.profit.toString()),
            hint: `จาก ${stats.todaySales.count} รายการ`,
            icon: <TrendingUp className="h-4 w-4" />,
            iconClassName: 'text-green-600',
        },
        {
            label: 'สินค้าทั้งหมด',
            value: stats.totalProducts.toString(),
            hint: 'รายการที่เปิดขาย',
            icon: <Package className="h-4 w-4" />,
            iconClassName: 'text-purple-600',
        },
        {
            label: 'มูลค่าสต็อกรวม',
            value: formatCurrency(stats.stockValue.total.toString()),
            hint: `${stats.stockValue.itemCount} ชิ้นในคลัง`,
            icon: <Warehouse className="h-4 w-4" />,
            iconClassName: 'text-indigo-600',
            href: '/reports?tab=stock-value',
        },
    ];

    return (
        <SafeBoundary variant="compact" componentName="Dashboard:SummaryGrid">
            <MetricGrid items={items} columns={4} />
        </SafeBoundary>
    );
}
