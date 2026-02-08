'use client';

import { useEffect, useRef, useCallback } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeCanvasProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  format?: string;
}

/**
 * Renders a barcode onto a canvas element using JsBarcode.
 * Used for both display and print.
 */
export function BarcodeCanvas({
  value,
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 14,
  format = 'CODE128',
}: BarcodeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          margin: 5,
          textMargin: 2,
        });
      } catch {
        // Invalid barcode value — show error silently
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 200;
          canvasRef.current.height = 30;
          ctx.fillStyle = '#ef4444';
          ctx.font = '12px sans-serif';
          ctx.fillText('Invalid SKU', 10, 20);
        }
      }
    }
  }, [value, width, height, displayValue, fontSize, format]);

  if (!value) return null;

  return <canvas ref={canvasRef} />;
}

/**
 * Generate barcode as Data URL for embedding/download
 */
export function generateBarcodeDataURL(
  value: string,
  options: {
    width?: number;
    height?: number;
    format?: string;
  } = {}
): string | null {
  if (!value) return null;

  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
      format: options.format || 'CODE128',
      width: options.width || 2,
      height: options.height || 50,
      displayValue: true,
      fontSize: 14,
      margin: 5,
      textMargin: 2,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
