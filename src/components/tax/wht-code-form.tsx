'use client';

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import {
    whtCodeSchema,
    WhtCodeFormValues,
    getDefaultWhtCodeValues
} from "@/schemas/wht-form";
import { upsertWhtCode } from "@/actions/wht";
import { toast } from "sonner";
import { useTransition } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface WhtCodeFormProps {
    data?: any;
    onClose: () => void;
}

export function WhtCodeForm({ data, onClose }: WhtCodeFormProps) {
    const [isPending, startTransition] = useTransition();

    const form = useForm<WhtCodeFormValues>({
        resolver: zodResolver(whtCodeSchema),
        defaultValues: getDefaultWhtCodeValues(data),
    });

    const onSubmit = (values: WhtCodeFormValues) => {
        startTransition(async () => {
            try {
                await upsertWhtCode(values, data?.id);
                toast.success(data ? 'แก้ไขรหัสภาษีสำเร็จ' : 'เพิ่มรหัสภาษีสำเร็จ');
                onClose();
            } catch (error) {
                toast.error('ไม่สามารถบันทึกข้อมูลได้');
            }
        });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-width-[500px]">
                <DialogHeader>
                    <DialogTitle>{data ? 'แก้ไขรหัสภาษีหัก ณ ที่จ่าย' : 'เพิ่มรหัสภาษีหัก ณ ที่จ่าย'}</DialogTitle>
                </DialogHeader>

                <FormProvider {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="code" label="รหัสภาษี (Code)" required>
                                <Input
                                    {...form.register("code")}
                                    placeholder="เช่น WH_3, SERVICE_3"
                                    disabled={!!data}
                                />
                            </FormField>

                            <FormField name="rate" label="อัตราภาษี (%)" required>
                                <Input
                                    type="number"
                                    step="0.01"
                                    {...form.register("rate", { valueAsNumber: true })}
                                    placeholder="3"
                                />
                            </FormField>
                        </div>

                        <FormField name="name" label="ชื่อรายการภาษี" required>
                            <Input
                                {...form.register("name")}
                                placeholder="เช่น ค่าบริการ (3%)"
                            />
                        </FormField>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="formType" label="ประเภทแบบฟอร์ม" required>
                                <Select
                                    onValueChange={(v) => form.setValue("formType", v as any)}
                                    defaultValue={form.getValues("formType")}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกแบบฟอร์ม" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PND3">ภ.ง.ด. 3 (บุคคล)</SelectItem>
                                        <SelectItem value="PND53">ภ.ง.ด. 53 (นิติบุคคล)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <FormField name="payeeType" label="ประเภทผู้รับเงิน" required>
                                <Select
                                    onValueChange={(v) => form.setValue("payeeType", v as any)}
                                    defaultValue={form.getValues("payeeType")}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกประเภท" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INDIVIDUAL">บุคคลธรรมดา</SelectItem>
                                        <SelectItem value="CORPORATE">นิติบุคคล</SelectItem>
                                        <SelectItem value="ANY">ทั่วไป (ใช้ได้ทั้งคู่)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </div>

                        <FormField name="incomeCategory" label="หมวดหมู่เงินได้ (สรรพากร)" required>
                            <Input
                                {...form.register("incomeCategory")}
                                placeholder="เช่น ค่าบริการ, ค่าเช่า, ค่าโฆษณา"
                            />
                        </FormField>

                        <div className="flex items-center space-x-2">
                            <Switch
                                id="isActive"
                                checked={form.watch("isActive")}
                                onCheckedChange={(checked) => form.setValue("isActive", checked)}
                            />
                            <Label htmlFor="isActive">เปิดใช้งาน</Label>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                            </Button>
                        </DialogFooter>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
}
