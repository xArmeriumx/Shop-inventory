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
import { cn } from '@/lib/utils';

/**
 * Rule 3 & 5: Stable Nested Contacts
 */
function ContactItem({ addressIndex, contactIndex, onRemove }: { addressIndex: number; contactIndex: number; onRemove: () => void }) {
    const { register } = useFormContext();
    const fieldPath = `addresses.${addressIndex}.contacts.${contactIndex}`;

    return (
        <div className="flex gap-2 items-start bg-muted/30 p-2 rounded-md border border-dashed">
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3 flex-1">
                <FormField name={`${fieldPath}.name`} label="ชื่อผู้ติดต่อ" required>
                    <Input {...register(`${fieldPath}.name`)} placeholder="ชื่อ-นามสกุล" className="h-8 text-xs" />
                </FormField>
                <FormField name={`${fieldPath}.phone`} label="เบอร์โทร">
                    <Input {...register(`${fieldPath}.phone`)} placeholder="08..." className="h-8 text-xs" />
                </FormField>
                <FormField name={`${fieldPath}.email`} label="อีเมล">
                    <Input {...register(`${fieldPath}.email`)} placeholder="email@..." className="h-8 text-xs" />
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

/**
 * Rule 2, 4, 5: Address Management
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
            type: 'BOTH',
            isDefaultBilling: addresses.length === 0, // Rule 4: Auto set if first
            isDefaultShipping: addresses.length === 0,
            contacts: [],
        });
    };

    const handleToggleDefault = (index: number, type: 'billing' | 'shipping') => {
        const fieldName = type === 'billing' ? 'isDefaultBilling' : 'isDefaultShipping';

        // Rule 4: Max 1 default
        addresses.forEach((_: any, i: number) => {
            setValue(`addresses.${i}.${fieldName}`, i === index);
        });
    };

    return (
        <div className="space-y-4 pt-4 border-t">
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

            {fields.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลที่อยู่ กรุณาเพิ่มที่อยู่เพื่อใช้ในการออกเอกสาร</p>
                    <Button type="button" variant="link" onClick={addAddress} className="mt-2">คลิกเพื่อเพิ่มที่อยู่แรก</Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {fields.map((field, index) => (
                        <Card key={field.clientKey} className="relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 grid gap-4 sm:grid-cols-4">
                                        <FormField name={`addresses.${index}.label`} label="ชื่อเรียกที่อยู่" required className="sm:col-span-2">
                                            <Input {...register(`addresses.${index}.label`)} placeholder="เช่น สำนักงานใหญ่, คลังสินค้า" />
                                        </FormField>

                                        <FormField name={`addresses.${index}.type`} label="ประเภทที่อยู่">
                                            <Select
                                                onValueChange={(val) => setValue(`addresses.${index}.type`, val)}
                                                defaultValue={watch(`addresses.${index}.type`)}
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

                                        <div className="flex flex-col justify-center gap-2 pt-6">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`bill-${index}`}
                                                    checked={watch(`addresses.${index}.isDefaultBilling`)}
                                                    onCheckedChange={() => handleToggleDefault(index, 'billing')}
                                                />
                                                <label htmlFor={`bill-${index}`} className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3" /> ตั้งเป็นที่อยู่บิลเริ่มต้น
                                                </label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`ship-${index}`}
                                                    checked={watch(`addresses.${index}.isDefaultShipping`)}
                                                    onCheckedChange={() => handleToggleDefault(index, 'shipping')}
                                                />
                                                <label htmlFor={`ship-${index}`} className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1">
                                                    <Send className="h-3 w-3" /> ตั้งเป็นที่อยู่ส่งเริ่มต้น
                                                </label>
                                            </div>
                                        </div>
                                    </div>
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

                                <div className="grid gap-4 sm:grid-cols-4">
                                    <FormField name={`addresses.${index}.addressLine`} label="ที่อยู่เต็ม (เลขที่, แขวง/ตำบล)" required className="sm:col-span-2">
                                        <Input {...register(`addresses.${index}.addressLine`)} placeholder="เลขที่ห้อง, ถนน, ตำบล/แขวง" />
                                    </FormField>
                                    <FormField name={`addresses.${index}.district`} label="เขต/อำเภอ">
                                        <Input {...register(`addresses.${index}.district`)} placeholder="เขต/อำเภอ" />
                                    </FormField>
                                    <FormField name={`addresses.${index}.province`} label="จังหวัด">
                                        <Input {...register(`addresses.${index}.province`)} placeholder="จังหวัด" />
                                    </FormField>
                                </div>

                                {/* Nested Contacts: Rule 3 */}
                                <div className="bg-muted/10 p-3 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                            ผู้ติดต่อ ณ ที่อยู่นี้
                                        </h4>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={() => {
                                                const currentContacts = watch(`addresses.${index}.contacts`) || [];
                                                setValue(`addresses.${index}.contacts`, [
                                                    ...currentContacts,
                                                    { name: '', phone: '', email: '', isPrimary: currentContacts.length === 0 }
                                                ]);
                                            }}
                                        >
                                            <UserPlus className="h-3 w-3" /> เพิ่มผู้ติดต่อ
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {(watch(`addresses.${index}.contacts`) || []).map((_: any, cIdx: number) => (
                                            <ContactItem
                                                key={cIdx}
                                                addressIndex={index}
                                                contactIndex={cIdx}
                                                onRemove={() => {
                                                    const currentContacts = watch(`addresses.${index}.contacts`) || [];
                                                    setValue(`addresses.${index}.contacts`, currentContacts.filter((_: any, i: number) => i !== cIdx));
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
