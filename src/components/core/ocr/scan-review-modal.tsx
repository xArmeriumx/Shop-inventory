'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Check,
  AlertTriangle,
  Plus,
  PlusCircle,
  Building2,
  Package,
  Loader2,
  ChevronRight,
  Edit2,
} from 'lucide-react';
import { runActionWithToast } from '@/lib/mutation-utils';
import {
  matchProduct,
  matchSupplier,
  generateUniqueProductName,
  type ScannedItem,
  type ProductForMatch,
  type SupplierForMatch,
  type MatchResult,
} from '@/lib/ocr/matcher';
import { batchCreateProducts, type BatchProductInput } from '@/actions/inventory/products.actions';
import { createSupplier } from '@/actions/purchases/suppliers.actions';
import { getLookupValues, quickAddCategory } from '@/actions/core/lookups.actions';

// Types
interface ScanData {
  vendor?: string;
  documentNumber?: string;
  date?: string;
  items?: ScannedItem[];
  total?: number;
}

interface ReviewedItem {
  scanned: ScannedItem;
  match: MatchResult<ProductForMatch> | null;
  // For unmatched items
  newProduct?: {
    name: string;
    sku: string;
    category: string;
    costPrice: number;
    salePrice: number;
  };
}

interface ReviewedSupplier {
  scanned: string;
  match: MatchResult<SupplierForMatch> | null;
  newSupplier?: {
    name: string;
    code: string;
  };
}

interface FinalResult {
  supplierId?: string;
  supplierName?: string;
  date?: string;
  documentNumber?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    costPrice: number;
  }>;
}

interface ScanReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanData: ScanData | null;
  products: ProductForMatch[];
  suppliers: SupplierForMatch[];
  onConfirm: (result: FinalResult) => void;
}

