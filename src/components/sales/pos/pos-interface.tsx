'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { POSHeader } from './pos-header';
import { ProductCatalog } from './sections/ProductCatalog';
import { CartPanel } from './sections/CartPanel';
import { POSPaymentDialog } from './pos-payment-dialog';
import { POSSuccessDialog } from './pos-success-dialog';

import { createPOSSale, getProductBySKU, getProductsForPOS, getPOSCustomers } from '@/lib/pos/pos-service';
import type { POSProduct, POSCategory, POSCart, POSCartItem, POSCustomer } from '@/lib/pos/types';
import { money, calcSubtotal, calcProfit } from '@/lib/money';
import { runActionWithToast } from '@/lib/mutation-utils';
import { ShortcutHelp } from '@/components/sales/pos/sections/ShortcutHelp'; // We will create this

interface POSInterfaceProps {
  initialProducts: POSProduct[];
  categories: POSCategory[];
  initialCustomers: POSCustomer[];
  shopData: any;
}

export function POSInterface({ initialProducts, categories, initialCustomers, shopData }: POSInterfaceProps) {
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement>(null);

  // --- Core State ---
  const [products, setProducts] = useState<POSProduct[]>(initialProducts);
  const [customers, setCustomers] = useState<POSCustomer[]>(initialCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  
  const [cart, setCart] = useState<POSCart>({
    items: [],
    totalAmount: 0,
    totalCost: 0,
    profit: 0,
    itemCount: 0,
  });

  // UI State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  // ==================== Cart Logic (SSOT) ====================
  
  const syncCartTotals = useCallback((items: POSCartItem[]): POSCart => {
    const totalAmount = items.reduce((sum, item) => money.add(sum, item.subtotal), 0);
    const totalCost = items.reduce((sum, item) => {
        const costPerItem = item.product.costPrice || 0;
        return money.add(sum, calcSubtotal(item.quantity, costPerItem));
    }, 0);
    
    return {
      items,
      totalAmount,
      totalCost,
      profit: calcProfit(totalAmount, totalCost),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, []);

  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.items.find((item) => item.productId === product.id);
      let nextItems: POSCartItem[];

      if (existing) {
        if (existing.quantity >= product.stock) return prev; // Limit to stock
        nextItems = prev.items.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: calcSubtotal(item.quantity + 1, item.salePrice) }
            : item
        );
      } else {
        nextItems = [...prev.items, {
          productId: product.id,
          product,
          quantity: 1,
          salePrice: product.salePrice,
          subtotal: product.salePrice
        }];
      }
      return syncCartTotals(nextItems);
    });
  }, [syncCartTotals]);

  const updateQty = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
        const newItems = prev.items.map(item => 
            item.productId === productId 
                ? { ...item, quantity, subtotal: calcSubtotal(quantity, item.salePrice) }
                : item
        );
        return syncCartTotals(newItems);
    });
  }, [syncCartTotals]);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => syncCartTotals(prev.items.filter(i => i.productId !== productId)));
  }, [syncCartTotals]);

  // ==================== Data Sync ====================

  // Periodic stock sync
  useEffect(() => {
    const handle = setInterval(async () => {
      if (document.hasFocus() && !isPaymentOpen && !isProcessing) {
        const res = await getProductsForPOS();
        if (res.success) setProducts(res.data);
      }
    }, 10000); // 10s is sufficient for high perf
    return () => clearInterval(handle);
  }, [isPaymentOpen, isProcessing]);

  // ==================== Checkout ====================

  const handleCheckoutConfirm = useCallback(async (paymentMethod: string, paidAmount?: number, change?: number, receiptUrl?: string) => {
    setIsProcessing(true);
    
    await runActionWithToast(
      createPOSSale({
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        paymentMethod,
        receiptUrl: receiptUrl || null,
        items: cart.items.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            salePrice: i.salePrice
        }))
      }),
      {
        loadingMessage: '💎 Processing transaction...',
        successMessage: 'Transaction Success',
        onSuccess: (res) => {
            setSuccessData({
                invoiceNumber: res.sale.invoiceNumber,
                saleId: res.sale.id,
                amountReceived: paidAmount,
                change: change
            });
            setCart({ items: [], totalAmount: 0, totalCost: 0, profit: 0, itemCount: 0 });
            setSelectedCustomer(null);
            setIsPaymentOpen(false);
            setIsSuccessOpen(true);
            router.refresh();
        },
        onFinally: () => setIsProcessing(false)
      }
    );
  }, [cart, selectedCustomer, router]);

  // ==================== Render ====================

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      <POSHeader shopName={shopData?.name} userName={shopData?.userName} />

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Interactive Catalog */}
        <section className="flex-1 h-full min-w-0 border-r">
          <ProductCatalog 
            products={products} 
            categories={categories} 
            onAddToCart={addToCart} 
          />
        </section>

        {/* Right: Cart & Billing */}
        <aside className="w-[450px] shrink-0 h-full hidden lg:block">
          <CartPanel 
            cart={cart}
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            onUpdateQty={updateQty}
            onRemoveItem={removeItem}
            onCheckout={() => setIsPaymentOpen(true)}
            isProcessing={isProcessing}
          />
        </aside>
      </main>

      {/* Overlays */}
      <POSPaymentDialog 
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        onConfirm={handleCheckoutConfirm}
        isProcessing={isProcessing}
        promptPayId={shopData?.promptPayId}
      />

      <POSSuccessDialog 
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        invoiceNumber={successData?.invoiceNumber}
        saleId={successData?.saleId}
        amountReceived={successData?.amountReceived}
        change={successData?.change}
      />
      
      <ShortcutHelp />
    </div>
  );
}

function POSLoadingSkeleton() {
    return (
        <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-white font-black tracking-widest animate-pulse">BOOTING POS ENGINE...</span>
            </div>
        </div>
    );
}
