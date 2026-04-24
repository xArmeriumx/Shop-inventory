'use client';

import { useRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { ReportData } from '@/actions/accounting/reports.actions';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';

interface ReportViewProps {
  data: ReportData;
}

export function ReportView({ data }: ReportViewProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvData = data.dailyStats.map(stat => ({
      วันที่: formatDate(new Date(stat.date)),
      ยอดขาย: stat.sales,
      ต้นทุน: stat.cost,
      ค่าใช้จ่าย: stat.expenses,
      กำไรสุทธิ: stat.profit
    }));
    downloadCSV(csvData, `report-${data.period.start.split('T')[0]}-to-${data.period.end.split('T')[0]}`);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <FileDown className="h-4 w-4" />
          Export CSV
        </Button>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          พิมพ์ / บันทึก PDF
        </Button>
      </div>

      {/* Printable Area */}
      <div 
        ref={componentRef}
        className="bg-white p-8 shadow-sm print:shadow-none print:p-0 min-h-[29.7cm] mx-auto max-w-[21cm] text-black"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">รายงานสรุปรายรับ-รายจ่าย</h1>
          <p className="text-muted-foreground print:text-gray-600">
            ประจำวันที่ {formatDate(new Date(data.period.start))} - {formatDate(new Date(data.period.end))}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border rounded-lg p-4 print:border-gray-300">
            <h3 className="text-sm font-semibold text-gray-500 mb-1">รายรับรวม (Sales)</h3>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.summary.totalSales.toString())}</p>
          </div>
          <div className="border rounded-lg p-4 print:border-gray-300">
            <h3 className="text-sm font-semibold text-gray-500 mb-1">รายจ่ายรวม (Expenses + Cost)</h3>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency((data.summary.totalExpenses + data.summary.totalCost).toString())}
            </p>
          </div>
          <div className="border rounded-lg p-4 print:border-gray-300">
            <h3 className="text-sm font-semibold text-gray-500 mb-1">กำไรขั้นต้น (Gross Profit)</h3>
            <p className="text-lg font-bold">
              {formatCurrency((data.summary.totalSales - data.summary.totalCost).toString())}
            </p>
          </div>
          <div className="border rounded-lg p-4 print:border-gray-300 bg-gray-50 print:bg-transparent">
            <h3 className="text-sm font-semibold text-gray-500 mb-1">กำไรสุทธิ (Net Profit)</h3>
            <p className={`text-xl font-bold ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.summary.netProfit.toString())}
            </p>
          </div>
        </div>

        {/* Daily Breakdown Table */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">รายละเอียดรายวัน</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 font-semibold">วันที่</th>
                <th className="text-right py-2 font-semibold">ยอดขาย</th>
                <th className="text-right py-2 font-semibold">ต้นทุน</th>
                <th className="text-right py-2 font-semibold">ค่าใช้จ่าย</th>
                <th className="text-right py-2 font-semibold">กำไรสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.dailyStats.map((stat, i) => (
                <tr key={i} className="print:break-inside-avoid">
                  <td className="py-2">{formatDate(new Date(stat.date))}</td>
                  <td className="text-right py-2 text-green-600">{formatCurrency(stat.sales.toString())}</td>
                  <td className="text-right py-2 text-gray-600">{formatCurrency(stat.cost.toString())}</td>
                  <td className="text-right py-2 text-red-600">{formatCurrency(stat.expenses.toString())}</td>
                  <td className={`text-right py-2 font-medium ${stat.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(stat.profit.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold bg-gray-50 print:bg-transparent">
                <td className="py-3">รวมทั้งหมด</td>
                <td className="text-right py-3 text-green-600">{formatCurrency(data.summary.totalSales.toString())}</td>
                <td className="text-right py-3">{formatCurrency(data.summary.totalCost.toString())}</td>
                <td className="text-right py-3 text-red-600">{formatCurrency(data.summary.totalExpenses.toString())}</td>
                <td className={`text-right py-3 ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.summary.netProfit.toString())}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Signatures Area (For Print) */}
        <div className="hidden print:flex justify-between mt-12 pt-12">
          <div className="text-center w-1/3">
            <div className="border-b border-black mb-2 w-full h-8"></div>
            <p className="text-sm">ผู้จัดทำ</p>
          </div>
          <div className="text-center w-1/3">
            <div className="border-b border-black mb-2 w-full h-8"></div>
            <p className="text-sm">ผู้อนุมัติ</p>
          </div>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block text-xs text-gray-400 text-center mt-8 fixed bottom-4 left-0 w-full">
          พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
        </div>
      </div>
    </div>
  );
}
