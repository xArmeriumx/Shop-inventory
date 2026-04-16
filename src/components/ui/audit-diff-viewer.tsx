import React, { useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Code2, Eye } from 'lucide-react';
import {
  AUDIT_FIELD_ORDER,
  AUDIT_IGNORE_FIELDS,
  formatAuditValue,
  getFieldLabel,
} from '@/lib/audit-config';

interface AuditDiffViewerProps {
  beforeSnapshot?: Record<string, any> | null;
  afterSnapshot?: Record<string, any> | null;
}

type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffRow {
  keyPath: string;
  label: string;
  tooltip: string;
  oldVal: any;
  newVal: any;
  status: DiffStatus;
  isComplex?: boolean;
}

/**
 * Hardened check for plain objects (excluding null and arrays)
 */
const isRecord = (v: unknown): v is Record<string, unknown> => 
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Safely flatten object hierarchies to extract scalar V1 diffs.
 */
function flattenObject(obj: unknown, prefix = ''): Record<string, any> {
  if (!isRecord(obj)) return {};

  return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    const val = (obj as any)[key];

    if (val === null || val === undefined) {
      acc[keyPath] = val;
    } 
    else if (Array.isArray(val)) {
      if (val.length === 0) {
        acc[keyPath] = '[]';
      } else if (typeof val[0] !== 'object' || val[0] === null) {
        acc[keyPath] = JSON.stringify(val);
      } else {
        // Nested structure detected - Policy: Mark as complex
        acc[keyPath] = "__COMPLEX_DATA__";
      }
    } 
    else if (isRecord(val)) {
      if (val instanceof Date || (typeof (val as any).toISOString === 'function')) {
        acc[keyPath] = val;
      } else {
        // Deeply nested record - Policy: Recurse but mark as complex if needed
        // For V1, we still recurse but the UI will offer raw view
        Object.assign(acc, flattenObject(val, keyPath));
      }
    } 
    else {
      acc[keyPath] = val;
    }
    
    return acc;
  }, {});
}