export function ScanReviewModal({
  open,
  onOpenChange,
  scanData,
  products,
  suppliers,
  onConfirm,
}: ScanReviewModalProps) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Reviewed data state
  const [reviewedSupplier, setReviewedSupplier] = useState<ReviewedSupplier | null>(null);
  const [reviewedItems, setReviewedItems] = useState<ReviewedItem[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    getLookupValues('PRODUCT_CATEGORY').then((result) => {
      const values = result.success ? (result.data || []) : [];
      setCategories(values as any);
      const defaultCat = (values as any[]).find((v: any) => v.isDefault);
      if (defaultCat) {
        setDefaultCategory((defaultCat as any).name);
      } else if (values.length > 0) {
        // Fallback to first category if no default
        setDefaultCategory((values[0] as any).name);
      }
      setCategoriesLoaded(true);
    });
  }, []);

  const processMatchData = useCallback(() => {
    if (!scanData) return;

    // Match supplier
    if (scanData.vendor) {
      const supplierMatch = matchSupplier(scanData.vendor, suppliers);
      setReviewedSupplier({
        scanned: scanData.vendor,
        match: supplierMatch,
        newSupplier: supplierMatch ? undefined : {
          name: scanData.vendor,
          code: '',
        },
      });
    } else {
      setReviewedSupplier(null);
    }

    // Match items
    if (scanData.items && scanData.items.length > 0) {
      // Robust category fallback: defaultCategory → first category → 'อื่นๆ'
      const categoryToUse = defaultCategory || categories[0]?.name || 'อื่นๆ';
      console.log('📦 processMatchData:', {
        itemCount: scanData.items.length,
        categoryToUse,
        defaultCategory,
        categoriesAvailable: categories.length,
      });

      const reviewed = scanData.items.map((scanned, index) => {
        const match = matchProduct(scanned, products);
        const costPrice = scanned.unitPrice || 0;
        const productName = generateUniqueProductName(scanned);

        // Detailed logging for each item
        console.log(`📦 Item[${index}]:`, {
          scannedName: scanned.name,
          scannedModel: scanned.model,
          scannedCode: scanned.code,
          generatedName: productName,
          isMatched: !!match,
          matchedProductId: match?.item?.id,
          categoryAssigned: match ? '(matched)' : categoryToUse,
        });

        return {
          scanned,
          match,
          newProduct: match ? undefined : {
            name: productName,
            sku: scanned.code || scanned.model || '',
            category: categoryToUse, // Guaranteed non-empty
            costPrice,
            salePrice: Math.round(costPrice * 1.2), // Default +20%
          },
        };
      }) as ReviewedItem[];
      setReviewedItems(reviewed);
    } else {
      setReviewedItems([]);
    }
  }, [scanData, suppliers, products, defaultCategory, categories]);

  // Process scan data when modal opens - WAIT for categories to load first
  useEffect(() => {
    if (open && scanData && categoriesLoaded && defaultCategory) {
      console.log('🔧 Processing with category:', defaultCategory);
      processMatchData();
    }
  }, [open, scanData, categoriesLoaded, defaultCategory, processMatchData]); // Added processMatchData dependency

  // Update new product data
  const updateNewProduct = (index: number, field: keyof NonNullable<ReviewedItem['newProduct']>, value: string | number) => {
    setReviewedItems((prev) => {
      const updated = [...prev];
      if (updated[index].newProduct) {
        updated[index].newProduct = {
          ...updated[index].newProduct!,
          [field]: value,
        };
      }
      return updated;
    });
  };

  // Handle adding new category inline - connects to database
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    startTransition(async () => {
      await runActionWithToast(quickAddCategory('PRODUCT_CATEGORY', newCategoryName.trim()), {
        successMessage: `เพิ่มหมวดหมู่ "${newCategoryName.trim()}" สำเร็จ`,
        onSuccess: (result) => {
          setCategories((prev) => [...prev, { id: result.id, name: result.name }]);
          setDefaultCategory(result.name);
          setReviewedItems((prev) =>
            prev.map((item) =>
              item.newProduct
                ? { ...item, newProduct: { ...item.newProduct, category: result.name } }
                : item
            )
          );
          setShowAddCategory(false);
          setNewCategoryName('');
        },
      });
    });
  };

  // Update new supplier data
  const updateNewSupplier = (field: 'name' | 'code', value: string) => {
    if (reviewedSupplier?.newSupplier) {
      setReviewedSupplier({
        ...reviewedSupplier,
        newSupplier: {
          ...reviewedSupplier.newSupplier,
          [field]: value,
        },
      });
    }
  };

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        let finalSupplierId: string | undefined;
        let finalSupplierName: string | undefined;

        // Step 1: Create supplier if needed
        if (reviewedSupplier) {
          if (reviewedSupplier.match) {
            finalSupplierId = reviewedSupplier.match.item.id;
            finalSupplierName = reviewedSupplier.match.item.name;
          } else if (reviewedSupplier.newSupplier?.name) {
            const result = await createSupplier({
              name: reviewedSupplier.newSupplier.name,
              code: reviewedSupplier.newSupplier.code || null,
              contactName: null,
              phone: null,
              email: null,
              address: null,
              taxId: null,
              notes: null,
            });
            if (result.success && result.data) {
              finalSupplierId = result.data.id;
              finalSupplierName = result.data.name;
            }
          }
        }

        // Step 2: Batch create products if needed
        const unmatchedIndices: number[] = [];
        const productsToCreate: BatchProductInput[] = [];

        reviewedItems.forEach((item, index) => {
          if (!item.match) {
            const hasName = !!(item.newProduct?.name && item.newProduct.name.trim());
            const hasCategory = !!(item.newProduct?.category && item.newProduct.category.trim());

            if (hasName && hasCategory) {
              unmatchedIndices.push(index);
              productsToCreate.push({
                name: item.newProduct!.name.trim(),
                sku: item.newProduct!.sku?.trim() || null,
                category: item.newProduct!.category.trim(),
                costPrice: item.newProduct!.costPrice || 0,
                salePrice: item.newProduct!.salePrice || 0,
              });
            }
          }
        });

        const createdProductsMap: Record<number, { id: string; costPrice: number }> = {};

        if (productsToCreate.length > 0) {
          const batchResult = await batchCreateProducts(productsToCreate);
          if (batchResult.success && batchResult.data) {
            batchResult.data.created.forEach((p, createIndex) => {
              const originalIndex = unmatchedIndices[createIndex];
              createdProductsMap[originalIndex] = { id: p.id, costPrice: p.costPrice };
            });
          }
        }

        // Step 3: Build final result
        const finalItems = reviewedItems
          .map((item, index) => {
            if (item.match) {
              return {
                productId: item.match.item.id,
                productName: item.match.item.name,
                quantity: item.scanned.quantity || 1,
                costPrice: item.scanned.unitPrice || item.match.item.costPrice,
              };
            } else if (createdProductsMap[index]) {
              const created = createdProductsMap[index];
              return {
                productId: created.id,
                productName: item.newProduct?.name || '',
                quantity: item.scanned.quantity || 1,
                costPrice: item.newProduct?.costPrice || 0,
              };
            }
            return null;
          })
          .filter(Boolean) as FinalResult['items'];

        const result: FinalResult = {
          supplierId: finalSupplierId,
          supplierName: finalSupplierName,
          date: scanData?.date,
          documentNumber: scanData?.documentNumber,
          items: finalItems,
        };

        onConfirm(result);
        onOpenChange(false);
      } catch (error: any) {
        console.error('Review confirm error:', error);
      }
    });
  };

  // Count matched/unmatched
  const matchedCount = reviewedItems.filter((i) => i.match).length;
  const unmatchedCount = reviewedItems.filter((i) => !i.match).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 ตรวจสอบข้อมูลจาก OCR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Supplier Section */}
          {reviewedSupplier && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                ผู้จำหน่าย
              </div>

              {reviewedSupplier.match ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{reviewedSupplier.match.item.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {reviewedSupplier.match.score}% match
                  </Badge>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">สร้างผู้จำหน่ายใหม่</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">ชื่อ</Label>
                      <Input
                        value={reviewedSupplier.newSupplier?.name || ''}
                        onChange={(e) => updateNewSupplier('name', e.target.value)}
                        placeholder="ชื่อผู้จำหน่าย"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">รหัส (ถ้ามี)</Label>
                      <Input
                        value={reviewedSupplier.newSupplier?.code || ''}
                        onChange={(e) => updateNewSupplier('code', e.target.value)}
                        placeholder="รหัส"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                รายการสินค้า ({reviewedItems.length} รายการ)
              </div>
              <div className="flex gap-2">
                {matchedCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    ✓ พบ {matchedCount}
                  </Badge>
                )}
                {unmatchedCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                    + ใหม่ {unmatchedCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* Default Category for new items */}
            {unmatchedCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>หมวดหมู่เริ่มต้น:</span>
                <Select
                  value={defaultCategory}
                  onValueChange={(value) => {
                    setDefaultCategory(value);
                    // Update all unmatched items
                    setReviewedItems((prev) =>
                      prev.map((item) =>
                        item.newProduct
                          ? { ...item, newProduct: { ...item.newProduct, category: value } }
                          : item
                      )
                    );
                  }}
                >
                  <SelectTrigger className="h-7 w-40 text-xs">
                    <SelectValue placeholder="เลือกหมวด" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Add new category inline */}
                {!showAddCategory ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAddCategory(true)}
                  >
                    <PlusCircle className="h-3 w-3" />
                    เพิ่มหมวดใหม่
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="ชื่อหมวดใหม่"
                      className="h-7 w-32 text-xs"
                      disabled={isPending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        } else if (e.key === 'Escape') {
                          setShowAddCategory(false);
                          setNewCategoryName('');
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={handleAddCategory}
                      disabled={isPending || !newCategoryName.trim()}
                    >
                      {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryName('');
                      }}
                      disabled={isPending}
                    >
                      ยกเลิก
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {reviewedItems.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${item.match
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                    }`}
                >
                  {item.match ? (
                    // Matched item
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{item.match.item.name}</span>
                        {item.match.item.sku && (
                          <Badge variant="outline" className="text-xs">
                            {item.match.item.sku}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>x{item.scanned.quantity || 1}</span>
                        <span>฿{item.scanned.unitPrice?.toLocaleString() || item.match.item.costPrice?.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    // Unmatched item - create new
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Plus className="h-4 w-4" />
                        <span className="text-sm font-medium">สินค้าใหม่</span>
                        <span className="text-xs text-muted-foreground">
                          (จาก: {item.scanned.name || item.scanned.model || 'ไม่ทราบ'})
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <Input
                            value={item.newProduct?.name || ''}
                            onChange={(e) => updateNewProduct(index, 'name', e.target.value)}
                            placeholder="ชื่อสินค้า"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Input
                          value={item.newProduct?.sku || ''}
                          onChange={(e) => updateNewProduct(index, 'sku', e.target.value)}
                          placeholder="SKU"
                          className="h-8 text-sm"
                        />
                        <Select
                          value={item.newProduct?.category || ''}
                          onValueChange={(value) => updateNewProduct(index, 'category', value)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="หมวด" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">จำนวน</Label>
                          <Input
                            type="number"
                            value={item.scanned.quantity || 1}
                            readOnly
                            className="h-8 text-sm bg-muted"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">ราคาทุน</Label>
                          <Input
                            type="number"
                            value={item.newProduct?.costPrice || 0}
                            onChange={(e) => updateNewProduct(index, 'costPrice', Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">ราคาขาย</Label>
                          <Input
                            type="number"
                            value={item.newProduct?.salePrice || 0}
                            onChange={(e) => updateNewProduct(index, 'salePrice', Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Date & Document Info */}
          {(scanData?.date || scanData?.documentNumber) && (
            <>
              <Separator />
              <div className="flex gap-4 text-sm text-muted-foreground">
                {scanData.date && (
                  <div>📅 วันที่: {scanData.date}</div>
                )}
                {scanData.documentNumber && (
                  <div>📄 เลขที่: {scanData.documentNumber}</div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                ยืนยันและนำเข้า
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
