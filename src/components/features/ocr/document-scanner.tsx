'use client';

import { useState, useRef, useCallback } from 'react';
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
  ShoppingCart,
  FileBox,
  Plus,
  Trash2,
} from 'lucide-react';
import { compressImageForOCR, formatFileSize, needsCompression } from '@/lib/ocr/compress';
import { DocumentType } from '@/lib/ocr/strategies';

// Document type configurations
const DOC_TYPE_CONFIG: Record<DocumentType, { 
  title: string;
  description: string;
  icon: React.ReactNode;
}> = {
  receipt: {
    title: 'สแกนใบเสร็จ',
    description: 'ใบเสร็จค่าใช้จ่าย, ร้านค้า, ร้านอาหาร',
    icon: <Receipt className="h-5 w-5" />,
  },
  purchase: {
    title: 'สแกนใบสั่งซื้อ',
    description: 'ใบสั่งซื้อสินค้า, Invoice, Delivery Note',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  invoice: {
    title: 'สแกนใบแจ้งหนี้',
    description: 'ใบแจ้งหนี้, ใบกำกับภาษี',
    icon: <FileBox className="h-5 w-5" />,
  },
};

export interface DocumentScannerProps {
  /** Document type to scan */
  documentType: DocumentType;
  /** Callback when scan is complete */
  onScanComplete?: (data: any) => void;
  /** Callback to close the scanner */
  onClose?: () => void;
  /** Whether to allow editing results */
  editable?: boolean;
}

type ScanState = 'idle' | 'compressing' | 'scanning' | 'result' | 'error';

export function DocumentScanner({ 
  documentType, 
  onScanComplete, 
  onClose,
  editable = true,
}: DocumentScannerProps) {
  const config = DOC_TYPE_CONFIG[documentType];
  
  const [state, setState] = useState<ScanState>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [compressionInfo, setCompressionInfo] = useState<string>('');
  
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

    await processImage(file);
  }, [documentType]);

  // Process image with compression and OCR
  const processImage = async (file: File) => {
    setError('');
    setProgress(0);
    const startTime = Date.now();

    try {
      // Step 1: Compress if needed
      let imageBase64: string;
      let mimeType: string;
      
      if (needsCompression(file)) {
        setState('compressing');
        setProgress(10);
        
        const compressed = await compressImageForOCR(file);
        imageBase64 = compressed.base64;
        mimeType = compressed.mimeType;
        
        setCompressionInfo(
          `${formatFileSize(compressed.originalSize)} → ${formatFileSize(compressed.compressedSize)} (${Math.round((1 - compressed.compressionRatio) * 100)}% ลดลง)`
        );
      } else {
        // Use original file
        const base64Full = await fileToBase64(file);
        imageBase64 = base64Full;
        mimeType = file.type || 'image/jpeg';
      }
      
      setProgress(30);
      setState('scanning');

      // Step 2: Call OCR API
      const response = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          documentType,
        }),
      });

      setProgress(80);
      
      const data = await response.json();
      setProcessingTime(Date.now() - startTime);
      setProgress(100);

      if (!response.ok || !data.success) {
        setError(data.error || 'ไม่สามารถอ่านเอกสารได้');
        setState('error');
        return;
      }

      setConfidence(data.confidence || 85);
      setResult(data.data);
      setState('result');

    } catch (err: any) {
      setError(err.message || 'ไม่สามารถประมวลผลได้');
      setState('error');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
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
  };

  // Reset scanner
  const handleReset = () => {
    setState('idle');
    setImagePreview(null);
    setResult(null);
    setProgress(0);
    setError('');
    setCompressionInfo('');
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
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
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
                <img 
                  src={imagePreview} 
                  alt="Document preview" 
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
                <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-3 text-primary">
                  {config.icon}
                </div>
                <p className="text-muted-foreground mb-4">
                  ถ่ายรูปหรืออัปโหลดเอกสาร
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
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

                {/* Camera Guide Tips */}
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">💡 เคล็ดลับถ่ายรูปให้ชัด</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg">☀️</span>
                      <span>แสงสว่างเพียงพอ</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg">📐</span>
                      <span>ถ่ายตรงๆ ไม่เอียง</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg">🔍</span>
                      <span>เห็นตัวอักษรชัด</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {state === 'error' && error && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{error}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    กรุณาลองถ่ายรูปใหม่ให้ชัดขึ้น หรือกรอกข้อมูลเอง
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing States */}
        {(state === 'compressing' || state === 'scanning') && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <p className="font-medium">
              {state === 'compressing' ? 'กำลังบีบอัดรูป...' : 'AI กำลังวิเคราะห์...'}
            </p>
            {compressionInfo && (
              <p className="text-sm text-muted-foreground mt-1">{compressionInfo}</p>
            )}
            <Progress value={progress} className="w-48 mx-auto mt-4" />
          </div>
        )}

        {/* Result Section */}
        {state === 'result' && result && (
          <div className="space-y-4">
            {/* Confidence Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">ผลการวิเคราะห์</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={confidence >= 70 ? 'default' : 'secondary'}>
                  ความมั่นใจ {confidence}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {(processingTime / 1000).toFixed(1)}s
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Result Data Display */}
            <div className="bg-muted/50 rounded-lg p-4 max-h-64 overflow-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                สแกนใหม่
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                ยืนยันข้อมูล
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
