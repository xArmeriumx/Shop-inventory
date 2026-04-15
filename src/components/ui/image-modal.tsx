'use client';

import { X } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

interface ImageModalProps {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageModal({ src, alt, open, onOpenChange }: ImageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-auto">
        <DialogClose className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground bg-background/80 backdrop-blur-sm p-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <Image
          src={src}
          alt={alt}
          className="w-full h-auto object-contain"
          width={1200}
          height={800}
          unoptimized
        />
      </DialogContent>
    </Dialog>
  );
}
