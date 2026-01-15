'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface Customer {
  id: string;
  name: string;
}

interface CustomerComboboxProps {
  customers: Customer[];
  value?: string; // customerId or customerName
  onValueChange: (value: string | null, isNewCustomer: boolean) => void;
  placeholder?: string;
}

export function CustomerCombobox({
  customers,
  value,
  onValueChange,
  placeholder = 'เลือกลูกค้า...',
}: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedCustomer = customers.find((c) => c.id === value);
  const displayValue = selectedCustomer?.name || value || placeholder;

  const handleSelect = (currentValue: string) => {
    const customer = customers.find((c) => c.name.toLowerCase() === currentValue.toLowerCase());
    
    if (customer) {
      // Existing customer
      onValueChange(customer.id, false);
    } else {
      // New customer name
      onValueChange(currentValue, true);
    }
    setOpen(false);
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption = search.length > 0 && 
    !filteredCustomers.some((c) => c.name.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {displayValue}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput 
            placeholder="ค้นหาหรือพิมพ์ชื่อลูกค้าใหม่..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>ไม่พบลูกค้า</CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === customer.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {customer.name}
                </CommandItem>
              ))}
              
              {showCreateOption && (
                <CommandItem
                  value={search}
                  onSelect={handleSelect}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  สร้างลูกค้า: &quot;{search}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
