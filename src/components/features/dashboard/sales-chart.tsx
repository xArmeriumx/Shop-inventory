'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';

interface SalesChartProps {
  data: {
    date: string;
    revenue: number;
  }[];
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>ยอดขาย 7 วันล่าสุด</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="date"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `฿${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                    return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                วันที่
                            </span>
                            <span className="font-bold text-muted-foreground">
                                {payload[0].payload.date}
                            </span>
                            </div>
                            <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                ยอดขาย
                            </span>
                            <span className="font-bold">
                                {formatCurrency(payload[0].value as string)}
                            </span>
                            </div>
                        </div>
                        </div>
                    );
                    }
                    return null;
                }}
              />
              <Bar
                dataKey="revenue"
                fill="currentColor"
                radius={[4, 4, 0, 0]}
                className="fill-primary"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
