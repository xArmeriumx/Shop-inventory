'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SafeInput } from '@/components/ui/safe-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, Loader2 } from 'lucide-react';
import { createProduct } from '@/actions/inventory/products.actions';
import { getLookupValues } from '@/actions/core/lookups.actions';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  code: string;
}

interface QuickAddProductDialogProps {
  /** Pre-fill data from OCR */
  defaultData?: {
    name?: string;
    sku?: string;
    costPrice?: number;
  };
  /** Callback when product is created */
  onCreated?: (product: { id: string; name: string; costPrice: number }) => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'icon';
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

export function QuickAddProductDialog({
  defaultData = {},
  onCreated,
  variant = 'outline',
  size = 'sm',
  trigger,
}: QuickAddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(defaultData.name || '');
  const [sku, setSku] = useState(defaultData.sku || '');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState(defaultData.costPrice?.toString() || '');
  const [salePrice, setSalePrice] = useState('');

  // Load categories on mount
  useEffect(() => {
    getLookupValues('PRODUCT_CATEGORY').then((values) => {
      setCategories(values as Category[]);
      // Set default category if available
      const defaultCat = values.find((v: any) => v.isDefault);
      if (defaultCat) {
        setCategory(defaultCat.name);
      }
    });
  }, []);

  // Reset form when opening dialog
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(defaultData.name || '');
      setSku(defaultData.sku || '');
      setCostPrice(defaultData.costPrice?.toString() || '');
      setSalePrice('');
      setError(null);
    }
    setOpen(isOpen);
  };

  // Auto-suggest sale price (cost + 20%)
  useEffect(() => {
    if (costPrice && !salePrice) {
      const cost = parseFloat(costPrice);
      if (!isNaN(cost) && cost > 0) {
        setSalePrice(Math.round(cost * 1.2).toString());
      }
    }
  }, [costPrice, salePrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (!category) {
      setError('กรุณาเลือกหมวดหมู่');
      return;
    }
    if (!costPrice || parseFloat(costPrice) < 0) {
      setError('กรุณากรอกราคาทุน');
      return;
    }
    if (!salePrice || parseFloat(salePrice) < 0) {
      setError('กรุณากรอกราคาขาย');
      return;
    }

    startTransition(async () => {
      const result = await createProduct({
        name: name.trim(),
        sku: sku.trim() || null,
        category,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        stock: 0,
        minStock: 5,
        description: null,
        images: [],
      });

      if (result.success && result.data) {
        toast.success('เพิ่มสินค้าสำเร็จ');
        onCreated?.({
          id: result.data.id,
          name: result.data.name,
          costPrice: Number(result.data.costPrice),
        });
        setOpen(false);
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} type="button">
            <Plus className="h-4 w-4 mr-1" />
            สร้างสินค้า
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            เพิ่มสินค้าใหม่
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">ชื่อสินค้า *</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น แบตเตอรี่ 12V20AH"
              autoFocus
              maxLength={200}
            />
          </div>

          {/* SKU + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-sku">รหัสสินค้า (SKU)</Label>
              <SafeInput
                id="product-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="เช่น SA10525"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>หมวดหมู่ *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหมวดหมู่" />
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
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-cost">ราคาทุน *</Label>
              <Input
                id="product-cost"
                type="number"
                step="0.01"
                min="0"
                max={999999999}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sale">ราคาขาย *</Label>
              <Input
                id="product-sale"
                type="number"
                step="0.01"
                min="0"
                max={999999999}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
              />
              {costPrice && salePrice && (
                <p className="text-xs text-muted-foreground">
                  กำไร: {(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)} บาท
                  ({(((parseFloat(salePrice) - parseFloat(costPrice)) / parseFloat(costPrice)) * 100).toFixed(0)}%)
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
