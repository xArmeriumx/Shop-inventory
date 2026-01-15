'use client';

import { ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POSCartItemRow } from './pos-cart-item';
import type { POSCart, POSCartItem } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface POSCartPanelProps {
  cart: POSCart;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isProcessing: boolean;
}

/**
 * POS Cart Panel - Left side cart with items and totals
 */
export function POSCartPanel({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  isProcessing,
}: POSCartPanelProps) {
  const isEmpty = cart.items.length === 0;

  return (
    <div className="flex flex-col h-full bg-card border-r">
      {/* Cart Header */}
      <div className="shrink-0 p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">ตะกร้าสินค้า</span>
          {cart.itemCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
              {cart.itemCount}
            </span>
          )}
        </div>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCart}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            ล้าง
          </Button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">ยังไม่มีสินค้าในตะกร้า</p>
            <p className="text-xs mt-1">คลิกสินค้าหรือสแกนบาร์โค้ด</p>
          </div>
        ) : (
          <div className="py-2">
            {cart.items.map((item) => (
              <POSCartItemRow
                key={item.productId}
                item={item}
                onUpdateQuantity={onUpdateQuantity}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart Summary */}
      <div className="shrink-0 border-t bg-muted/30 p-4 space-y-3">
        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">รวมสินค้า ({cart.itemCount} ชิ้น)</span>
            <span>{formatCurrency(cart.totalAmount.toString())}</span>
          </div>
          {/* Show profit only if needed */}
          {/* <div className="flex justify-between text-xs text-muted-foreground">
            <span>กำไร</span>
            <span className="text-green-600">+{formatCurrency(cart.profit.toString())}</span>
          </div> */}
        </div>

        {/* Total */}
        <div className="flex justify-between items-baseline pt-2 border-t">
          <span className="font-semibold text-lg">ยอดรวม</span>
          <span className="font-bold text-2xl text-primary">
            {formatCurrency(cart.totalAmount.toString())}
          </span>
        </div>

        {/* Checkout Button */}
        <Button
          size="lg"
          className="w-full h-14 text-lg"
          onClick={onCheckout}
          disabled={isEmpty || isProcessing}
        >
          {isProcessing ? (
            'กำลังดำเนินการ...'
          ) : (
            <>
              💳 ชำระเงิน {!isEmpty && formatCurrency(cart.totalAmount.toString())}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
