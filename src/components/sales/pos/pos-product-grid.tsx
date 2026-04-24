'use client';

import { useMemo } from 'react';
import { POSProductCard } from './pos-product-card';
import type { POSProduct, POSCategory } from '@/lib/pos/types';
import { cn } from '@/lib/utils';

interface POSProductGridProps {
  products: POSProduct[];
  categories: POSCategory[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  onAddToCart: (product: POSProduct) => void;
  searchQuery?: string;
}

/**
 * POS Product Grid - Category tabs + scrollable product grid
 */
export function POSProductGrid({
  products,
  categories,
  selectedCategory,
  onCategoryChange,
  onAddToCart,
  searchQuery = '',
}: POSProductGridProps) {
  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (selectedCategory && product.category !== selectedCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          (product.sku?.toLowerCase().includes(query) ?? false)
        );
      }
      
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="shrink-0 border-b bg-muted/30 px-3 lg:px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          <CategoryTab
            label="ทั้งหมด"
            isActive={!selectedCategory}
            onClick={() => onCategoryChange(null)}
            count={products.length}
          />
          {categories.map((cat) => (
            <CategoryTab
              key={cat.id}
              label={cat.name}
              isActive={selectedCategory === cat.code}
              onClick={() => onCategoryChange(cat.code)}
              count={products.filter((p) => p.category === cat.code).length}
            />
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-4">
        {filteredProducts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            ไม่พบสินค้า
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {filteredProducts.map((product) => (
              <POSProductCard
                key={product.id}
                product={product}
                onAdd={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Sub-components ====================

interface CategoryTabProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count: number;
}

function CategoryTab({ label, isActive, onClick, count }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-colors min-h-[44px]',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'touch-manipulation active:scale-[0.97]',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-background border hover:bg-muted active:bg-muted/80'
      )}
    >
      {label}
      <span className={cn(
        'ml-1.5 text-xs',
        isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
      )}>
        ({count})
      </span>
    </button>
  );
}
