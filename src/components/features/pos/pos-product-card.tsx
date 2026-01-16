'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';
import type { POSProduct } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface POSProductCardProps {
  product: POSProduct;
  onAdd: (product: POSProduct) => void;
  disabled?: boolean;
}

/**
 * POS Product Card - Touch-friendly product card for grid
 */
export function POSProductCard({ product, onAdd, disabled }: POSProductCardProps) {
  const isOutOfStock = product.stock <= 0;
  const isDisabled = disabled || isOutOfStock;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onAdd(product)}
      disabled={isDisabled}
      className={cn(
        'relative flex flex-col rounded-lg border bg-card p-2 sm:p-3 text-left transition-all min-h-[140px]',
        'hover:border-primary hover:shadow-md',
        'active:scale-[0.97] active:bg-muted/50',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'touch-manipulation', // Prevents 300ms delay on touch
        isDisabled && 'opacity-50 cursor-not-allowed hover:border-border hover:shadow-none active:scale-100'
      )}
    >
      {/* Product Image */}
      <div className="relative aspect-square w-full mb-2 rounded-md bg-muted overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Out of stock badge */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="text-xs font-medium text-destructive">หมด</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-1">
          {product.name}
        </h3>
        {product.sku && (
          <p className="text-xs text-muted-foreground truncate mb-1">
            {product.sku}
          </p>
        )}
      </div>

      {/* Price + Stock */}
      <div className="flex items-end justify-between mt-2">
        <span className="text-base font-bold text-primary">
          {formatCurrency(product.salePrice.toString())}
        </span>
        <span className="text-xs text-muted-foreground">
          คงเหลือ {product.stock}
        </span>
      </div>
    </button>
  );
}
