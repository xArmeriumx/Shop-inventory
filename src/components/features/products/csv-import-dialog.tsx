'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { parseCSVFile, type ParsedProduct, type ParsedCSVResult } from '@/lib/csv-parser';
import { downloadProductTemplate } from '@/lib/csv-template';
import { batchCreateProducts } from '@/actions/products';
import { PRODUCT_CATEGORIES } from '@/lib/constants';

// =============================================================================
// TYPES
// =============================================================================

type Step = 'upload' | 'preview' | 'result';

interface ImportResult {
  created: number;
  failed: number;
  details: {
    created: Array<{ name: string }>;
    failed: Array<{ name: string; error: string }>;
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CSVImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CSVImportDialog({ open, onClose }: CSVImportDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ParsedCSVResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  // Reset state when dialog closes
  const handleClose = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    setImportResult(null);
    setFileName('');
    setDragActive(false);
    onClose();
  }, [onClose]);

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('กรุณาเลือกไฟล์ .csv เท่านั้น');
      return;
    }

    setFileName(file.name);
    const result = await parseCSVFile(file);

    if (result.totalRows === 0) {
      alert('ไฟล์ว่างเปล่าหรือรูปแบบไม่ถูกต้อง');
      return;
    }

    setParseResult(result);
    setStep('preview');
  }, []);

  // Handle import confirmation
  const handleImport = useCallback(() => {
    if (!parseResult) return;

    const validProducts = parseResult.products.filter(p => p._isValid);
    if (validProducts.length === 0) {
      alert('ไม่มีข้อมูลที่ถูกต้องสำหรับนำเข้า');
      return;
    }

    startTransition(async () => {
      const inputs = validProducts.map(p => ({
        name: p.name,
        sku: p.sku,
        category: p.category,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
      }));

      const response = await batchCreateProducts(inputs);

      setImportResult({
        created: response.data?.created?.length || 0,
        failed: response.data?.failed?.length || 0,
        details: {
          created: response.data?.created?.map(c => ({ name: c.name })) || [],
          failed: response.data?.failed || [],
        },
      });
      setStep('result');
      router.refresh();
    });
  }, [parseResult, router]);

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            นำเข้าสินค้าจาก CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2 border-b">
          <StepBadge step={1} label="อัปโหลด" active={step === 'upload'} done={step !== 'upload'} />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <StepBadge step={2} label="ตรวจสอบ" active={step === 'preview'} done={step === 'result'} />
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <StepBadge step={3} label="ผลลัพธ์" active={step === 'result'} done={false} />
        </div>

        {/* Content based on step */}
        <div className="flex-1 overflow-y-auto py-4">
          {step === 'upload' && (
            <UploadStep
              dragActive={dragActive}
              onDrag={handleDrag}
              onDrop={handleDrop}
              onFile={handleFile}
            />
          )}

          {step === 'preview' && parseResult && (
            <PreviewStep
              result={parseResult}
              fileName={fileName}
            />
          )}

          {step === 'result' && importResult && (
            <ResultStep result={importResult} />
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              ยกเลิก
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setParseResult(null); }}
                disabled={isPending}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                เลือกไฟล์ใหม่
              </Button>
              <Button
                onClick={handleImport}
                disabled={isPending || !parseResult || parseResult.validCount === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังนำเข้า...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    นำเข้า {parseResult?.validCount} รายการ
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={handleClose}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              เสร็จสิ้น
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StepBadge({ step, label, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
      active
        ? 'bg-primary text-primary-foreground'
        : done
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
    }`}>
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <span className="w-4 text-center">{step}</span>
      )}
      {label}
    </div>
  );
}

// =============================================================================
// STEP 1: UPLOAD
// =============================================================================

function UploadStep({
  dragActive,
  onDrag,
  onDrop,
  onFile,
}: {
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (file: File) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all
          ${dragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
          }
        `}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`rounded-full p-4 transition-colors ${
            dragActive ? 'bg-primary/10' : 'bg-muted'
          }`}>
            <Upload className={`h-8 w-8 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-base font-medium">
              ลากไฟล์ CSV มาวางที่นี่
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              หรือคลิกเพื่อเลือกไฟล์
            </p>
          </div>
          <label htmlFor="csv-file-input">
            <Button variant="outline" size="sm" asChild>
              <span>เลือกไฟล์</span>
            </Button>
          </label>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onFile(e.target.files[0]);
              }
            }}
          />
        </div>
      </div>

      {/* Template Download */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">ยังไม่มีไฟล์?</p>
          <p className="text-xs text-muted-foreground">
            ดาวน์โหลด template พร้อมตัวอย่างข้อมูล
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadProductTemplate}>
          <FileDown className="mr-2 h-4 w-4" />
          ดาวน์โหลด Template
        </Button>
      </div>

      {/* Format Guide */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
        <p className="text-sm font-medium">รูปแบบไฟล์ที่รองรับ</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span><strong>Name</strong> / ชื่อสินค้า (จำเป็น)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span><strong>Category</strong> / หมวดหมู่ (จำเป็น)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span><strong>CostPrice</strong> / ราคาทุน (จำเป็น)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span><strong>SalePrice</strong> / ราคาขาย (จำเป็น)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 text-center text-muted-foreground">—</span>
            <span>SKU / รหัสสินค้า (ถ้ามี)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 text-center text-muted-foreground">—</span>
            <span>Stock, MinStock (ถ้ามี)</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          หมวดหมู่ที่รองรับ: {PRODUCT_CATEGORIES.map(c => c.label).join(', ')}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 2: PREVIEW
// =============================================================================

function PreviewStep({
  result,
  fileName,
}: {
  result: ParsedCSVResult;
  fileName: string;
}) {
  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{fileName}</span>
          <span className="text-muted-foreground">({result.totalRows} แถว)</span>
        </div>
        <div className="flex items-center gap-3">
          {result.validCount > 0 && (
            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              พร้อมนำเข้า {result.validCount}
            </Badge>
          )}
          {result.errorCount > 0 && (
            <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
              <XCircle className="mr-1 h-3 w-3" />
              มีปัญหา {result.errorCount}
            </Badge>
          )}
        </div>
      </div>

      {result.errorCount > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            แถวที่มีปัญหาจะถูกข้ามไป — เฉพาะข้อมูลที่ถูกต้องเท่านั้นที่จะถูกนำเข้า
          </span>
        </div>
      )}

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[350px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">ราคาทุน</TableHead>
                <TableHead className="text-right">ราคาขาย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.products.map((product, idx) => (
                <PreviewRow key={idx} product={product} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ product }: { product: ParsedProduct }) {
  const categoryLabel = PRODUCT_CATEGORIES.find(
    c => c.value === product.category
  )?.label || product.category;

  return (
    <TableRow className={!product._isValid ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
      <TableCell className="text-center text-xs text-muted-foreground">
        {product._rowNumber}
      </TableCell>
      <TableCell>
        {product._isValid ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-xs text-red-500 truncate max-w-[120px]" title={product._errors.join(', ')}>
              {product._errors[0]}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium max-w-[150px] truncate" title={product.name}>
        {product.name || <span className="text-muted-foreground italic">—</span>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {product.sku || '—'}
      </TableCell>
      <TableCell className="text-xs">
        {categoryLabel || <span className="text-red-500">—</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {product.costPrice.toLocaleString()}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {product.salePrice.toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// STEP 3: RESULT
// =============================================================================

function ResultStep({ result }: { result: ImportResult }) {
  const hasFailures = result.failed > 0;
  const allFailed = result.created === 0;

  return (
    <div className="space-y-6">
      {/* Hero Result */}
      <div className={`text-center py-6 rounded-xl border ${
        allFailed
          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
          : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
      }`}>
        {allFailed ? (
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        ) : (
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        )}
        <h3 className="text-lg font-semibold">
          {allFailed ? 'นำเข้าไม่สำเร็จ' : 'นำเข้าสำเร็จ!'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          สร้างสินค้าได้ {result.created} รายการ
          {hasFailures && ` / ล้มเหลว ${result.failed} รายการ`}
        </p>
      </div>

      {/* Created List */}
      {result.details.created.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            สร้างสำเร็จ ({result.details.created.length})
          </p>
          <div className="max-h-[120px] overflow-y-auto rounded-md border bg-green-50/30 dark:bg-green-900/5 p-2">
            <div className="flex flex-wrap gap-1.5">
              {result.details.created.map((item, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-background">
                  {item.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Failed List */}
      {result.details.failed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            ล้มเหลว ({result.details.failed.length})
          </p>
          <div className="max-h-[120px] overflow-y-auto rounded-md border bg-red-50/30 dark:bg-red-900/5 p-2 space-y-1">
            {result.details.failed.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{item.name}</span>
                <span className="text-red-500">— {item.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
