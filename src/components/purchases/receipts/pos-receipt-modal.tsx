'use client';

import { useState, useEffect, useRef } from 'react';
import { Printer, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ThermalReceipt, ThermalReceiptData } from './thermal-receipt';
import { getSale } from '@/actions/sales/sales.actions';
import { getShop } from '@/actions/core/shop.actions';

interface POSReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
  amountReceived?: number;
  change?: number;
}

/**
 * POS Receipt Modal - Shows thermal receipt and allows printing
 * without leaving the POS page
 */
export function POSReceiptModal({
  isOpen,
  onClose,
  saleId,
  amountReceived,
  change,
}: POSReceiptModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [receiptData, setReceiptData] = useState<ThermalReceiptData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch sale and shop data
  useEffect(() => {
    if (!isOpen || !saleId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [saleRes, shopRes] = await Promise.all([
          getSale(saleId),
          getShop(),
        ]);

        if (saleRes.success && shopRes.success) {
          const shop = shopRes.data;
          const sale = saleRes.data;

          if (sale && shop) {
            setReceiptData({
              shopName: shop.name,
              shopAddress: shop.address || undefined,
              shopPhone: shop.phone || undefined,
              shopLogo: shop.logo || undefined,
              shopTaxId: shop.taxId || undefined,
              invoiceNumber: sale.invoiceNumber,
              date: new Date(sale.date),
              customerName: sale.customerName || undefined,
              items: sale.items.map((item: any) => ({
                name: item.productName,
                quantity: item.quantity,
                price: Number(item.unitPrice),
                subtotal: Number(item.subtotal),
              })),
              subtotal: Number(sale.totalAmount),
              total: Number(sale.totalAmount),
              paymentMethod: sale.paymentMethod,
              amountReceived: amountReceived,
              change: change,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch receipt data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, saleId, amountReceived, change]);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open('', '_blank', 'width=400,height=600');

      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>ใบเสร็จรับเงิน</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                padding: 0;
                margin: 0;
              }
              @page {
                size: 80mm auto;
                margin: 0;
              }
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              .thermal-receipt {
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.4;
                width: 80mm;
                max-width: 80mm;
                padding: 4mm;
                background: white;
                color: black;
              }
              .receipt-header {
                text-align: center;
                padding-bottom: 8px;
                border-bottom: 1px dashed #000;
                margin-bottom: 8px;
              }
              .shop-logo {
                max-width: 120px;
                max-height: 60px;
                margin: 0 auto 8px;
                display: block;
              }
              .shop-name {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 4px;
              }
              .shop-info {
                font-size: 11px;
                color: #333;
              }
              .invoice-info {
                padding: 8px 0;
                border-bottom: 1px dashed #000;
                margin-bottom: 8px;
              }
              .invoice-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
              }
              .items-section {
                padding-bottom: 8px;
                border-bottom: 1px dashed #000;
                margin-bottom: 8px;
              }
              .item-header {
                display: flex;
                font-weight: bold;
                font-size: 11px;
                padding-bottom: 4px;
                border-bottom: 1px solid #ccc;
                margin-bottom: 4px;
              }
              .item-row {
                display: flex;
                font-size: 11px;
                padding: 2px 0;
              }
              .item-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .item-qty {
                width: 40px;
                text-align: center;
              }
              .item-price {
                width: 70px;
                text-align: right;
              }
              .totals-section {
                padding-bottom: 8px;
                border-bottom: 1px dashed #000;
                margin-bottom: 8px;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                padding: 2px 0;
              }
              .total-row.grand-total {
                font-size: 14px;
                font-weight: bold;
                padding: 4px 0;
                border-top: 1px solid #000;
                margin-top: 4px;
              }
              .total-row.payment {
                border-top: 1px dashed #ccc;
                margin-top: 8px;
                padding-top: 8px;
              }
              .receipt-footer {
                text-align: center;
                padding-top: 8px;
                font-size: 11px;
              }
              .thank-you {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 4px;
              }
              .footer-text {
                font-size: 10px;
                color: #666;
              }
              .divider {
                text-align: center;
                font-size: 10px;
                letter-spacing: 2px;
                padding: 4px 0;
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();

        // Short delay to ensure styles are loaded
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle>พิมพ์ใบเสร็จ</DialogTitle>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto p-4 bg-gray-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : receiptData ? (
            <div ref={printRef} className="flex justify-center">
              <ThermalReceipt data={receiptData} />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              ไม่สามารถโหลดข้อมูลใบเสร็จได้
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button
            className="flex-1"
            onClick={handlePrint}
            disabled={isLoading || !receiptData}
          >
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์
          </Button>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
