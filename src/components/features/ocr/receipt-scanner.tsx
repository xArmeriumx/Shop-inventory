'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Camera,
  Upload,
  Loader2,
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
} from 'lucide-react';
import { recognizeImage } from '@/lib/ocr/client-ocr';
import type { ReceiptData } from '@/lib/ocr/types';

interface ReceiptScannerProps {
  onScanComplete?: (data: ReceiptData) => void;
  onClose?: () => void;
}

type ScanState = 'idle' | 'ocr' | 'ai' | 'result' | 'error';

export function ReceiptScanner({ onScanComplete, onClose }: ReceiptScannerProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptData | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Process image
    await processImage(file);
  }, []);

  // Process image with OCR (client) + AI (server)
  const processImage = async (file: File) => {
    setState('ocr');
    setError('');
    setOcrProgress(0);
    const startTime = Date.now();

    try {
      // Step 1: OCR on client-side (with image preprocessing)
      const ocrResult = await recognizeImage(file, {
        languages: ['tha', 'eng'],
        preprocess: true,
        preset: 'receipt',
        onProgress: (progress) => {
          setOcrProgress(progress);
        },
      });

      setOcrText(ocrResult.text);
      setOcrConfidence(ocrResult.confidence);

      if (!ocrResult.text || ocrResult.text.trim().length < 10) {
        setError('ไม่สามารถอ่านข้อความจากรูปได้ กรุณาลองถ่ายรูปใหม่ให้ชัดขึ้น');
        setState('error');
        return;
      }

      // Step 2: AI extraction on server
      setState('ai');
      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocrText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
        }),
      });

      const data = await response.json();
      setProcessingTime(Date.now() - startTime);

      if (!response.ok || !data.success) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        setState('error');
        return;
      }

      setResult(data.data);
      setState('result');
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถประมวลผลได้');
      setState('error');
    }
  };

  // Reset scanner
  const handleReset = () => {
    setState('idle');
    setImagePreview(null);
    setResult(null);
    setOcrText('');
    setOcrProgress(0);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Confirm and save
  const handleConfirm = () => {
    if (result && onScanComplete) {
      onScanComplete(result);
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
            {/* Image Preview or Upload Area */}
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img 
                  src={imagePreview} 
                  alt="Receipt preview" 
                  className="w-full max-h-64 object-contain bg-muted"
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
                  {/* Camera Button */}
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

                  {/* Upload Button */}
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

            {/* Error Message */}
            {state === 'error' && error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{error}</p>
                  {ocrText && (
                    <details className="mt-2">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        ดู OCR Text ({ocrConfidence.toFixed(0)}% confidence)
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                        {ocrText}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Retry Button */}
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

        {/* OCR Processing State */}
        {state === 'ocr' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="font-medium mb-2">กำลังอ่านข้อความ...</p>
            <Progress value={ocrProgress} className="w-48 mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">{ocrProgress}%</p>
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
          </div>
        )}

        {/* Result State */}
        {state === 'result' && result && (
          <div className="space-y-4">
            {/* Confidence Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">ผลการวิเคราะห์</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={result.confidence >= 70 ? 'default' : 'secondary'}>
                  ความมั่นใจ {result.confidence}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {(processingTime / 1000).toFixed(1)}s
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Extracted Data */}
            <div className="grid gap-4">
              {/* Vendor */}
              {result.vendor && (
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ร้านค้า</p>
                    <p className="font-medium">{result.vendor}</p>
                  </div>
                </div>
              )}

              {/* Date */}
              {result.date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">วันที่</p>
                    <p className="font-medium">
                      {result.date} {result.time && `เวลา ${result.time}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Category */}
              {result.suggestedCategory && (
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">หมวดหมู่ที่แนะนำ</p>
                    <Badge variant="secondary">{result.suggestedCategory}</Badge>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {result.paymentMethod && (
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ชำระเงินโดย</p>
                    <p className="font-medium">{result.paymentMethod}</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Items */}
              {result.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">รายการ ({result.items.length})</p>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 max-h-32 overflow-auto">
                    {result.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span className="font-medium">฿{item.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4">
                <span className="font-bold text-lg">ยอดรวม</span>
                <span className="font-bold text-2xl text-primary">
                  ฿{result.total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* OCR Text (collapsible) */}
            <details className="text-sm">
              <summary className="text-muted-foreground cursor-pointer">
                <FileText className="h-3 w-3 inline mr-1" />
                ข้อความดิบจาก OCR ({ocrConfidence.toFixed(0)}%)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-3 rounded max-h-32 overflow-auto whitespace-pre-wrap">
                {ocrText}
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
