'use client';

import { useFormContext } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Box, Home, ArrowDownCircle } from 'lucide-react';

export function StockSection() {
    const { register, watch, formState: { errors } } = useFormContext();

    const stock = watch('stock');
    const minStock = watch('minStock');
    const reservedStock = watch('reservedStock') || 0;
    const isLowStock = stock <= minStock;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">การควบคุมสต็อก (Inventory Control)</h3>
                </div>
                {isLowStock && (
                    <Badge variant="destructive" className="animate-pulse">
                        <AlertCircle className="h-3 w-3 mr-1" /> สต็อกต่ำกว่าเกณฑ์
                    </Badge>
                )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                    <FormField
                        name="stock"
                        label="จำนวนคงคลังปัจจุบัน (Current Stock)"
                        hint="&quot;คงคลังตัวจริง&quot; (On-hand) คือจำนวนที่นับได้ในโกดังจริงๆ ปัจจุบัน ส่วน &quot;พร้อมสั่งขาย&quot; (Available) คือจำนวนที่หักรายการที่รอลูกค้าโอนเงินออกแล้ว (จะถูกอัปเดตเมื่อมีการซื้อเข้าหรือขายออก)"
                    >
                        <div className="relative">
                            <Input
                                {...register('stock')}
                                type="number"
                                className={`pl-9 font-bold text-lg ${isLowStock ? 'text-destructive' : 'text-primary'}`}
                                placeholder="0"
                            />
                            <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </FormField>

                    <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-xs space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">จำนวนที่จองไว้ (Reserved):</span>
                            <span className="font-mono font-bold text-amber-600">{reservedStock}</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-2">
                            <span className="text-muted-foreground font-semibold">สุทธิพร้อมขาย (Available):</span>
                            <span className="font-mono font-bold text-blue-600">{Math.max(0, stock - reservedStock)}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <FormField
                        name="minStock"
                        label="จุดสั่งซื้อซ้ำ (Min Stock / Reorder Point)"
                        hint="เมื่อสต็อกลดลงถึงจุดนี้ ระบบจะแจ้งเตือนให้สั่งซื้อเพิ่ม"
                    >
                        <div className="relative">
                            <Input
                                {...register('minStock')}
                                type="number"
                                className="pl-9"
                                placeholder="5"
                            />
                            <ArrowDownCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </FormField>

                    <FormField
                        name="metadata.binLocation"
                        label="ตำแหน่งจัดเก็บ (Bin Location)"
                        hint="ระบุรหัสชั้นวางหรือตำแหน่งในคลังสินค้า (e.g. A1-01)"
                    >
                        <Input
                            {...register('metadata.binLocation')}
                            placeholder="ระบุรหัสตำแหน่ง..."
                        />
                    </FormField>
                </div>
            </div>

            {/* Multi-Warehouse Stock Breakdown */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary">
                    <Home className="h-4 w-4" />
                    <span className="text-sm font-semibold">รายการสต็อกแยกตามคลังสินค้า (Stock Breakdown)</span>
                </div>

                <div className="rounded-md border bg-card">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="text-left py-2 px-3 font-medium">คลังสินค้า</th>
                                <th className="text-left py-2 px-3 font-medium">ตำแหน่ง</th>
                                <th className="text-right py-2 px-3 font-medium">จำนวนคงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {(watch('warehouseStocks') && watch('warehouseStocks').length > 0) ? (
                                watch('warehouseStocks').map((ws: any) => (
                                    <tr key={ws.id}>
                                        <td className="py-2 px-3 font-medium">{ws.warehouse?.name} ({ws.warehouse?.code})</td>
                                        <td className="py-2 px-3 text-muted-foreground">{ws.binLocation || '-'}</td>
                                        <td className="py-2 px-3 text-right font-mono font-bold">{ws.quantity}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-4 text-center text-muted-foreground italic">
                                        ยังไม่มีข้อมูลสต็อกในคลังสินค้าใดๆ (สต็อกรวม: {stock})
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="border-t bg-muted/20">
                            <tr>
                                <td colSpan={2} className="py-2 px-3 font-semibold">สต็อกรวมสุทธิ (Total)</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-primary">{stock}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700">
                <p className="font-semibold flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4" /> ระบบ multi-warehouse เปิดใช้งานแล้ว:
                </p>
                <p className="opacity-80">
                    ยอดสต็อกถูกคำนวณแบบ Real-time จากทุกคลังสินค้า (Total Stock = SUM(Warehouse Stocks)).
                    กรุณาใช้เมนู &quot;โอนสินค้า&quot; หรือ &quot;ปรับสต็อกรายคลัง&quot; เพื่อจัดการยอดสินค้าในแต่ละจุด
                </p>
            </div>
        </div>
    );
}
