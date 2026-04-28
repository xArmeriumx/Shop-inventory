'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import {
    getProvinces,
    getAmphoes,
    getTambons,
    getZipcode,
} from '@/lib/thai-address';

// ─── Generic Searchable Combobox ──────────────────────────

interface AddressComboboxProps {
    id: string;
    value: string;
    options: string[];
    placeholder: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    className?: string;
}

function AddressCombobox({
    id,
    value,
    options,
    placeholder,
    disabled = false,
    onChange,
    className,
}: AddressComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filtered = React.useMemo(() => {
        if (!search) return options;
        const lower = search.toLowerCase();
        return options.filter((o) => o.toLowerCase().includes(lower));
    }, [options, search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        'w-full justify-between font-normal text-sm h-9',
                        !value && 'text-muted-foreground',
                        className,
                    )}
                >
                    <span className="truncate">{value || placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
            >
                <Command>
                    <CommandInput
                        placeholder={`ค้นหา${placeholder}...`}
                        value={search}
                        onValueChange={setSearch}
                        className="h-9"
                    />
                    <CommandList>
                        <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                            ไม่พบข้อมูล
                        </CommandEmpty>
                        <CommandGroup>
                            {filtered.slice(0, 150).map((opt) => (
                                <CommandItem
                                    key={opt}
                                    value={opt}
                                    onSelect={() => {
                                        onChange(opt);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            value === opt
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                    {opt}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Main ThaiAddressFields Component ─────────────────────

export interface ThaiAddressValue {
    province?: string | null;
    district?: string | null;   // amphoe
    subDistrict?: string | null; // tambon
    postalCode?: string | null;
}

interface ThaiAddressFieldsProps {
    /** Base form path, e.g. "addresses.0" */
    basePath: string;
    value: ThaiAddressValue;
    onChange: (updated: ThaiAddressValue) => void;
    className?: string;
}

/**
 * ThaiAddressFields — Cascading 4-level Thai address selector:
 * Province → District (Amphoe) → Sub-district (Tambon) → Postal Code (auto-filled)
 *
 * Rule: When a parent level changes, child levels are reset.
 * Rule: Postal code is auto-filled but remains editable for edge cases.
 */
export function ThaiAddressFields({
    basePath,
    value,
    onChange,
    className,
}: ThaiAddressFieldsProps) {
    const provinces = React.useMemo(() => getProvinces(), []);

    const amphoes = React.useMemo(
        () => (value.province ? getAmphoes(value.province) : []),
        [value.province],
    );

    const tambons = React.useMemo(
        () =>
            value.province && value.district
                ? getTambons(value.province, value.district)
                : [],
        [value.province, value.district],
    );

    // ── Handlers: cascade reset ────────────────────────────

    const handleProvinceChange = (province: string) => {
        onChange({
            province,
            district: null,
            subDistrict: null,
            postalCode: null,
        });
    };

    const handleAmphoeChange = (district: string) => {
        onChange({
            ...value,
            district,
            subDistrict: null,
            postalCode: null,
        });
    };

    const handleTambonChange = (subDistrict: string) => {
        const zipcode =
            value.province && value.district
                ? getZipcode(value.province, value.district, subDistrict)
                : null;
        onChange({
            ...value,
            subDistrict,
            postalCode: zipcode ?? value.postalCode,
        });
    };

    const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...value, postalCode: e.target.value });
    };

    return (
        <div className={cn('grid gap-3 sm:grid-cols-4', className)}>
            {/* Province */}
            <FormField
                name={`${basePath}.province`}
                label="จังหวัด"
            >
                <AddressCombobox
                    id={`${basePath}-province`}
                    value={value.province ?? ''}
                    options={provinces}
                    placeholder="เลือกจังหวัด"
                    onChange={handleProvinceChange}
                />
            </FormField>

            {/* District (Amphoe) */}
            <FormField
                name={`${basePath}.district`}
                label="อำเภอ / เขต"
            >
                <AddressCombobox
                    id={`${basePath}-district`}
                    value={value.district ?? ''}
                    options={amphoes}
                    placeholder={value.province ? 'เลือกอำเภอ' : 'เลือกจังหวัดก่อน'}
                    disabled={!value.province}
                    onChange={handleAmphoeChange}
                />
            </FormField>

            {/* Sub-district (Tambon) */}
            <FormField
                name={`${basePath}.subDistrict`}
                label="ตำบล / แขวง"
            >
                <AddressCombobox
                    id={`${basePath}-subDistrict`}
                    value={value.subDistrict ?? ''}
                    options={tambons}
                    placeholder={value.district ? 'เลือกตำบล' : 'เลือกอำเภอก่อน'}
                    disabled={!value.district}
                    onChange={handleTambonChange}
                />
            </FormField>

            {/* Postal Code — auto-filled, still editable */}
            <FormField
                name={`${basePath}.postalCode`}
                label="รหัสไปรษณีย์"
            >
                <div className="relative">
                    <Input
                        id={`${basePath}-postalCode`}
                        value={value.postalCode ?? ''}
                        onChange={handlePostalCodeChange}
                        placeholder="xxxxx"
                        maxLength={5}
                        inputMode="numeric"
                        className={cn(
                            'h-9 pr-7',
                            value.postalCode && 'text-foreground',
                        )}
                    />
                    {value.subDistrict && value.postalCode && (
                        <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary opacity-70 pointer-events-none" />
                    )}
                </div>
            </FormField>
        </div>
    );
}
