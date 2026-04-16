import { PurchaseStatus, SaleStatus } from '@/types/domain';

/**
 * ERP Business Status Mapping (Rule 10.4 & 11.1)
 * Centralizes the display labels for transitions between technical states and business terminology.
 */

export const getPurchaseStatusLabel = (status: string, docType: 'REQUEST' | 'ORDER' = 'ORDER') => {
  if (docType === 'REQUEST') {
    switch (status) {
      case PurchaseStatus.DRAFT:     return 'ฉบับร่าง PR';
      case PurchaseStatus.PENDING:   return 'รอตรวจสอบ PR';
      case PurchaseStatus.APPROVED:  return 'รอออกใบสั่งซื้อ';
      case PurchaseStatus.ORDERED:   return 'ยืนยัน PR แล้ว';
      case PurchaseStatus.RECEIVED:  return 'รับสินค้าแล้ว';
      case PurchaseStatus.CANCELLED: return 'ยกเลิก PR';
      default: return status;
    }
  }

  // Standard PO Labels
  switch (status) {
    case PurchaseStatus.DRAFT:     return 'รอดำเนินการ';
    case PurchaseStatus.ORDERED:   return 'ส่งใบสั่งซื้อแล้ว';
    case PurchaseStatus.RECEIVED:  return 'รับสินค้าแล้ว';
    case PurchaseStatus.CANCELLED: return 'ยกเลิก PO';
    default: return status;
  }
};

export const getSaleStatusLabel = (status: string) => {
  switch (status) {
    case SaleStatus.DRAFT:     return 'ฉบับร่าง (ยังไม่จอง)';
    case SaleStatus.CONFIRMED: return 'ยืนยันแล้ว (จองสต็อก)';
    case SaleStatus.INVOICED:  return 'ออกใบแจ้งหนี้แล้ว';
    case SaleStatus.COMPLETED: return 'จัดส่งสำเร็จ (ตัดสต็อก)';
    case SaleStatus.CANCELLED: return 'ยกเลิก';
    default: return status;
  }
};

/**
 * Calculate CTN from quantity and packaging quantity (Rule 14.4)
 * Returns a decimal for logistics accuracy as requested by user.
 */
export const calculateCtn = (quantity: number, packagingQty: number) => {
  if (!packagingQty || packagingQty < 1) return quantity;
  return Number((quantity / packagingQty).toFixed(2));
};
