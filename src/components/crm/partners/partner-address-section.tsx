'use client';

import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Home, CreditCard, Send, MapPin, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThaiAddressFields } from './thai-address-fields';
import type { ThaiAddressValue } from './thai-address-fields';

// ─── Nested Contact Item ───────────────────────────────────

/**
 * Rule 3 & 5: Stable Nested Contact row
 * Uses register (NOT controller) for performance — no cascade re-render
 */
function ContactItem({
    addressIndex,
    contactIndex,
    onRemove,
}: {
    addressIndex: number;
    contactIndex: number;
    onRemove: () => void;
}) {
    const { register } = useFormContext();
    const fieldPath = `addresses.${addressIndex}.contacts.${contactIndex}`;

    return (
        <div className="flex gap-2 items-start bg-muted/30 p-2 rounded-md border border-dashed">
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 flex-1">
                <FormField name={`${fieldPath}.name`} label="ชื่อผู้ติดต่อ" required>
                    <Input
                        {...register(`${fieldPath}.name`)}
                        placeholder="ชื่อ-นามสกุล"
                        className="h-8 text-xs"
                    />
                </FormField>
                <FormField name={`${fieldPath}.phone`} label="เบอร์โทร">
                    <Input
                        {...register(`${fieldPath}.phone`)}
                        placeholder="08..."
                        className="h-8 text-xs"
                    />
                </FormField>
                <FormField name={`${fieldPath}.email`} label="อีเมล">
                    <Input
                        {...register(`${fieldPath}.email`)}
                        placeholder="email@..."
                        className="h-8 text-xs"
                    />
                </FormField>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive h-8 w-8 mt-6"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

// ─── Main Address Section ──────────────────────────────────

/**
 * PartnerAddressSection
 *
 * Rule 2, 3, 4: Thai cascading address management
 * - Province → District → Sub-district → Postal Code (auto-filled via open-source DB)
 * - Max 1 default billing / 1 default shipping enforced via handleToggleDefault
 * - Nested contacts managed per address
 */
export function PartnerAddressSection() {
    const { control, register, setValue, watch } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'addresses',
        keyName: 'clientKey', // Rule 5: Stable key
    });

    const addresses = watch('addresses') || [];

    const addAddress = () => {
        append({
            label: '',
            addressLine: '',
            subDistrict: null,
            district: null,
            province: null,
            postalCode: null,
            country: 'Thailand',
            type: 'BOTH',
            isDefaultBilling: addresses.length === 0, // Rule 4: Auto set if first
            isDefaultShipping: addresses.length === 0,
            contacts: [],
        });
    };

    const handleToggleDefault = (index: number, type: 'billing' | 'shipping') => {
        const fieldName = type === 'billing' ? 'isDefaultBilling' : 'isDefaultShipping';
        // Rule 4: Exactly 1 default allowed
        addresses.forEach((_: unknown, i: number) => {
            setValue(`addresses.${i}.${fieldName}`, i === index);
        });
    };

    return (
        <div className="space-y-4 pt-4 border-t">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span>ข้อมูลที่อยู่และผู้ติดต่อ</span>
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addAddress} className="gap-1">
                    <Plus className="h-4 w-4" />
                    <span>เพิ่มที่อยู่</span>
                </Button>
            </div>

            {/* Empty state */}
            {fields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                        ยังไม่มีข้อมูลที่อยู่ กรุณาเพิ่มที่อยู่เพื่อใช้ในการออกเอกสาร
                    </p>
                    <Button type="button" variant="link" onClick={addAddress} className="mt-2">
                        คลิกเพื่อเพิ่มที่อยู่แรก
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {fields.map((field, index) => {
                        const basePath = `addresses.${index}`;

                        // Read Thai address values for ThaiAddressFields
                        const thaiAddressValue: ThaiAddressValue = {
                            province: watch(`${basePath}.province`),
                            district: watch(`${basePath}.district`),
                            subDistrict: watch(`${basePath}.subDistrict`),
                            postalCode: watch(`${basePath}.postalCode`),
                        };

                        return (
                            <Card key={field.clientKey} className="relative overflow-hidden group">
                                {/* Accent bar */}
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

                                <CardContent className="pt-6 space-y-4">
                                    {/* ── Row 1: Label, Type, Defaults, Delete ── */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 grid gap-4 sm:grid-cols-4">
                                            {/* Label */}
                                            <FormField
                                                name={`${basePath}.label`}
                                                label="ชื่อเรียกที่อยู่"
                                                required
                                                className="sm:col-span-2"
                                            >
                                                <Input
                                                    {...register(`${basePath}.label`)}
                                                    placeholder="เช่น สำนักงานใหญ่, คลังสินค้า"
                                                />
                                            </FormField>

                                            {/* Type */}
                                            <FormField name={`${basePath}.type`} label="ประเภทที่อยู่">
                                                <Select
                                                    onValueChange={(val) => setValue(`${basePath}.type`, val)}
                                                    defaultValue={watch(`${basePath}.type`)}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="เลือกประเภท" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="BOTH">ทั่วไป (ใช้ทั้งบิลและส่ง)</SelectItem>
                                                        <SelectItem value="BILLING">เฉพาะวางบิล</SelectItem>
                                                        <SelectItem value="SHIPPING">เฉพาะจัดส่งสินค้า</SelectItem>
                                                        <SelectItem value="OTHER">อื่นๆ</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormField>

                                            {/* Default Checkboxes */}
                                            <div className="flex flex-col justify-center gap-2 pt-6">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`bill-${index}`}
                                                        checked={watch(`${basePath}.isDefaultBilling`)}
                                                        onCheckedChange={() => handleToggleDefault(index, 'billing')}
                                                    />
                                                    <label
                                                        htmlFor={`bill-${index}`}
                                                        className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1"
                                                    >
                                                        <CreditCard className="h-3 w-3" /> ที่อยู่บิลเริ่มต้น
                                                    </label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`ship-${index}`}
                                                        checked={watch(`${basePath}.isDefaultShipping`)}
                                                        onCheckedChange={() => handleToggleDefault(index, 'shipping')}
                                                    />
                                                    <label
                                                        htmlFor={`ship-${index}`}
                                                        className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1"
                                                    >
                                                        <Send className="h-3 w-3" /> ที่อยู่ส่งเริ่มต้น
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delete Button */}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => remove(index)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* ── Row 2: Address Line (free-text) ── */}
                                    <FormField
                                        name={`${basePath}.addressLine`}
                                        label="ที่อยู่ (เลขที่, ซอย, ถนน)"
                                        required
                                    >
                                        <Input
                                            {...register(`${basePath}.addressLine`)}
                                            placeholder="เช่น 123 ถนนสุขุมวิท ซอย 1"
                                        />
                                    </FormField>

                                    {/* ── Row 3: Thai Cascading Address (Province → District → Sub-district → Zip) ── */}
                                    <ThaiAddressFields
                                        basePath={basePath}
                                        value={thaiAddressValue}
                                        onChange={(updated) => {
                                            setValue(`${basePath}.province`, updated.province ?? null);
                                            setValue(`${basePath}.district`, updated.district ?? null);
                                            setValue(`${basePath}.subDistrict`, updated.subDistrict ?? null);
                                            setValue(`${basePath}.postalCode`, updated.postalCode ?? null);
                                        }}
                                    />

                                    {/* ── Contacts Section ── */}
                                    <div className="bg-muted/10 p-3 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <Home className="h-3 w-3" /> ผู้ติดต่อ ณ ที่อยู่นี้
                                            </h4>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => {
                                                    const currentContacts = watch(`${basePath}.contacts`) || [];
                                                    setValue(`${basePath}.contacts`, [
                                                        ...currentContacts,
                                                        {
                                                            name: '',
                                                            phone: '',
                                                            email: '',
                                                            isPrimary: currentContacts.length === 0,
                                                        },
                                                    ]);
                                                }}
                                            >
                                                <UserPlus className="h-3 w-3" /> เพิ่มผู้ติดต่อ
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            {(watch(`${basePath}.contacts`) || []).map(
                                                (_: unknown, cIdx: number) => (
                                                    <ContactItem
                                                        key={cIdx}
                                                        addressIndex={index}
                                                        contactIndex={cIdx}
                                                        onRemove={() => {
                                                            const currentContacts =
                                                                watch(`${basePath}.contacts`) || [];
                                                            setValue(
                                                                `${basePath}.contacts`,
                                                                currentContacts.filter(
                                                                    (_: unknown, i: number) => i !== cIdx,
                                                                ),
                                                            );
                                                        }}
                                                    />
                                                ),
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
