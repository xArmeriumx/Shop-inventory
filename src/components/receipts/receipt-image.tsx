'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageModal } from '@/components/ui/image-modal';

interface ReceiptImageProps {
  receiptUrl: string;
  alt: string;
}

export function ReceiptImage({ receiptUrl, alt }: ReceiptImageProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="mt-8 border-t pt-4 print:hidden">
        <h4 className="font-semibold mb-3 text-sm">{alt}:</h4>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-block"
        >
          <Image
            src={receiptUrl}
            alt={alt}
            className="max-w-xs max-h-48 object-contain rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
            width={320}
            height={192}
            unoptimized
          />
        </button>
        <p className="text-xs text-muted-foreground mt-2">คลิกที่รูปเพื่อดูขนาดเต็ม</p>
      </div>

      <ImageModal
        src={receiptUrl}
        alt={alt}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
