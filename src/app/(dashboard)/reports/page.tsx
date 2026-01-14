import { PageHeader } from '@/components/layout/page-header';
import { ReportView } from '@/components/features/reports/report-view';
import { ReportToolbar } from '@/components/features/reports/report-toolbar';
import { ReportCharts } from '@/components/features/reports/report-charts';
import { getReportData } from '@/actions/reports';

interface ReportsPageProps {
  searchParams: {
    startDate?: string;
    endDate?: string;
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;

  const data = await getReportData(startDate, endDate);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader 
          title="รายงานสรุป" 
          description="ดูรายงานรายรับ รายจ่าย และกำไร" 
        />
      </div>

      <ReportToolbar startDate={startDate} endDate={endDate} />
      
      <div className="print:hidden">
        <ReportCharts data={data} />
      </div>

      <ReportView data={data} />
    </div>
  );
}
