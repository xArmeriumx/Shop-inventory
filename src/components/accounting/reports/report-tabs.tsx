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
    Sparkles,
    ArrowRight
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
 * ReportTabs — Orchestrator for the Premium Analytics Hub (Phase 3).
 * Centralizes all business intelligence routes with high-fidelity UI.
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

  const tabs = [
    { id: 'intelligence', label: 'Intelligence', icon: Sparkles, color: 'text-primary' },
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
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
      {/* 1. Navigation Toolbar (SSOT) */}
      <div className="print:hidden">
        <TabsList className="w-full flex-wrap h-auto p-2 bg-muted/40 backdrop-blur-md rounded-[2.5rem] border-2 border-border gap-2 overflow-x-auto lg:overflow-visible">
          {tabs.map((tab) => {
              const Icon = tab.icon;
              const isIntelligence = tab.id === 'intelligence';
              return (
                <TabsTrigger 
                    key={tab.id}
                    value={tab.id} 
                    className={cn(
                        "rounded-full px-6 py-2.5 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-xl font-black text-xs transition-all gap-2 border border-transparent",
                        isIntelligence && "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-primary/20 bg-primary/5"
                    )}
                >
                    <Icon className={cn("h-4 w-4", tab.color || isIntelligence ? "text-primary" : "text-muted-foreground")} />
                    {tab.label}
                </TabsTrigger>
              );
          })}
        </TabsList>
      </div>

      {/* 2. Content Injection (Orchestration) */}
      
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Intelligence Tab (The Star of Phase 3) */}
          <TabsContent value="intelligence" className="mt-0 outline-none">
            <IntelligenceDashboard startDate={startDate} endDate={endDate} />
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0 outline-none space-y-6">
            <ReportToolbar startDate={startDate} endDate={endDate} />
            {overviewData && overviewData.success && (
              <div className="space-y-8">
                <div className="print:hidden bg-background rounded-[2.5rem] border-2 shadow-2xl p-8 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                   <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                       <BarChart3 className="h-5 w-5 text-primary" />
                       Trend Visualizer
                   </h3>
                   <ReportCharts data={overviewData.data} />
                </div>
                <div className="bg-background rounded-[2.5rem] border-2 shadow-xl p-2 sm:p-6">
                    <ReportView data={overviewData.data} />
                </div>
              </div>
            )}
            {overviewData && !overviewData.success && (
              <div className="py-24 text-center border-2 border-dashed rounded-[2.5rem] bg-destructive/5 text-destructive space-y-4">
                <LayoutDashboard className="h-12 w-12 mx-auto opacity-20" />
                <div className="space-y-1">
                    <p className="text-xl font-black">Data Fetch Failure</p>
                    <p className="text-sm font-medium opacity-70">{overviewData.message}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* P&L Tab */}
          <TabsContent value="profit-loss" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[2.5rem] border-2 shadow-xl p-2 sm:p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-primary" />
                <ProfitLossReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Sales Channel Tab */}
          <TabsContent value="channels" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[3rem] border-2 shadow-2xl p-2 sm:p-8">
                <SalesChannelReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Expense Category Tab */}
          <TabsContent value="expense-category" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[2.5rem] border-2 shadow-xl p-2 sm:p-6 overflow-hidden">
                <ExpenseCategoryReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Customer Ranking Tab */}
          <TabsContent value="customers" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl p-2 sm:p-6 overflow-hidden">
                <CustomerRankingReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Stock Value Tab */}
          <TabsContent value="stock-value" className="mt-0 outline-none">
            <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl p-2 sm:p-6 overflow-hidden">
                <StockValueReport />
            </div>
          </TabsContent>

          {/* Top Products Tab */}
          <TabsContent value="top-products" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl p-2 sm:p-6 overflow-hidden">
                 <TopProductsReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Profit by Product Tab */}
          <TabsContent value="profit" className="mt-0 outline-none">
            <div className="space-y-6">
              <ReportToolbar startDate={startDate} endDate={endDate} />
              <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl p-2 sm:p-6 overflow-hidden">
                <ProfitByProductReport startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </TabsContent>

          {/* Period Comparison Tab */}
          <TabsContent value="comparison" className="mt-0 outline-none">
            <div className="bg-background rounded-[2.5rem] border-2 shadow-2xl p-2 sm:p-6 overflow-hidden">
                <PeriodComparisonReport />
            </div>
          </TabsContent>
      </div>
    </Tabs>
  );
}
