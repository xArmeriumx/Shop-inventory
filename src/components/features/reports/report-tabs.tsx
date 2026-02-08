'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ReportToolbar } from './report-toolbar';
import { ReportCharts } from './report-charts';
import { ReportView } from './report-view';
import { StockValueReport } from './stock-value-report';
import { TopProductsReport } from './top-products-report';
import { ProfitByProductReport } from './profit-by-product-report';
import { PeriodComparisonReport } from './period-comparison-report';
import { ProfitLossReport } from './profit-loss-report';
import { ExpenseCategoryReport } from './expense-category-report';
import { SalesChannelReport } from './sales-channel-report';
import { CustomerRankingReport } from './customer-ranking-report';
import { getReportData } from '@/actions/reports';
import { BarChart3, Package, TrendingUp, GitCompare, LayoutDashboard, Wallet, PieChart, Store, Users } from 'lucide-react';

type ReportData = Awaited<ReturnType<typeof getReportData>>;

interface ReportTabsProps {
  activeTab: string;
  startDate?: string;
  endDate?: string;
  overviewData: ReportData | null;
}

export function ReportTabs({ activeTab, startDate, endDate, overviewData }: ReportTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <div className="print:hidden">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <LayoutDashboard className="h-3.5 w-3.5 hidden sm:block" />
            ภาพรวม
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <Wallet className="h-3.5 w-3.5 hidden sm:block" />
            กำไร-ขาดทุน
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <Store className="h-3.5 w-3.5 hidden sm:block" />
            ช่องทางขาย
          </TabsTrigger>
          <TabsTrigger value="expense-category" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <PieChart className="h-3.5 w-3.5 hidden sm:block" />
            หมวดรายจ่าย
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <Users className="h-3.5 w-3.5 hidden sm:block" />
            ลูกค้า
          </TabsTrigger>
          <TabsTrigger value="stock-value" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <Package className="h-3.5 w-3.5 hidden sm:block" />
            มูลค่าสต็อก
          </TabsTrigger>
          <TabsTrigger value="top-products" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
            สินค้าขายดี
          </TabsTrigger>
          <TabsTrigger value="profit" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />
            กำไรรายสินค้า
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5 text-xs sm:text-sm shrink-0">
            <GitCompare className="h-3.5 w-3.5 hidden sm:block" />
            เปรียบเทียบ
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Overview Tab */}
      <TabsContent value="overview">
        <div className="space-y-6">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          {overviewData && (
            <>
              <div className="print:hidden">
                <ReportCharts data={overviewData} />
              </div>
              <ReportView data={overviewData} />
            </>
          )}
        </div>
      </TabsContent>

      {/* P&L Tab */}
      <TabsContent value="profit-loss">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <ProfitLossReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Sales Channel Tab */}
      <TabsContent value="channels">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <SalesChannelReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Expense Category Tab */}
      <TabsContent value="expense-category">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <ExpenseCategoryReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Customer Ranking Tab */}
      <TabsContent value="customers">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <CustomerRankingReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Stock Value Tab */}
      <TabsContent value="stock-value">
        <StockValueReport />
      </TabsContent>

      {/* Top Products Tab */}
      <TabsContent value="top-products">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <TopProductsReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Profit by Product Tab */}
      <TabsContent value="profit">
        <div className="space-y-4">
          <ReportToolbar startDate={startDate} endDate={endDate} />
          <ProfitByProductReport startDate={startDate} endDate={endDate} />
        </div>
      </TabsContent>

      {/* Period Comparison Tab */}
      <TabsContent value="comparison">
        <PeriodComparisonReport />
      </TabsContent>
    </Tabs>
  );
}

