'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Camera,
  Upload,
  FileText,
  Check,
  X,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Receipt,
  Store,
  Calendar,
  CreditCard,
  Tag,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ReceiptData, ReceiptItem } from '@/lib/ocr/types';

interface ReceiptScannerProps {
  onScanComplete?: (data: ReceiptData) => void;
  onClose?: () => void;
}

type ScanState = 'idle' | 'ai' | 'result' | 'error';

// Expense categories
const CATEGORIES = [
  { value: 'อาหาร', label: '🍔 อาหาร' },
  { value: 'เดินทาง', label: '🚗 เดินทาง' },
  { value: 'สาธารณูปโภค', label: '💡 สาธารณูปโภค' },
  { value: 'สำนักงาน', label: '📎 สำนักงาน' },
  { value: 'สินค้า', label: '📦 สินค้า' },
  { value: 'อื่นๆ', label: '📋 อื่นๆ' },
];

// Payment methods
const PAYMENT_METHODS = [
  { value: 'CASH', label: 'เงินสด' },
  { value: 'CARD', label: 'บัตรเครดิต/เดบิต' },
  { value: 'TRANSFER', label: 'โอนเงิน' },
  { value: 'QR', label: 'QR Code' },
  { value: 'PROMPTPAY', label: 'PromptPay' },
];