function RawSnapshotDialog({ 
  before, 
  after 
}: { 
  before: any, 
  after: any 
}) {
  const [copiedBefore, setCopiedBefore] = useState(false);
  const [copiedAfter, setCopiedAfter] = useState(false);

  const JSON_LIMIT = 30000;
  
  const bString = JSON.stringify(before, null, 2);
  const aString = JSON.stringify(after, null, 2);
  
  const bTruncated = bString.length > JSON_LIMIT;
  const aTruncated = aString.length > JSON_LIMIT;

  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  const renderPanel = (title: string, data: any, str: string, truncated: boolean, isCopied: boolean, setCopied: (v: boolean) => void) => (
    <div className="space-y-2 flex flex-col h-full">
      <div className="flex items-center justify-between px-1">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase">{title}</h5>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-[10px] gap-1"
          onClick={() => handleCopy(str, setCopied)}
        >
          {isCopied ? "Copied!" : "Copy Raw"}
        </Button>
      </div>
      {truncated && (
        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-[10px] text-amber-700 leading-tight">
          <strong>Performance Note</strong>: This snapshot is too large to fully preview here. 
          Showing the first {JSON_LIMIT.toLocaleString()} characters.
        </div>
      )}
      <div className="bg-muted p-3 rounded-md overflow-auto flex-1 text-[10px] font-mono whitespace-pre border">
        {truncated ? str.slice(0, JSON_LIMIT) + "\n\n... (Truncated for performance)" : str}
      </div>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2">
          <Code2 className="h-3 w-3" />
          View Raw JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Raw Data Snapshots</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4 overflow-hidden flex-1">
          {renderPanel("Before", before, bString, bTruncated, copiedBefore, setCopiedBefore)}
          {renderPanel("After", after, aString, aTruncated, copiedAfter, setCopiedAfter)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditDiffViewer({ beforeSnapshot, afterSnapshot }: AuditDiffViewerProps) {
  const [changedOnly, setChangedOnly] = useState(true);

  const diffs = useMemo<DiffRow[]>(() => {
    if (!beforeSnapshot && !afterSnapshot) return [];

    const bFlat = flattenObject(beforeSnapshot || {});
    const aFlat = flattenObject(afterSnapshot || {});

    const allKeys = Array.from(new Set([...Object.keys(bFlat), ...Object.keys(aFlat)])).filter(
      (k) => !AUDIT_IGNORE_FIELDS.has(k) && !AUDIT_IGNORE_FIELDS.has(k.split('.').pop() || '')
    );

    allKeys.sort((a, b) => {
      const fieldA = a.split(/[.[\]]/).pop() || a;
      const fieldB = b.split(/[.[\]]/).pop() || b;
      const idxA = AUDIT_FIELD_ORDER.indexOf(fieldA);
      const idxB = AUDIT_FIELD_ORDER.indexOf(fieldB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return allKeys.map((key) => {
      const oldVal = bFlat[key];
      const newVal = aFlat[key];

      let status: DiffStatus = 'unchanged';
      if (oldVal === undefined && newVal !== undefined) status = 'added';
      else if (oldVal !== undefined && newVal === undefined) status = 'removed';
      else if (oldVal !== newVal) status = 'modified'; 

      const { label, tooltip } = getFieldLabel(key);
      const isComplex = oldVal === "__COMPLEX_DATA__" || newVal === "__COMPLEX_DATA__";

      return { keyPath: key, label, tooltip, oldVal, newVal, status, isComplex };
    });
  }, [beforeSnapshot, afterSnapshot]);

  const visibleDiffs = useMemo(() => {
    return diffs.filter((d) => !changedOnly || d.status !== 'unchanged');
  }, [diffs, changedOnly]);

  const renderValue = (val: any, status: DiffStatus, isComplex?: boolean) => {
    if (isComplex) {
      return (
        <span className="text-amber-600 font-medium italic">
          Complex data changed — View raw JSON
        </span>
      );
    }
    return formatAuditValue(val);
  };

  if (diffs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 bg-muted/20 border rounded text-center">
        ไม่พบข้อมูล Snapshot เพื่อทำการเปรียบเทียบ
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Visual Change Set
          </h4>
          <RawSnapshotDialog before={beforeSnapshot} after={afterSnapshot} />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="changed-only"
            checked={changedOnly}
            onCheckedChange={setChangedOnly}
          />
          <Label htmlFor="changed-only" className="text-xs text-muted-foreground cursor-pointer">
            Show Changed Only
          </Label>
        </div>
      </div>

      {/* Diff Table */}
      <div className="rounded-md border bg-background/50 overflow-hidden">
        <Table className="text-xs">
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[30%]">Field Name</TableHead>
              <TableHead className="w-[35%]">Old Value</TableHead>
              <TableHead className="w-[35%]">New Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDiffs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                  ไม่มีรายการเปลี่ยนแปลง (No changes detected)
                </TableCell>
              </TableRow>
            ) : (
              visibleDiffs.map((row) => (
                <TableRow key={row.keyPath} className="group hover:bg-muted/30">
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>{row.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {row.tooltip}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="align-top">
                    {row.status === 'added' ? (
                      <span className="text-muted-foreground/30">—</span>
                    ) : (
                      <span
                        className={`block p-1 rounded-sm ${
                          row.status === 'removed' || row.status === 'modified'
                            ? 'bg-red-100/50 text-red-800 line-through decoration-red-400 decoration-1'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {renderValue(row.oldVal, row.status, row.isComplex)}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="align-top">
                    {row.status === 'removed' ? (
                      <span className="text-muted-foreground/30">—</span>
                    ) : (
                      <span
                        className={`block p-1 rounded-sm ${
                          row.status === 'added' || row.status === 'modified'
                            ? 'bg-green-100/50 text-green-800 font-medium'
                            : ''
                        }`}
                      >
                        {renderValue(row.newVal, row.status, row.isComplex)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
