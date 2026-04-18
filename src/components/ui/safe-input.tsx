'use client';

import * as React from 'react';
import { Input, InputProps } from './input';

interface SafeInputProps extends InputProps {
    numericOnly?: boolean;
    maxLength?: number;
}

const SafeInput = React.forwardRef<HTMLInputElement, SafeInputProps>(
    ({ numericOnly, maxLength, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (numericOnly) {
                // Remove non-numeric characters
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }

            if (maxLength && e.target.value.length > maxLength) {
                e.target.value = e.target.value.slice(0, maxLength);
            }

            if (onChange) {
                onChange(e);
            }
        };

        return (
            <Input
                {...props}
                ref={ref}
                onChange={handleChange}
                inputMode={numericOnly ? 'numeric' : props.inputMode}
                pattern={numericOnly ? '[0-9]*' : props.pattern}
            />
        );
    }
);
SafeInput.displayName = 'SafeInput';

export { SafeInput };