export function ReceiptScanner({ onScanComplete, onClose }: ReceiptScannerProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalResult, setOriginalResult] = useState<ReceiptData | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  
  // Editable fields (separate from original result)
  const [editedVendor, setEditedVendor] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedTime, setEditedTime] = useState('');
  const [editedTotal, setEditedTotal] = useState<number>(0);
  const [editedCategory, setEditedCategory] = useState('อื่นๆ');
  const [editedPaymentMethod, setEditedPaymentMethod] = useState('CASH');
  const [editedItems, setEditedItems] = useState<ReceiptItem[]>([]);
  const [editedTaxId, setEditedTaxId] = useState('');
  const [editedReceiptNumber, setEditedReceiptNumber] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Set edited fields from OCR result
  const populateEditedFields = (data: ReceiptData) => {
    setEditedVendor(data.vendor || '');
    setEditedDate(data.date || new Date().toISOString().split('T')[0]);
    setEditedTime(data.time || '');
    setEditedTotal(data.total || 0);
    setEditedCategory(data.suggestedCategory || 'อื่นๆ');
    setEditedPaymentMethod(data.paymentMethod || 'CASH');
    setEditedItems(data.items || []);
    setEditedTaxId(data.taxId || '');
    setEditedReceiptNumber(data.receiptNumber || '');
  };

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Process image with Vision OCR
  const processImage = useCallback(async (file: File) => {
    setState('ai');
    setError('');
    setOcrProgress(0);
    const startTime = Date.now();

    try {
      const base64 = await fileToBase64(file);
      setOcrProgress(30);
      
      const response = await fetch('/api/ocr/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
        }),
      });

      setOcrProgress(80);
      
      const data = await response.json();
      setProcessingTime(Date.now() - startTime);
      setOcrProgress(100);

      if (!response.ok || !data.success) {
        setError(data.error || 'ไม่สามารถอ่านใบเสร็จได้');
        setState('error');
        return;
      }

      setOcrConfidence(data.data.confidence || 85);
      setOriginalResult(data.data);
      populateEditedFields(data.data);
      setState('result');
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถประมวลผลได้');
      setState('error');
    }
  }, [fileToBase64]);

  // Handle file selection
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    await processImage(file);
  }, [processImage]);

  // Reset scanner
  const handleReset = () => {
    setState('idle');
    setImagePreview(null);
    setOriginalResult(null);
    setOcrProgress(0);
    setError('');
    setEditedItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Update item
  const updateItem = (index: number, field: keyof ReceiptItem, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate item total if quantity or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = (newItems[index].quantity || 1) * (newItems[index].unitPrice || 0);
    }
    
    setEditedItems(newItems);
    
    // Recalculate total
    const newTotal = newItems.reduce((sum, item) => sum + (item.total || 0), 0);
    setEditedTotal(newTotal);
  };

  // Add new item
  const addItem = () => {
    setEditedItems([
      ...editedItems,
      { name: '', quantity: 1, unitPrice: 0, total: 0 } as ReceiptItem,
    ]);
  };

  // Remove item
  const removeItem = (index: number) => {
    const newItems = editedItems.filter((_, i) => i !== index);
    setEditedItems(newItems);
    
    // Recalculate total
    const newTotal = newItems.reduce((sum, item) => sum + (item.total || 0), 0);
    setEditedTotal(newTotal);
  };

  // Confirm and save with edited data
  const handleConfirm = () => {
    if (onScanComplete) {
      const editedResult: ReceiptData = {
        ...originalResult,
        vendor: editedVendor,
        date: editedDate,
        time: editedTime,
        total: editedTotal,
        suggestedCategory: editedCategory,
        paymentMethod: editedPaymentMethod,
        items: editedItems,
        taxId: editedTaxId,
        receiptNumber: editedReceiptNumber,
        // Keep original values for reference
        subtotal: editedTotal,
        confidence: ocrConfidence,
      } as ReceiptData;
      
      onScanComplete(editedResult);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">สแกนใบเสร็จ</CardTitle>
              <CardDescription>ถ่ายรูปหรืออัปโหลดใบเสร็จ</CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Section */}
        {(state === 'idle' || state === 'error') && (
          <div className="space-y-4">
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <Image 
                  src={imagePreview} 
                  alt="Receipt preview" 
                  className="w-full max-h-64 object-contain bg-muted"
                  width={600}
                  height={300}
                  unoptimized
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  เปลี่ยนรูป
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  ถ่ายรูปหรืออัปโหลดใบเสร็จ
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    ถ่ายรูป
                  </Button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    อัปโหลด
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {state === 'error' && error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="font-medium text-destructive">{error}</p>
              </div>
            )}

            {state === 'error' && imagePreview && (
              <Button 
                onClick={() => {
                  const file = fileInputRef.current?.files?.[0] || cameraInputRef.current?.files?.[0];
                  if (file) processImage(file);
                }}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                ลองใหม่
              </Button>
            )}
          </div>
        )}

        {/* AI Processing State */}
        {state === 'ai' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="font-medium">AI กำลังวิเคราะห์ใบเสร็จ...</p>
            <p className="text-sm text-muted-foreground mt-1">
              กำลังดึงข้อมูลร้านค้า, วันที่, ยอดเงิน
            </p>
            <Progress value={ocrProgress} className="w-48 mx-auto mt-4" />
          </div>
        )}

        {/* Result State with Editable Fields */}
        {state === 'result' && originalResult && (
          <div className="space-y-4">
            {/* Confidence Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">ผลการวิเคราะห์</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ocrConfidence >= 70 ? 'default' : 'secondary'}>
                  ความมั่นใจ {ocrConfidence}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {(processingTime / 1000).toFixed(1)}s
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Editable Form */}
            <div className="grid gap-4">
              {/* Vendor */}
              <div className="grid gap-2">
                <Label htmlFor="vendor" className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  ร้านค้า
                </Label>
                <Input
                  id="vendor"
                  value={editedVendor}
                  onChange={(e) => setEditedVendor(e.target.value)}
                  placeholder="ชื่อร้านค้า"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    วันที่
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">เวลา</Label>
                  <Input
                    id="time"
                    type="time"
                    value={editedTime}
                    onChange={(e) => setEditedTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Category & Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    หมวดหมู่
                  </Label>
                  <Select value={editedCategory} onValueChange={setEditedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    ชำระเงินโดย
                  </Label>
                  <Select value={editedPaymentMethod} onValueChange={setEditedPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((pm) => (
                        <SelectItem key={pm.value} value={pm.value}>
                          {pm.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">รายการ ({editedItems.length})</Label>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" />
                    เพิ่มรายการ
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {editedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        placeholder="ชื่อสินค้า"
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                        className="w-16 h-8 text-sm text-center"
                        min={1}
                      />
                      <span className="text-muted-foreground text-sm">x</span>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                        className="w-24 h-8 text-sm text-right"
                        min={0}
                      />
                      <span className="text-sm font-medium w-20 text-right">
                        ฿{item.total.toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {editedItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      ไม่มีรายการสินค้า
                    </p>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4">
                <span className="font-bold text-lg">ยอดรวม</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">฿</span>
                  <Input
                    type="number"
                    value={editedTotal}
                    onChange={(e) => setEditedTotal(Number(e.target.value))}
                    className="w-32 h-10 text-xl font-bold text-right"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* OCR Raw Text (collapsible) */}
            <details className="text-sm">
              <summary className="text-muted-foreground cursor-pointer">
                <FileText className="h-3 w-3 inline mr-1" />
                ข้อความดิบจาก OCR ({ocrConfidence.toFixed(0)}%)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-3 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(originalResult, null, 2)}
              </pre>
            </details>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                สแกนใหม่
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                บันทึกค่าใช้จ่าย
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
