'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getSuppliersForSelect } from '@/actions/purchases/suppliers.actions';

interface SupplierOption {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
}

interface SupplierComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export function SupplierCombobox({
  value,
  onChange,
  error,
  disabled,
}: SupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  useEffect(() => {
    getSuppliersForSelect().then((result) => {
      if (result.success && result.data) setSuppliers(result.data as SupplierOption[]);
    });
  }, []);

  const selected = suppliers.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            error && 'border-destructive'
          )}
          disabled={disabled}
        >
          {selected ? (
            <span className="truncate">
              {selected.name}
              {selected.code && (
                <span className="ml-2 text-muted-foreground text-xs">
                  ({selected.code})
                </span>
              )}
            </span>
          ) : (
            'เลือกผู้จำหน่าย...'
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full sm:w-[400px] p-0">
        <Command>
          <CommandInput placeholder="ค้นหาผู้จำหน่าย..." />
          <CommandEmpty>ไม่พบผู้จำหน่าย</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {suppliers.map((supplier) => (
              <CommandItem
                key={supplier.id}
                value={`${supplier.name} ${supplier.code || ''}`}
                onSelect={() => {
                  onChange(supplier.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === supplier.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{supplier.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {supplier.code && `รหัส: ${supplier.code}`}
                    {supplier.phone && (supplier.code ? ` • ${supplier.phone}` : supplier.phone)}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
