'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScanBarcode, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { POSHeader } from './pos-header';
import { POSProductGrid } from './pos-product-grid';
import { POSCartPanel } from './pos-cart';
import { POSPaymentDialog } from './pos-payment-dialog';
import { POSSuccessDialog } from './pos-success-dialog';
import { createPOSSale, getProductBySKU, getProductsForPOS } from '@/lib/pos/pos-service';
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

  // Detect touch device (iPad/tablet) - don't auto-focus on touch devices to prevent keyboard popup
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  useEffect(() => {
    // Check if device has touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  // State
  const [products, setProducts] = useState<POSProduct[]>(initialProducts);
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
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [successInvoiceNumber, setSuccessInvoiceNumber] = useState<string>('');

  // Focus scan input on mount - only for non-touch devices (desktop with barcode scanner)
  useEffect(() => {
    if (!isTouchDevice) {
      scanInputRef.current?.focus();
    }
  }, [isTouchDevice]);

  // Auto-refresh stock every 3 seconds for multi-terminal sync
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      // Skip refresh if tab is not active (user switched to another tab/app)
      if (!document.hasFocus()) return;
      
      // Skip refresh if payment dialog is open (don't interrupt user)
      if (isPaymentOpen || isProcessing) return;

      try {
        const latestProducts = await getProductsForPOS();
        setProducts(latestProducts);
      } catch (error) {
        console.error('Stock refresh error:', error);
        // Silently fail - don't interrupt POS operation
      }
    }, 3000); // 3 seconds - fast enough for real-time feel

    return () => clearInterval(refreshInterval);
  }, [isPaymentOpen, isProcessing]);

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

    // Refocus scan input (only on desktop - touch devices use tap)
    if (!isTouchDevice) {
      scanInputRef.current?.focus();
    }
  }, [recalculateCart, isTouchDevice]);

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
    if (!isTouchDevice) {
      scanInputRef.current?.focus();
    }
  }, [recalculateCart, isTouchDevice]);

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      totalAmount: 0,
      totalCost: 0,
      profit: 0,
      itemCount: 0,
    });
    if (!isTouchDevice) {
      scanInputRef.current?.focus();
    }
  }, [isTouchDevice]);

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
        const serverProduct = await getProductBySKU(sku);
        if (serverProduct) {
          addToCart(serverProduct);
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
      const result = await createPOSSale({
        paymentMethod,
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          salePrice: item.salePrice,
        })),
      });

      if (result.success) {
        // Optimistic Update: Immediately update local stock
        setProducts((prevProducts) =>
          prevProducts.map((product) => {
            const soldItem = cart.items.find((item) => item.productId === product.id);
            if (soldItem) {
              return {
                ...product,
                stock: Math.max(0, product.stock - soldItem.quantity),
              };
            }
            return product;
          })
        );

        // Success! Clear cart and close dialog
        clearCart();
        setIsPaymentOpen(false);
        
        // Show success dialog
        setSuccessInvoiceNumber(result.invoiceNumber || '');
        setIsSuccessOpen(true);
        
        // Refresh to update stock (backup sync from server)
        router.refresh();
      } else {
        alert(result.error || 'เกิดข้อผิดพลาด');
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

      {/* Success Dialog */}
      <POSSuccessDialog
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        invoiceNumber={successInvoiceNumber}
      />
    </div>
  );
}
