'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { ReportData } from '@/actions/reports';

interface ReportChartsProps {
  data: ReportData;
}

export function ReportCharts({ data }: ReportChartsProps) {
  // Transform data for charts
  const chartData = data.dailyStats.map((stat) => ({
    date: formatDate(new Date(stat.date)),
    ยอดขาย: stat.sales,
    ค่าใช้จ่าย: stat.cost + stat.expenses, // Cost + Expenses
    กำไร: stat.profit,
  }));

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-8 print:break-inside-avoid">
      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มยอดขายและกำไร</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} tickMargin={10} />
                <YAxis fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value.toString())}
                  labelStyle={{ color: 'black' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ยอดขาย"
                  stroke="#2563eb"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="กำไร"
                  stroke="#16a34a"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs Expense Chart */}
      <Card>
        <CardHeader>
          <CardTitle>เปรียบเทียบ รายรับ vs รายจ่าย</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} tickMargin={10} />
                <YAxis fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value.toString())}
                  labelStyle={{ color: 'black' }}
                />
                <Legend />
                <Bar dataKey="ยอดขาย" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ค่าใช้จ่าย" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
