'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { formatCurrency } from '@/lib/formatters';
import '@/styles/thermal-receipt.css';

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ThermalReceiptData {
  // Shop Info
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopLogo?: string;
  shopTaxId?: string;
  
  // Invoice Info
  invoiceNumber: string;
  date: Date;
  cashierName?: string;
  
  // Customer
  customerName?: string;
  
  // Items
  items: ThermalReceiptItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  total: number;
  
  // Payment
  paymentMethod: string;
  amountReceived?: number;
  change?: number;
  
  // Customization
  headerText?: string;
  footerText?: string;
}

interface ThermalReceiptProps {
  data: ThermalReceiptData;
  className?: string;
}

export function ThermalReceipt({ data, className = '' }: ThermalReceiptProps) {
  const {
    shopName,
    shopAddress,
    shopPhone,
    shopLogo,
    shopTaxId,
    invoiceNumber,
    date,
    cashierName,
    customerName,
    items,
    subtotal,
    discount,
    total,
    paymentMethod,
    amountReceived,
    change,
    headerText,
    footerText,
  } = data;

  const paymentMethodLabel = paymentMethod === 'CASH' ? 'เงินสด' : 
                              paymentMethod === 'TRANSFER' ? 'โอนเงิน' : paymentMethod;

  return (
    <div className={`thermal-receipt ${className}`}>
      {/* Header */}
      <div className="receipt-header">
        {shopLogo && (
          <Image 
            src={shopLogo} 
            alt={shopName} 
            className="shop-logo" 
            width={64} 
            height={64} 
            unoptimized
          />
        )}
        <div className="shop-name">{shopName}</div>
        {shopAddress && <div className="shop-info">{shopAddress}</div>}
        {shopPhone && <div className="shop-info">โทร: {shopPhone}</div>}
        {shopTaxId && <div className="shop-info">TAX ID: {shopTaxId}</div>}
        {headerText && <div className="shop-info">{headerText}</div>}
      </div>

      {/* Invoice Info */}
      <div className="invoice-info">
        <div className="invoice-row">
          <span>เลขที่:</span>
          <span>{invoiceNumber}</span>
        </div>
        <div className="invoice-row">
          <span>วันที่:</span>
          <span>{format(date, 'dd/MM/yyyy HH:mm', { locale: th })}</span>
        </div>
        {cashierName && (
          <div className="invoice-row">
            <span>พนักงาน:</span>
            <span>{cashierName}</span>
          </div>
        )}
        {customerName && (
          <div className="invoice-row">
            <span>ลูกค้า:</span>
            <span>{customerName}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="items-section">
        <div className="item-header">
          <span className="item-name">รายการ</span>
          <span className="item-qty">จำนวน</span>
          <span className="item-price">รวม</span>
        </div>
        {items.map((item, index) => (
          <div key={index} className="item-row">
            <span className="item-name" title={item.name}>{item.name}</span>
            <span className="item-qty">{item.quantity}</span>
            <span className="item-price">{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="totals-section">
        <div className="total-row">
          <span>รวม ({items.length} รายการ)</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discount && discount > 0 && (
          <div className="total-row">
            <span>ส่วนลด</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="total-row grand-total">
          <span>ยอดสุทธิ</span>
          <span>{formatCurrency(total)}</span>
        </div>
        
        <div className="total-row payment">
          <span>ชำระโดย</span>
          <span>{paymentMethodLabel}</span>
        </div>
        {amountReceived !== undefined && (
          <div className="total-row">
            <span>รับเงิน</span>
            <span>{formatCurrency(amountReceived)}</span>
          </div>
        )}
        {change !== undefined && change > 0 && (
          <div className="total-row">
            <span>เงินทอน</span>
            <span>{formatCurrency(change)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="receipt-footer">
        <div className="divider">================================</div>
        <div className="thank-you">ขอบคุณที่ใช้บริการ</div>
        {footerText && <div className="footer-text">{footerText}</div>}
        <div className="footer-text">{shopName}</div>
      </div>
    </div>
  );
}
