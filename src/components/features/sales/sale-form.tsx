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
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2 } from 'lucide-react';
import { CustomerCombobox } from '@/components/features/customers/customer-combobox';
import { FileUpload } from '@/components/ui/file-upload';

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
}

export function SaleForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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
    { productId: '', quantity: 1, salePrice: 0 },
  ]);

  // Load products and customers
  useEffect(() => {
    Promise.all([
      getProductsForSelect(),
      getCustomersForSelect(),
    ]).then(([productsData, customersData]) => {
      const mappedProducts = productsData.map((p: any) => ({
        ...p,
        salePrice: Number(p.salePrice),
        costPrice: Number(p.costPrice),
      }));
      setProducts(mappedProducts);
      setCustomers(customersData);
    });
  }, []);

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, salePrice: 0 }]);
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
      const subtotal = quantity * salePrice;
      const cost = quantity * (item.product?.costPrice || 0);
      totalAmount += subtotal;
      totalCost += cost;
    });

    const profit = totalAmount - totalCost;

    return { totalAmount, totalCost, profit };
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      customerId: (!isNewCustomer && selectedCustomer) ? selectedCustomer : null,
      customerName: isNewCustomer ? selectedCustomer : null,
      customerAddress: showAddress ? customerAddress : null,
      paymentMethod: formData.get('paymentMethod') as any,
      notes: (formData.get('notes') as string) || null,
      receiptUrl,
      date: isBackdated ? new Date(date).toISOString() : undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 0,
        salePrice: Number(item.salePrice) || 0,
      })),
    };

    startTransition(async () => {
      const result = await createSale(data);

      if (result.error) {
        setErrors(result.error as Record<string, string[]>);
      } else {
        router.push('/sales');
        router.refresh();
      }
    });
  }

  const { totalAmount, totalCost, profit } = calculateTotals();

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
                <select
                  value={item.productId}
                  onChange={(e) =>
                    handleItemChange(index, 'productId', e.target.value)
                  }
                  required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">เลือกสินค้า</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku && `(${product.sku})`} - สต็อก:{' '}
                      {product.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-24 space-y-2">
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

              <div className="w-full sm:w-32 space-y-2">
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

              <div className="flex items-end">
                <div className="space-y-2">
                  <Label>รวม</Label>
                  <div className="text-sm font-medium">
                    {formatCurrency(((Number(item.quantity) || 0) * (Number(item.salePrice) || 0)).toString())}
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
              <span className="text-muted-foreground">ยอดรวม</span>
              <span className="font-medium">{formatCurrency(totalAmount.toString())}</span>
            </div>
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
