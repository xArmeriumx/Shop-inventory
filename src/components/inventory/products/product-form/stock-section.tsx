'use client';

import { useFormContext } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Box, Home, ArrowDownCircle } from 'lucide-react';

export function StockSection() {
    const { register, watch, setValue, control, formState: { errors } } = useFormContext();

    const stock = watch('stock');
    const minStock = watch('minStock');
    const reservedStock = watch('reservedStock') || 0;
    const isLowStock = stock <= minStock;
    const initialStocks = watch('initialStocks') || [];

    // Auto-calculate total stock from initialStocks if creating NEW product
    const isEdit = watch('id') !== undefined;

    const updateTotalStock = (stocks: any[]) => {
        if (isEdit) return; // Don't auto-calc on edit
        const total = stocks.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        setValue('stock', total, { shouldValidate: true });
    };

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
                        label={isEdit ? "จำนวนคงคลังรวมปัจจุบัน" : "ยอดสต็อกตั้งต้นรวม"}
                        hint="นับรวมจากทุกคลังสินค้า"
                    >
                        <div className="relative">
                            <Input
                                {...register('stock')}
                                type="number"
                                readOnly={!isEdit && initialStocks.length > 0}
                                className={`pl-9 font-bold text-lg ${isLowStock ? 'text-destructive' : 'text-primary'} ${!isEdit && initialStocks.length > 0 ? 'bg-muted' : ''}`}
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
                        label="จุดสั่งซื้อซ้ำ (Min Stock)"
                        hint="เมื่อสต็อกลดลงถึงจุดนี้ ระบบจะแจ้งเตือน"
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
                        label="ตำแหน่งจัดเก็บกลาง"
                        hint="ใช้เป็นค่าเริ่มต้นหากไม่ได้ระบุรายคลัง"
                    >
                        <Input
                            {...register('metadata.binLocation')}
                            placeholder="ระบุรหัสตำแหน่ง..."
                        />
                    </FormField>
                </div>
            </div>

            {/* Editable Initial Stock per Warehouse (Create Mode) */}
            {!isEdit && initialStocks.length > 0 && (
                <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                            <Home className="h-4 w-4" />
                            <span className="text-sm font-bold">กำหนดสต็อกเริ่มต้นรายคลัง</span>
                        </div>
                        <Badge variant="outline" className="bg-white border-primary/20 text-primary">SSOT Mode</Badge>
                    </div>

                    <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/50 border-b">
                                    <th className="text-left py-2 px-3 font-semibold">คลังสินค้า</th>
                                    <th className="text-left py-2 px-3 font-semibold w-32">ตำแหน่งจัดเก็บ</th>
                                    <th className="text-right py-2 px-3 font-semibold w-24">จำนวน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {initialStocks.map((item: any, index: number) => (
                                    <tr key={item.warehouseId} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-2 px-3 font-medium text-muted-foreground">{item.warehouseName}</td>
                                        <td className="py-2 px-3">
                                            <Input
                                                {...register(`initialStocks.${index}.binLocation` as const)}
                                                placeholder="ชั้นวาง..."
                                                className="h-7 text-[11px] border-dashed focus:border-solid px-2"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <Input
                                                type="number"
                                                {...register(`initialStocks.${index}.quantity` as const, {
                                                    onChange: (e) => {
                                                        const newStocks = [...initialStocks];
                                                        newStocks[index].quantity = e.target.value;
                                                        updateTotalStock(newStocks);
                                                    }
                                                })}
                                                className="h-7 text-right font-mono font-bold text-primary px-2"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic text-right">* ยอดสต็อกรวมจะถูกคำนวณอัตโนมัติจากตารางด้านบน</p>
                </div>
            )}

            {/* Read-only Breakdown (Edit Mode) */}
            {isEdit && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Home className="h-4 w-4" />
                        <span className="text-sm font-semibold">ยอดคงเหลือปัจจุบันรายคลัง</span>
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
                                            ยังไม่มีข้อมูลสต็อกในคลังสินค้าใดๆ
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 text-[11px] text-amber-800">
                <p className="font-bold flex items-center gap-2 mb-1 uppercase tracking-tight">
                    <AlertCircle className="h-3.5 w-3.5" /> ERP Inventory Policy:
                </p>
                <p className="opacity-90">
                    การเพิ่มสินค้าจะสร้างความสัมพันธ์กับคลังสินค้าทุกล่วงหน้าแต่ยอดจะเป็น 0 จนกว่าจะมีการระบุยอดตั้งต้น หรือทำใบรับเข้า
                    หลังจากการสร้างสินค้าแล้ว แนะนำให้ใช้เมนู <b>&quot;โอนสินค้า&quot;</b> หรือ <b>&quot;รับสินค้า&quot;</b> เพื่อความแม่นยำสูงสุดครับ
                </p>
            </div>
        </div>
    );
}
