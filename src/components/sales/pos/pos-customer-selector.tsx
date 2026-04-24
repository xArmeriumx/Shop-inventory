'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Phone, User, Users, X } from 'lucide-react';
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
import { POSCustomer } from '@/lib/pos/types';

interface POSCustomerSelectorProps {
  customers: POSCustomer[];
  selectedCustomer: POSCustomer | null;
  onSelect: (customer: POSCustomer | null) => void;
  onSearchChange?: (value: string) => void;
}

export function POSCustomerSelector({
  customers,
  selectedCustomer,
  onSelect,
  onSearchChange,
}: POSCustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Handle local search if needed, but Command handles filtering mostly
  React.useEffect(() => {
    onSearchChange?.(search);
  }, [search, onSearchChange]);

  const handleSelect = (customer: POSCustomer) => {
    onSelect(customer);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  // Create temporary customer object from search input if not found
  const handleCreateTemp = () => {
    if (!search.trim()) return;
    
    // Check if input looks like a phone number
    const isPhone = /^[0-9-]+$/.test(search);
    
    // Create temp customer
    const tempCustomer: POSCustomer = {
      id: `temp-${Date.now()}`,
      name: isPhone ? `ลูกค้าทั่วไป (${search})` : search,
      phone: isPhone ? search : null,
    };
    
    onSelect(tempCustomer);
    setOpen(false);
    setSearch('');
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  );

  const showCreateOption = search.length > 0 && 
    !filteredCustomers.some(c => c.name.toLowerCase() === search.toLowerCase());

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-12 text-base",
              selectedCustomer ? "bg-primary/5 border-primary/20" : "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 truncate">
              {selectedCustomer ? (
                <>
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium text-foreground">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && (
                    <span className="text-muted-foreground text-sm">({selectedCustomer.phone})</span>
                  )}
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 shrink-0" />
                  <span>ระบุลูกค้า (ชื่อ / เบอร์โทร)</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {selectedCustomer && (
                <div
                  role="button"
                  onClick={handleClear}
                  className="p-1 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-colors mr-1"
                >
                  <X className="h-4 w-4" />
                </div>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="ค้นหาชื่อ หรือเบอร์โทร..." 
              value={search}
              onValueChange={setSearch}
              className="h-11"
            />
            <CommandList>
              <CommandEmpty>
                <div className="p-2 text-center text-sm text-muted-foreground">
                  ไม่พบข้อมูล
                  {showCreateOption && (
                    <Button 
                      variant="ghost" 
                      className="mt-2 w-full text-primary"
                      onClick={handleCreateTemp}
                    >
                      ใช้ชื่อ &quot;{search}&quot;
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              
              <CommandGroup heading="รายชื่อสมาชิก">
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.phone || ''}`}
                    onSelect={() => handleSelect(customer)}
                    className="cursor-pointer py-2"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{customer.name}</span>
                      {customer.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
