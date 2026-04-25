'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScanBarcode, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { POSHeader } from './pos-header';
import { POSProductGrid } from './pos-product-grid';
import { POSCartPanel } from './pos-cart';
import { POSPaymentDialog } from './pos-payment-dialog';
import { createPOSSale, getProductBySKU } from '@/lib/pos/pos-service';
import type { POSProduct, POSCategory, POSCart, POSCartItem } from '@/lib/pos/types';

interface POSInterfaceProps {
  initialProducts: POSProduct[];
  categories: POSCategory[];
}

/**
 * POS Interface - Main POS component with state management
 * Coordinates all POS sub-components
 */
export function POSInterface({ initialProducts, categories }: POSInterfaceProps) {
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement>(null);

  // State
  const [products] = useState<POSProduct[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [cart, setCart] = useState<POSCart>({
    items: [],
    totalAmount: 0,
    totalCost: 0,
    profit: 0,
    itemCount: 0,
  });
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Focus scan input on mount and after actions
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // ==================== Cart Operations ====================

  const recalculateCart = useCallback((items: POSCartItem[]): POSCart => {
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalCost = items.reduce((sum, item) => sum + (item.product.costPrice * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      totalAmount,
      totalCost,
      profit: totalAmount - totalCost,
      itemCount,
    };
  }, []);

  const addToCart = useCallback((product: POSProduct) => {
    setCart((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.productId === product.id);

      let newItems: POSCartItem[];

      if (existingIndex >= 0) {
        // Increment existing
        newItems = prev.items.map((item, idx) => {
          if (idx === existingIndex && item.quantity < product.stock) {
            const newQty = item.quantity + 1;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.salePrice,
            };
          }
          return item;
        });
      } else {
        // Add new
        const newItem: POSCartItem = {
          productId: product.id,
          product,
          quantity: 1,
          salePrice: product.salePrice,
          subtotal: product.salePrice,
        };
        newItems = [...prev.items, newItem];
      }

      return recalculateCart(newItems);
    });

    // Refocus scan input
    scanInputRef.current?.focus();
  }, [recalculateCart]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) => {
      const newItems = prev.items.map((item) => {
        if (item.productId === productId) {
          return {
            ...item,
            quantity,
            subtotal: quantity * item.salePrice,
          };
        }
        return item;
      });
      return recalculateCart(newItems);
    });
  }, [recalculateCart]);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const newItems = prev.items.filter((item) => item.productId !== productId);
      return recalculateCart(newItems);
    });
    scanInputRef.current?.focus();
  }, [recalculateCart]);

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      totalAmount: 0,
      totalCost: 0,
      profit: 0,
      itemCount: 0,
    });
    scanInputRef.current?.focus();
  }, []);

  // ==================== Barcode Scanning ====================

  const handleScan = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sku = scanInput.trim();
      if (!sku) return;

      // Find product by SKU
      const product = products.find((p) => p.sku === sku);
      
      if (product) {
        addToCart(product);
        setScanInput('');
      } else {
        // Try server lookup (in case products list is stale)
        const response = await getProductBySKU(sku);
        if (response.success && response.data) {
          addToCart(response.data);
          setScanInput('');
        } else {
          // Show error - could use toast in production
          alert(`ไม่พบสินค้า SKU: ${sku}`);
        }
      }
    }
  }, [scanInput, products, addToCart]);

  // ==================== Checkout ====================

  const handleCheckout = useCallback(() => {
    if (cart.items.length > 0) {
      setIsPaymentOpen(true);
    }
  }, [cart.items.length]);

  const handlePaymentConfirm = useCallback(async (paymentMethod: string) => {
    setIsProcessing(true);

    try {
      const response = await createPOSSale({
        paymentMethod: paymentMethod === 'CREDIT' ? 'CREDIT_CARD' : paymentMethod,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
        })),
      });
      
      if (response.success) {
        // Success! Clear cart and close dialog
        clearCart();
        setIsPaymentOpen(false);
        
        // Show success message
        alert(`บันทึกการขายสำเร็จ!\nเลขที่: ${response.data.sale.invoiceNumber}`);
        
        // Refresh to update stock
        router.refresh();
      } else {
        alert(response.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsProcessing(false);
    }
  }, [cart.items, clearCart, router]);

  // ==================== Render ====================

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <POSHeader />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Cart Panel */}
        <div className="w-[380px] shrink-0">
          <div className="h-full flex flex-col">
            {/* Barcode Scanner Input */}
            <div className="p-4 border-b bg-card">
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={scanInputRef}
                  type="text"
                  placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleScan}
                  className="pl-10 h-12 text-lg"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Cart */}
            <div className="flex-1">
              <POSCartPanel
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onClearCart={clearCart}
                onCheckout={handleCheckout}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        </div>

        {/* Right: Product Grid */}
        <div className="flex-1 flex flex-col bg-muted/20">
          {/* Search Bar */}
          <div className="shrink-0 p-4 bg-card border-b">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหาสินค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-hidden">
            <POSProductGrid
              products={products}
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onAddToCart={addToCart}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <POSPaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        cart={cart}
        onConfirm={handlePaymentConfirm}
        isProcessing={isProcessing}
      />
    </div>
  );
}
