import { PageHeader } from '@/components/layout/page-header';
import { ReportView } from '@/components/reports/report-view';
import { ReportToolbar } from '@/components/reports/report-toolbar';
import { ReportCharts } from '@/components/reports/report-charts';
import { getReportData } from '@/actions/reports';
import { ReportTabs } from '@/components/reports/report-tabs';

interface ReportsPageProps {
  searchParams: {
    startDate?: string;
    endDate?: string;
    tab?: string;
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;
  const activeTab = searchParams.tab || 'overview';

  // Only fetch overview data for the overview tab (server-side)
  const data = activeTab === 'overview' ? await getReportData(startDate, endDate) : null;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader 
          title="รายงานสรุป" 
          description="ดูรายงานรายรับ รายจ่าย กำไร และวิเคราะห์สินค้า" 
        />
      </div>

      <ReportTabs
        activeTab={activeTab}
        startDate={startDate}
        endDate={endDate}
        overviewData={data}
      />
    </div>
  );
}
