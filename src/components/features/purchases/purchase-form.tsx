'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { PAYMENT_METHODS } from '@/lib/constants';
import { createPurchase } from '@/actions/purchases';
import { getProductsForPurchase } from '@/actions/products';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2, Camera } from 'lucide-react';
import { SupplierCombobox } from '@/components/features/suppliers/supplier-combobox';
import { ScanPurchaseButton } from '@/components/features/purchases/scan-purchase-button';
import { QuickAddSupplierDialog } from '@/components/features/suppliers/quick-add-supplier-dialog';
import { QuickAddProductDialog } from '@/components/features/products/quick-add-product-dialog';
import { ScanReviewModal } from '@/components/features/ocr/scan-review-modal';
import { getSuppliersForSelect } from '@/actions/suppliers';
import { toast } from 'sonner';
import { loadPendingScanResult, type ScanResult } from './use-purchase-scanner';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  costPrice: number;
  stock: number;
}

interface PurchaseItem {
  productId: string;
  product?: Product;
  quantity: number | string;
  costPrice: number | string;
}

export function PurchaseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isBackdated, setIsBackdated] = useState(false);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [supplierId, setSupplierId] = useState<string>(''); // Supplier selection
  const [items, setItems] = useState<PurchaseItem[]>([
    { productId: '', quantity: 1, costPrice: 0 },
  ]);
  
  // Quick Add state
  const [supplierRefreshKey, setSupplierRefreshKey] = useState(0);
  const [pendingScanData, setPendingScanData] = useState<any>(null);
  
  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string | null }>>([]);

  // Helper function to populate form from scan result
  const populateFromScanResult = useCallback(async (result: ScanResult) => {
    // Refresh products list first (may have new products from batch create)
    const freshProducts = await getProductsForPurchase();
    const mappedProducts = freshProducts.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
    }));
    setProducts(mappedProducts);
    
    // Set supplier
    if (result.supplierId) {
      setSupplierId(result.supplierId);
      setSupplierRefreshKey((k) => k + 1);
    }
    
    // Set date
    if (result.date) {
      setIsBackdated(true);
      setDate(result.date + 'T00:00');
    }
    
    // Set items from review result (using fresh products)
    if (result.items && result.items.length > 0) {
      const mappedItems: PurchaseItem[] = result.items.map((item) => {
        const product = mappedProducts.find((p: Product) => p.id === item.productId);
        return {
          productId: item.productId,
          product,
          quantity: item.quantity || 1,
          costPrice: item.costPrice || product?.costPrice || 0,
        };
      });
      
      setItems(mappedItems.length > 0 ? mappedItems : [{ productId: '', quantity: 1, costPrice: 0 }]);
    }
    
    // Set notes with document info
    if (result.documentNumber || result.supplierName) {
      const noteElement = document.getElementById('notes') as HTMLTextAreaElement;
      if (noteElement) {
        noteElement.value = `${result.supplierName || ''} - ${result.documentNumber || ''}`.trim();
      }
    }
    
    toast.success('นำเข้าข้อมูลสำเร็จ!');
  }, []);

  useEffect(() => {
    // Load products
    getProductsForPurchase().then((data) => {
      const mappedProducts = data.map((p: any) => ({
        ...p,
        costPrice: Number(p.costPrice),
      }));
      setProducts(mappedProducts);
    });
    
    // Load suppliers for matching
    getSuppliersForSelect().then((data) => {
      setSuppliers(data.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })));
    });
    
    // Check for pending scan result from list page
    const fromScan = searchParams.get('fromScan');
    if (fromScan === 'true') {
      const pendingResult = loadPendingScanResult();
      if (pendingResult) {
        // Delay slightly to ensure products are loaded
        setTimeout(() => {
          populateFromScanResult(pendingResult);
        }, 500);
      }
      // Clean URL
      router.replace('/purchases/new', { scroll: false });
    }
  }, [searchParams, router, populateFromScanResult]);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, costPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseItem,
    value: string | number
  ) => {
    const newItems = [...items];
    
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        product,
        costPrice: product?.costPrice || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.costPrice) || 0),
      0
    );
  };

  // Handle OCR scan result - open review modal
  const handleScanComplete = (scanData: any) => {
    if (!scanData) return;
    
    // Store scan data and open review modal
    setPendingScanData(scanData);
    setShowReviewModal(true);
  };
  
  // Handle confirmed review result - fill form (reuses populateFromScanResult)
  const handleReviewConfirm = async (result: any) => {
    await populateFromScanResult(result);
  };

  // Refresh product list
  const refreshProducts = async () => {
    const data = await getProductsForPurchase();
    const mappedProducts = data.map((p: any) => ({
      ...p,
      costPrice: Number(p.costPrice),
    }));
    setProducts(mappedProducts);
  };

  // Handle new supplier created via Quick Add
  const handleSupplierCreated = (supplier: { id: string; name: string }) => {
    setSupplierId(supplier.id);
    setSupplierRefreshKey((k) => k + 1); // Trigger combobox refresh
  };

  // Handle new product created via Quick Add
  const handleProductCreated = async (product: { id: string; name: string; costPrice: number }, itemIndex: number) => {
    await refreshProducts();
    // Auto-select the new product in the item row
    handleItemChange(itemIndex, 'productId', product.id);
    handleItemChange(itemIndex, 'costPrice', product.costPrice);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      supplierId: supplierId || null,
      paymentMethod: formData.get('paymentMethod') as any,
      notes: (formData.get('notes') as string) || null,
      receiptUrl: receiptUrl,
      date: isBackdated ? new Date(date).toISOString() : undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 0,
        costPrice: Number(item.costPrice) || 0,
      })),
    };

    startTransition(async () => {
      const result = await createPurchase(data);

      if (!result.success) {
        if (typeof result.errors === 'object') {
          setErrors(result.errors as Record<string, string[]>);
        } else if (result.message) {
           setErrors({ _form: [result.message] });
        }
      } else {
        router.push('/purchases');
        router.refresh();
      }
    });
  }

  const total = calculateTotal();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors._form.join(', ')}
        </div>
      )}

      {/* Supplier Info & Date */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">ข้อมูลการซื้อ</CardTitle>
            <ScanPurchaseButton onScanComplete={handleScanComplete} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isBackdated"
                checked={isBackdated}
                onChange={(e) => setIsBackdated(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isBackdated" className="font-normal cursor-pointer">
                บันทึกย้อนหลัง (ระบุวันที่เอง)
              </Label>
            </div>

            {isBackdated && (
              <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                <Input
                  id="date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required={isBackdated}
                  max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplierId">ผู้จำหน่าย</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SupplierCombobox
                    key={supplierRefreshKey}
                    value={supplierId}
                    onChange={setSupplierId}
                    error={!!errors.supplierId}
                  />
                </div>
                <QuickAddSupplierDialog
                  defaultName={pendingScanData?.vendor || ''}
                  onCreated={handleSupplierCreated}
                />
              </div>
              {errors.supplierId && (
                <p className="text-sm text-destructive">{errors.supplierId[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">วิธีชำระเงิน *</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">เลือกวิธีชำระเงิน</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="text-sm text-destructive">{errors.paymentMethod[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">หมายเหตุ</Label>
            <textarea
              id="notes"
              name="notes"
              placeholder="บันทึกเพิ่มเติม"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>หลักฐานการซื้อ</Label>
            <FileUpload
              value={receiptUrl || undefined}
              onChange={(url) => setReceiptUrl(url)}
              folder="purchases"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
            <Button type="button" size="sm" onClick={handleAddItem}>
              <Plus className="mr-1 h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row"
            >
              <div className="flex-1 space-y-2">
                <Label>สินค้า *</Label>
                <div className="flex gap-2">
                  <select
                    value={item.productId}
                    onChange={(e) =>
                      handleItemChange(index, 'productId', e.target.value)
                    }
                    required
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">เลือกสินค้า</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} {product.sku && `(${product.sku})`} - สต็อก:{' '}
                        {product.stock}
                      </option>
                    ))}
                  </select>
                  {/* Quick Add Product - show when no product selected */}
                  {!item.productId && (
                    <QuickAddProductDialog
                      defaultData={{
                        name: pendingScanData?.items?.[index]?.name || pendingScanData?.items?.[index]?.model || '',
                        sku: pendingScanData?.items?.[index]?.code || pendingScanData?.items?.[index]?.model || '',
                        costPrice: Number(item.costPrice) || pendingScanData?.items?.[index]?.unitPrice || 0,
                      }}
                      onCreated={(product) => handleProductCreated(product, index)}
                    />
                  )}
                </div>
              </div>

              <div className="w-full sm:w-24 space-y-2">
                <Label>จำนวน *</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') handleItemChange(index, 'quantity', '');
                    else handleItemChange(index, 'quantity', parseInt(val) || 0);
                  }}
                  required
                />
              </div>

              <div className="w-full sm:w-32 space-y-2">
                <Label>ต้นทุน/หน่วย *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.costPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') handleItemChange(index, 'costPrice', '');
                    else handleItemChange(index, 'costPrice', parseFloat(val) || 0);
                  }}
                  required
                />
              </div>

              <div className="flex items-end">
                <div className="space-y-2">
                  <Label>รวม</Label>
                  <div className="text-sm font-medium">
                    {formatCurrency(((Number(item.quantity) || 0) * (Number(item.costPrice) || 0)).toString())}
                  </div>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {errors.items && (
            <p className="text-sm text-destructive">{errors.items[0]}</p>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-lg font-bold">
            <span>ยอดรวมทั้งหมด</span>
            <span>{formatCurrency(total.toString())}</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || items.some((item) => !item.productId)}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการซื้อ'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
      
      {/* Scan Review Modal */}
      <ScanReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        scanData={pendingScanData}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          costPrice: p.costPrice,
        }))}
        suppliers={suppliers}
        onConfirm={handleReviewConfirm}
      />
    </form>
  );
}
