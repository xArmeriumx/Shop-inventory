'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

interface TaxDocumentHeaderProps {
  data: any;
  isPending: boolean;
  onPost: () => void;
  onVoid: () => void;
}

export function TaxDocumentHeader({ data, isPending, onPost, onVoid }: TaxDocumentHeaderProps) {
  const isPosted = data.status === 'POSTED';
  const isVoided = data.status === 'VOIDED';
  const isReadOnly = isPosted || isVoided;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-6 rounded-[2rem] border shadow-sm backdrop-blur-sm bg-opacity-50">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/tax/purchase-tax">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tighter">{data.internalDocNo}</h2>
            <Badge 
              className="rounded-full px-4 py-1"
              variant={isPosted ? 'default' : isVoided ? 'destructive' : 'secondary'}
            >
              {isPosted ? 'ลงบัญชีแล้ว' : isVoided ? 'ยกเลิก' : 'ฉบับร่าง'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            สร้างโดยระบบเมื่อ {format(new Date(data.createdAt), 'dd MMMM yyyy HH:mm', { locale: th })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isReadOnly && (
          <Button
            className="gap-2 rounded-2xl h-11 px-6 shadow-lg shadow-primary/20"
            onClick={onPost}
            disabled={isPending}
          >
            <CheckCircle className="h-4 w-4" />
            ลงบัญชีภาษีซื้อ (Post)
          </Button>
        )}
        {isPosted && (
          <Button
            variant="outline"
            className="gap-2 rounded-2xl h-11 px-6 text-destructive border-destructive hover:bg-destructive/10"
            onClick={() => {
              if (confirm('ยืนยันระบบจะยกเลิกเอกสารภาษีซื้อนี้?')) {
                onVoid();
              }
            }}
            disabled={isPending}
          >
            <XCircle className="h-4 w-4" />
            ยกเลิกเอกสาร (Void)
          </Button>
        )}
      </div>
    </div>
  );
}
