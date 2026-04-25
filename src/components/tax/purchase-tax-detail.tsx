'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FileText, Save, CheckCircle, XCircle, ArrowLeft, History, Link as LinkIcon, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';

import { postPurchaseTax, voidPurchaseTax } from '@/actions/tax/tax.actions';
// Note: Manual update action would be needed for a full edit flow, 
// for now we focus on the core snapshot and posting.

const formSchema = z.object({
    vendorDocNo: z.string().min(1, 'ต้องระบุเลขที่ใบกำกับภาษี'),
    vendorDocDate: z.string().min(1, 'ต้องระบุวันที่'),
    claimStatus: z.enum(['CLAIMABLE', 'WAITING_DOC', 'NON_CLAIMABLE']),
});

interface PurchaseTaxDetailProps {
    doc: any;
}

export function PurchaseTaxDetail({ doc }: PurchaseTaxDetailProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            vendorDocNo: doc.vendorDocNo || '',
            vendorDocDate: doc.vendorDocDate ? format(new Date(doc.vendorDocDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            claimStatus: doc.claimStatus || 'CLAIMABLE',
        },
    });

    const handlePost = async () => {
        // First validate the form (vendorDocNo is required for posting)
        const isValid = await form.trigger();
        if (!isValid) return;

        startTransition(async () => {
            const values = form.getValues();
            await runActionWithToast(postPurchaseTax(doc.id, {
                vendorDocNo: values.vendorDocNo,
                vendorDocDate: new Date(values.vendorDocDate),
                claimStatus: values.claimStatus
            }), {
                successMessage: 'ลงบัญชีภาษีซื้อเรียบร้อยแล้ว',
                onSuccess: () => {
                    setTimeout(() => {
                        router.refresh();
                    }, 100);
                }
            });
        });
    };

    const handleVoid = async () => {
        if (!confirm('ยืนยันระบบจะยกเลิกเอกสารภาษีซื้อนี้และรายการบัญชีที่เกี่ยวข้อง?')) return;

        startTransition(async () => {
            await runActionWithToast(voidPurchaseTax(doc.id), {
                successMessage: 'ยกเลิกเอกสารภาษีซื้อเรียบร้อยแล้ว',
                onSuccess: () => {
                    setTimeout(() => {
                        router.refresh();
                    }, 100);
                }
            });
        });
    };

    const isPosted = doc.status === 'POSTED';
    const isVoided = doc.status === 'VOIDED';
    const isReadOnly = isPosted || isVoided;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/tax/purchase-tax">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{doc.internalDocNo}</h2>
                            <Badge variant={isPosted ? 'default' : isVoided ? 'destructive' : 'secondary'}>
                                {isPosted ? 'ลงบัญชีแล้ว' : isVoided ? 'ยกเลิก' : 'ฉบับร่าง'}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            สร้างเมื่อ {format(new Date(doc.createdAt), 'dd MMMM yyyy HH:mm', { locale: th })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isReadOnly && (
                        <Button
                            className="gap-2"
                            onClick={handlePost}
                            disabled={isPending}
                        >
                            <CheckCircle className="h-4 w-4" />
                            ลงบัญชี (Post)
                        </Button>
                    )}
                    {isPosted && (
                        <Button
                            variant="outline"
                            className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                            onClick={handleVoid}
                            disabled={isPending}
                        >
                            <XCircle className="h-4 w-4" />
                            ยกเลิกเอกสาร (Void)
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Document Info */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ข้อมูลใบกำกับภาษี (Vendor Invoice)</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vendorDocNo">เลขที่ใบกำกับภาษี (จากซัพพลายเออร์)</Label>
                                    <Input
                                        id="vendorDocNo"
                                        placeholder="เช่น INV-2024-001"
                                        {...form.register('vendorDocNo')}
                                        disabled={isReadOnly || isPending}
                                    />
                                    {form.formState.errors.vendorDocNo && (
                                        <p className="text-xs text-destructive">{form.formState.errors.vendorDocNo.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vendorDocDate">วันที่ใบกำกับภาษี</Label>
                                    <Input
                                        id="vendorDocDate"
                                        type="date"
                                        {...form.register('vendorDocDate')}
                                        disabled={isReadOnly || isPending}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>สิทธิการขอคืนภาษี (Claim Status)</Label>
                                    <Select
                                        disabled={isReadOnly || isPending}
                                        value={form.watch('claimStatus')}
                                        onValueChange={(v) => form.setValue('claimStatus', v as any)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CLAIMABLE">ขอคืนภาษีได้ (ปกติ)</SelectItem>
                                            <SelectItem value="WAITING_DOC">รอเอกสารต้นฉบับ (ยังไม่ลงรายงาน)</SelectItem>
                                            <SelectItem value="NON_CLAIMABLE">ไม่ขอคืนภาษี (ภาษีซื้อต้องห้าม)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground italic">
                                        * หากเลือก &quot;ไม่ขอคืนภาษี&quot; ระบบจะไม่นำตัวเลขนี้ไปคำนวณใน ภ.พ. 30
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    รายละเอียดซัพพลายเออร์ (Snapshot)
                                </h4>
                                <div className="space-y-3 pt-2">
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground">ชื่อผู้จำหน่าย</p>
                                        <p className="text-sm font-medium">{doc.vendorNameSnapshot}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground">เลขประจำตัวผู้เสียภาษี</p>
                                        <p className="text-sm font-medium">{doc.vendorTaxIdSnapshot || 'ไม่ระบุ'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-muted-foreground">ที่อยู่ตามใบกำกับภาษี</p>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{doc.vendorAddressSnapshot || 'ไม่ได้ระบุที่อยู่ไว้ขณะเปิดเอกสาร'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Right: Summary & Links */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">สรุปมูลค่าภาษี</CardTitle>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">มูลค่าฐานภาษี (Taxable)</span>
                                <span>{formatCurrency(Number(doc.taxableBaseAmount))}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium text-blue-600">ภาษีมูลค่าเพิ่ม ({doc.taxRateSnapshot}%)</span>
                                <span className="font-bold text-blue-600">{formatCurrency(Number(doc.taxAmount))}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="font-semibold">ยอดรวมสุทธิ</span>
                                <span className="text-xl font-bold">{formatCurrency(Number(doc.netAmount))}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">เอกสารอ้างอิง</CardTitle>
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-4">
                            <div className="space-y-3">
                                {doc.links.map((link: any) => (
                                    <div key={link.id} className="flex items-center justify-between text-sm">
                                        <Link
                                            href={`/purchases/${link.purchaseOrderId}`}
                                            className="font-medium text-primary hover:underline flex items-center gap-1"
                                        >
                                            <FileText className="h-3 w-3" />
                                            {link.purchaseOrder?.purchaseNumber || 'ใบสั่งซื้อ'}
                                        </Link>
                                        <span className="text-muted-foreground">
                                            {formatCurrency(Number(link.allocatedAmount))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {isPosted && (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="pt-4 flex items-start gap-2">
                                <History className="h-4 w-4 text-green-600 mt-1" />
                                <div className="text-xs text-green-800">
                                    <p className="font-semibold">ตรวจสอบโดย</p>
                                    <p>{doc.postedBy?.firstName} {doc.postedBy?.lastName}</p>
                                    <p className="mt-1 opacity-70">{format(new Date(doc.postedAt), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Items List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">รายการสินค้าในใบกำกับภาษี</CardTitle>
                </CardHeader>
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>รายการ / SKU</TableHead>
                            <TableHead className="text-right">จำนวน</TableHead>
                            <TableHead className="text-right">ราคาต่อหน่วย</TableHead>
                            <TableHead className="text-right">ส่วนลด</TableHead>
                            <TableHead className="text-right">ฐานภาษี</TableHead>
                            <TableHead className="text-right text-blue-600">ภาษี</TableHead>
                            <TableHead className="text-right">ยอดรวม</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {doc.items.map((item: any, idx: number) => (
                            <TableRow key={item.id}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{item.productNameSnapshot}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">{item.skuSnapshot || '-'}</div>
                                </TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(Number(item.unitPrice))}</TableCell>
                                <TableCell className="text-right">{formatCurrency(Number(item.discountAmount))}</TableCell>
                                <TableCell className="text-right">{formatCurrency(Number(item.taxableBaseAmount))}</TableCell>
                                <TableCell className="text-right text-blue-600">{formatCurrency(Number(item.taxAmount))}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(Number(item.lineNetAmount))}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
