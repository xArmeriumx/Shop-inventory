'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LookupValue {
  id: string;
  code: string;
  name: string;
  color?: string | null;
}

interface LookupSelectProps {
  values: LookupValue[];
  value?: string;
  onChange: (value: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function LookupSelect({
  values,
  value,
  onChange,
  placeholder = 'เลือก...',
  disabled = false,
  className,
}: LookupSelectProps) {
  const handleChange = (selectedValue: string) => {
    const item = values.find((v) => v.id === selectedValue);
    if (item) {
      onChange(item.id, item.name);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            <span className="flex items-center gap-2">
              {item.color && (
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
