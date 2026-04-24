'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { POSCartItem } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';

interface POSCartItemRowProps {
  item: POSCartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

/**
 * POS Cart Item Row - Single item in cart with quantity controls
 */
export function POSCartItemRow({ item, onUpdateQuantity, onRemove }: POSCartItemRowProps) {
  const handleIncrement = () => {
    if (item.quantity < item.product.stock) {
      onUpdateQuantity(item.productId, item.quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.productId, item.quantity - 1);
    } else {
      onRemove(item.productId);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm leading-tight truncate">
          {item.product.name}
        </h4>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(item.salePrice.toString())} × {item.quantity}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
          onClick={handleDecrement}
        >
          {item.quantity === 1 ? (
            <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-destructive" />
          ) : (
            <Minus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          )}
        </Button>
        <span className="w-8 text-center font-medium tabular-nums text-base">
          {item.quantity}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
          onClick={handleIncrement}
          disabled={item.quantity >= item.product.stock}
        >
          <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>

      {/* Subtotal */}
      <div className="w-20 text-right font-medium">
        {formatCurrency(item.subtotal.toString())}
      </div>
    </div>
  );
}
