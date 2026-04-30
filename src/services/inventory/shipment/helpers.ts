/**
 * shipment.helpers.ts — Shared types and utilities for shipment operations
 */
import { ShipmentStatus, SHIPMENT_STATUS_TRANSITIONS } from '@/types/domain';

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'รอจัดส่ง',
  PROCESSING: 'กำลังแพ็ค',
  SHIPPED: 'ส่งแล้ว',
  DELIVERED: 'ถึงผู้รับแล้ว',
  RETURNED: 'ตีกลับ',
  CANCELLED: 'ยกเลิก',
};

export interface OcrParcel {
  trackingNumber: string;
  shippingProvider: string;
  recipientName: string;
  recipientPhone: string | null;
  province: string | null;
  shippingCost: number | null;
  weight: string | null;
  size: string | null;
}

export interface ParcelMatch {
  parcel: OcrParcel;
  sale: {
    id: string;
    invoiceNumber: string;
    customerName: string | null;
    totalAmount: number;
    customer: { name: string; phone: string | null } | null;
  } | null;
  confidence: 'high' | 'none';
}

export function validateTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(status: ShipmentStatus): ShipmentStatus[] {
  return SHIPMENT_STATUS_TRANSITIONS[status] || [];
}
