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
import { getReportData } from '@/actions/accounting/reports.actions';
import { 
    BarChart3, 
    Package, 
    TrendingUp, 
    GitCompare, 
    LayoutDashboard, 
    Wallet, 
    PieChart, 
    Store, 
    Users, 
    Sparkles
} from 'lucide-react';
import { IntelligenceDashboard } from './intelligence-dashboard';
import { cn } from '@/lib/utils';

type ReportData = Awaited<ReturnType<typeof getReportData>>;

interface ReportTabsProps {
  activeTab: string;
  startDate?: string;
  endDate?: string;
  overviewData: ReportData | null;
}

/**
 * ReportTabs — Orchestrator for the Reports Hub.
 * Refactored for SSOT and Clean Logic.
 * Simplified UI as per user request.
 */
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
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // SSOT Tab Configuration
  const tabs = [
    { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profit-loss', label: 'P&L', icon: Wallet },
    { id: 'channels', label: 'Channels', icon: Store },
    { id: 'expense-category', label: 'Expenses', icon: PieChart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'stock-value', label: 'Stock Value', icon: Package },
    { id: 'top-products', label: 'Best Sellers', icon: BarChart3 },
    { id: 'profit', label: 'Profit/Item', icon: TrendingUp },
    { id: 'comparison', label: 'Compare', icon: GitCompare },
  ];

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      {/* 1. Navigation Toolbar (SSOT) — Simplified UI */}
      <div className="print:hidden">
        <TabsList className="w-full flex-wrap h-auto bg-muted p-1 rounded-lg">
          {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className="gap-2 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                </TabsTrigger>
              );
          })}
        </TabsList>
      </div>

      {/* 2. Content Injection (Orchestration) — Standard Containers */}
      <div className="mt-4">
          <TabsContent value="intelligence" className="mt-0 outline-none">
            <IntelligenceDashboard startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="overview" className="mt-0 outline-none space-y-6">
            <ReportToolbar startDate={startDate} endDate={endDate} />
            {overviewData && overviewData.success && (
              <div className="space-y-6">
                <div className="print:hidden bg-card border rounded-lg p-6">
                   <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <BarChart3 className="h-5 w-5 text-primary" />
                       Analytics Trends
                   </h3>
                   <ReportCharts data={overviewData.data} />
                </div>
                <div className="bg-card border rounded-lg">
                    <ReportView data={overviewData.data} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profit-loss" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                <ProfitLossReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="channels" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                <SalesChannelReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expense-category" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                <ExpenseCategoryReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="customers" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                <CustomerRankingReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stock-value" className="mt-0 outline-none">
            <div className="bg-card border rounded-lg">
                <StockValueReport />
            </div>
          </TabsContent>

          <TabsContent value="top-products" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                 <TopProductsReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profit" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-card border rounded-lg">
                <ProfitByProductReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="mt-0 outline-none">
            <div className="bg-card border rounded-lg">
                <PeriodComparisonReport />
            </div>
          </TabsContent>
      </div>
    </Tabs>
  );
}
