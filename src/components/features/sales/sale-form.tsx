'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PAYMENT_METHODS } from '@/lib/constants';
import { createSale } from '@/actions/sales';
import { getProductsForSelect } from '@/actions/products';
import { getCustomersForSelect } from '@/actions/customers';
import { getMyProfile } from '@/actions/auth';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2, ScanBarcode, Tag, Percent, Sparkles } from 'lucide-react';
import { CustomerCombobox } from '@/components/features/customers/customer-combobox';
import { FileUpload } from '@/components/ui/file-upload';
import { usePermissions } from '@/hooks/use-permissions';
import { SaleScannerButton, type SaleScanResult } from './sale-scanner-button';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  salePrice: number;
  costPrice: number;
  stock: number;
}

interface SaleItem {
  productId: string;
  product?: Product;
  quantity: number | string;
  salePrice: number | string;
  discountAmount: number | string;  // G4: ส่วนลดต่อชิ้น
}

export function SaleForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<{id: string; name: string; address?: string | null}[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [showAddress, setShowAddress] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isBackdated, setIsBackdated] = useState(false);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [items, setItems] = useState<SaleItem[]>([
    { productId: '', quantity: 1, salePrice: 0, discountAmount: 0 },
  ]);
  const [scanInput, setScanInput] = useState('');
  // G4: Bill-level discount
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number | string>(0);
  // Payment method (controlled for AI autofill)
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [departmentCode, setDepartmentCode] = useState<string | null>(null);

  // AI autofill tracking
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());

  // Load products, customers and profile
  useEffect(() => {
    Promise.all([
      getProductsForSelect(),
      getCustomersForSelect(),
      getMyProfile()
    ]).then(([productsData, customersData, profile]) => {
      const mappedProducts = productsData.map((p: any) => ({
        ...p,
        salePrice: Number(p.salePrice),
        costPrice: Number(p.costPrice),
      }));
      setProducts(mappedProducts);
      setCustomers(customersData);
      if (profile?.departmentCode) {
        setDepartmentCode(profile.departmentCode);
      }
    });
  }, []);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, salePrice: 0, discountAmount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof SaleItem,
    value: string | number
  ) => {
    const newItems = [...items];
    
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value as string,
        product,
        salePrice: product?.salePrice || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    let totalAmount = 0;
    let totalCost = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.salePrice) || 0;
      const itemDiscount = Number(item.discountAmount) || 0;
      const effectivePrice = salePrice - itemDiscount;
      const subtotal = quantity * effectivePrice;
      const cost = quantity * (item.product?.costPrice || 0);
      totalAmount += subtotal;
      totalCost += cost;
    });

    // G4: Bill-level discount
    let billDiscountAmount = 0;
    const dv = Number(discountValue) || 0;
    if (showDiscount && dv > 0) {
      if (discountType === 'PERCENT') {
        billDiscountAmount = Math.round((totalAmount * dv / 100) * 100) / 100;
      } else {
        billDiscountAmount = dv;
      }
    }
    if (billDiscountAmount > totalAmount) billDiscountAmount = totalAmount;
    
    const netAmount = totalAmount - billDiscountAmount;
    const profit = netAmount - totalCost;

    return { totalAmount, totalCost, profit, billDiscountAmount, netAmount };
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      customerId: (!isNewCustomer && selectedCustomer) ? selectedCustomer : null,
      customerName: isNewCustomer ? selectedCustomer : null,
      customerAddress: showAddress ? customerAddress : null,
      paymentMethod: paymentMethod || (formData.get('paymentMethod') as any),
      notes: (formData.get('notes') as string) || null,
      receiptUrl,
      date: isBackdated ? new Date(date).toISOString() : undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 0,
        salePrice: Number(item.salePrice) || 0,
        discountAmount: Number(item.discountAmount) || 0,  // G4
      })),
      // G4: Bill-level discount
      discountType: showDiscount && (Number(discountValue) || 0) > 0 ? discountType : null,
      discountValue: showDiscount ? (Number(discountValue) || 0) : null,
    };

    startTransition(async () => {
      const result = await createSale(data);

      if (!result.success) {
        if (typeof result.errors === 'object') {
           setErrors(result.errors as Record<string, string[]>);
        } else if (result.message) {
           setErrors({ _form: [result.message] });
        }
      } else {
        router.push('/sales');
        router.refresh();
      }
    });
  }

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const sku = scanInput.trim();
      if (!sku) return;

      const product = products.find((p) => p.sku === sku);
      
      if (product) {
        // Check if item already exists
        const existingIndex = items.findIndex((item) => item.productId === product.id);
        
        if (existingIndex >= 0) {
          // Increment quantity
          const newItems = [...items];
          const currentQty = Number(newItems[existingIndex].quantity) || 0;
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: currentQty + 1,
          };
          setItems(newItems);
        } else {
          // Add new item
          // If the first item is empty (default state), replace it
          if (items.length === 1 && !items[0].productId) {
            setItems([{
              productId: product.id,
              product,
              quantity: 1,
              salePrice: product.salePrice,
              discountAmount: 0,
            }]);
          } else {
            setItems([
              ...items,
              {
                productId: product.id,
                product,
                quantity: 1,
                salePrice: product.salePrice,
                discountAmount: 0,
              },
            ]);
          }
        }
        setScanInput(''); // Clear input for next scan
      } else {
        // You might want to show a toast here, for now just clear/keep focus allow retry
        // setErrors({ ...errors, scan: ['ไม่พบสินค้า SKU: ' + sku] });
        alert('ไม่พบสินค้า SKU: ' + sku); // Temporary feedback
      }
    }
  };

  // ── AI Scan autofill (context-aware by sourceType) ──
  const handleScanResult = (result: SaleScanResult) => {
    const filled = new Set<string>();

    // ── Payment Slip: date/time only ──────────────────
    if (result.sourceType === 'payment_slip') {
      if (result.date) {
        setIsBackdated(true);
        const datetime = result.time ? `${result.date}T${result.time}` : `${result.date}T00:00`;
        setDate(datetime);
        filled.add('date');
      }
      if (result.senderName && !selectedCustomer) {
        setSelectedCustomer(result.senderName);
        setIsNewCustomer(true);
        filled.add('customer');
      }
      // Payment slip → always TRANSFER
      setPaymentMethod('TRANSFER');
      filled.add('paymentMethod');
      setAiFilled(filled);
      return;
    }

    // ── Date & Time ───────────────────────────────────
    if (result.date) {
      setIsBackdated(true);
      const datetime = result.time ? `${result.date}T${result.time}` : `${result.date}T00:00`;
      setDate(datetime);
      filled.add('date');
    }

    // ── Customer info ─────────────────────────────────
    if (result.customerName) {
      setSelectedCustomer(result.customerName);
      setIsNewCustomer(true);
      filled.add('customer');
    }

    if (result.customerAddress) {
      setCustomerAddress(result.customerAddress);
      setShowAddress(true);
      filled.add('customerAddress');
    }

    // ── Payment method ───────────────────────────────
    if (result.paymentMethod) {
      setPaymentMethod(result.paymentMethod);
      filled.add('paymentMethod');
    }

    // ── Items: invoice/order only (NOT chat — user types items themselves) ──
    const shouldFillItems =
      result.sourceType !== 'chat_screenshot' &&
      Array.isArray(result.items) &&
      result.items.length > 0;

    if (shouldFillItems) {
      const newItems: SaleItem[] = result.items.map((scannedItem) => {
        const matched = products.find((p) =>
          (scannedItem.sku && p.sku && p.sku.toLowerCase() === scannedItem.sku.toLowerCase()) ||
          p.name.toLowerCase().includes(scannedItem.name.toLowerCase()) ||
          scannedItem.name.toLowerCase().includes(p.name.toLowerCase())
        );

        if (matched) {
          return {
            productId: matched.id,
            product: matched,
            quantity: scannedItem.quantity,
            salePrice: scannedItem.unitPrice || matched.salePrice,
            discountAmount: 0,
          };
        }

        return {
          productId: '',
          quantity: scannedItem.quantity,
          salePrice: scannedItem.unitPrice,
          discountAmount: 0,
        };
      });

      const validItems = newItems.filter((i) => i.productId || Number(i.salePrice) > 0);
      if (validItems.length > 0) {
        setItems(validItems);
        filled.add('items');
      }
    }

    setAiFilled(filled);
  };

  // AI green-ring class helper
  const aiFieldClass = (field: string, base: string) =>
    aiFilled.has(field) ? `${base} ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20` : base;

  const { totalAmount, totalCost, profit, billDiscountAmount, netAmount } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors._form.join(', ')}
        </div>
      )}

      {/* Date & Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลการขาย</CardTitle>
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
              <Label>ชื่อลูกค้า (ถ้ามี)</Label>
              <CustomerCombobox
                customers={customers}
                value={selectedCustomer || undefined}
                onValueChange={(value, isNew) => {
                  setSelectedCustomer(value);
                  setIsNewCustomer(isNew);
                  
                  // Reset or auto-fill address
                  if (value && !isNew) {
                    const customer = customers.find(c => c.id === value);
                    if (customer?.address) {
                      setCustomerAddress(customer.address);
                      setShowAddress(true);
                    } else {
                      setCustomerAddress('');
                      setShowAddress(false);
                    }
                  } else {
                    setCustomerAddress('');
                    setShowAddress(false);
                  }
                }}
                placeholder="เลือกหรือพิมพ์ชื่อลูกค้า..."
              />
              {selectedCustomer && (
                <div className="space-y-2">
                  {isNewCustomer && (
                    <p className="text-xs text-muted-foreground">จะสร้างลูกค้าใหม่: {selectedCustomer}</p>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showAddress"
                      checked={showAddress}
                      onChange={(e) => setShowAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="showAddress" className="font-normal cursor-pointer text-sm">
                      ระบุที่อยู่ {(!isNewCustomer && showAddress) ? '(แก้ไขได้)' : ''}
                    </Label>
                  </div>

                  {showAddress && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="customerAddress" className="sr-only">ที่อยู่</Label>
                      <textarea
                        id="customerAddress"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="ที่อยู่ลูกค้า..."
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">วิธีชำระเงิน *</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={aiFieldClass('paymentMethod', 'w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm')}
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
              placeholder="บันทึกเพิ่มเติม (ถ้ามี)"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
            <div className="flex items-center gap-2">
              <SaleScannerButton
                onScanResult={handleScanResult}
                variant="outline"
                size="sm"
                className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/20"
              />
              <Button type="button" size="sm" onClick={handleAddItem}>
                <Plus className="mr-1 h-4 w-4" />
                เพิ่มรายการ
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Scan Input */}
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border border-dashed">
            <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Input
                placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แล้วกด Enter..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleScan}
                className="bg-background"
                autoFocus
              />
            </div>
          </div>

          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-lg border p-4 items-start"
            >
              <div className="md:col-span-4 space-y-2">
                <Label>สินค้า *</Label>
                <select
                  value={item.productId}
                  onChange={(e) =>
                    handleItemChange(index, 'productId', e.target.value)
                  }
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((product: any) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku && `(${product.sku})`} - ว่าง:{' '}
                      {(product.stock || 0) - (product.reservedStock || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>จำนวน *</Label>
                <Input
                  type="number"
                  min="1"
                  max={item.product?.stock || 999}
                  value={item.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') handleItemChange(index, 'quantity', '');
                    else handleItemChange(index, 'quantity', parseInt(val) || 0);
                  }}
                  required
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>ราคา/หน่วย *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.salePrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') handleItemChange(index, 'salePrice', '');
                    else handleItemChange(index, 'salePrice', parseFloat(val) || 0);
                  }}
                  required
                />
              </div>

              {/* G4: Item-level discount */}
              <div className="md:col-span-2 space-y-2">
                <Label className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  ส่วนลด
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={item.discountAmount === 0 ? '' : item.discountAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') handleItemChange(index, 'discountAmount', 0);
                    else handleItemChange(index, 'discountAmount', parseFloat(val) || 0);
                  }}
                />
              </div>

              <div className="md:col-span-1 space-y-2">
                <Label>รวม</Label>
                <div className="text-sm font-medium h-9 flex items-center">
                  {formatCurrency(((Number(item.quantity) || 0) * ((Number(item.salePrice) || 0) - (Number(item.discountAmount) || 0))).toString())}
                </div>
              </div>

              <div className="md:col-span-1 flex items-end justify-end pt-6 md:pt-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
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

      {/* Receipt Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">หลักฐานการชำระเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            value={receiptUrl || undefined}
            onChange={setReceiptUrl}
            folder="receipts"
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ยอดรวมสินค้า</span>
              <span className="font-medium">{formatCurrency(totalAmount.toString())}</span>
            </div>

            {/* G4: Bill-level Discount (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDiscount(!showDiscount)}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Tag className="h-3.5 w-3.5" />
                {showDiscount ? 'ซ่อนส่วนลดบิล' : '▸ เพิ่มส่วนลดบิล'}
              </button>

              {showDiscount && (
                <div className="animate-in fade-in slide-in-from-top-2 flex items-center gap-2 rounded-lg border border-dashed p-3 bg-muted/30">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
                    className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="FIXED">฿ บาท</option>
                    <option value="PERCENT">% เปอร์เซ็นต์</option>
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={discountType === 'PERCENT' ? 100 : undefined}
                    value={discountValue === 0 ? '' : discountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') setDiscountValue(0);
                      else setDiscountValue(parseFloat(val) || 0);
                    }}
                    placeholder={discountType === 'PERCENT' ? 'เช่น 10' : 'เช่น 50'}
                    className="flex-1"
                  />
                  {discountType === 'PERCENT' && <Percent className="h-4 w-4 text-muted-foreground" />}
                </div>
              )}
            </div>

            {billDiscountAmount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>ส่วนลดบิล {discountType === 'PERCENT' ? `(${discountValue}%)` : ''}</span>
                <span>-{formatCurrency(billDiscountAmount.toString())}</span>
              </div>
            )}

            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">ยอดสุทธิ</span>
              <span className="text-lg font-bold">{formatCurrency(netAmount.toString())}</span>
            </div>

            {hasPermission('SALE_VIEW_PROFIT') && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ต้นทุน</span>
                  <span>{formatCurrency(totalCost.toString())}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">กำไร</span>
                  <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(profit.toString())}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || items.some((item) => !item.productId)}>
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
