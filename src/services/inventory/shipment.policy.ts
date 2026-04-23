import { AuditPolicy } from '@/services/core/audit.service';

/**
 * ERP Audit Policies for Shipment & Logistics
 */
export const SHIPMENT_AUDIT_POLICIES = {
  CREATE: (shipmentNumber: string): AuditPolicy => ({
    action: 'SHIPMENT_CREATE',
    targetType: 'Shipment',
    note: `สร้างรายการจัดส่งใหม่: ${shipmentNumber}`,
    afterSnapshot: (data: any) => ({
      id: data.id,
      shipmentNumber: data.shipmentNumber,
      recipientName: data.recipientName,
      status: data.status,
    })
  }),

  UPDATE_STATUS: (shipmentNumber: string, status: string): AuditPolicy => ({
    action: 'SHIPMENT_STATUS_UPDATE',
    targetType: 'Shipment',
    note: `อัปเดตสถานะการจัดส่ง ${shipmentNumber} เป็น ${status}`,
    afterSnapshot: (data: any) => ({
      shipmentNumber,
      newStatus: status,
      syncApplied: !!data.syncApplied,
    })
  }),

  CANCEL: (shipmentNumber: string, reason?: string): AuditPolicy => ({
    action: 'SHIPMENT_CANCEL',
    targetType: 'Shipment',
    note: `ยกเลิกรายการจัดส่ง ${shipmentNumber}${reason ? `: ${reason}` : ''}`,
  }),

  ROUTE_PROCESSED: (type: string, count: number): AuditPolicy => ({
    action: 'SHIPMENT_ROUTE_PROCESS',
    targetType: 'Shipment',
    note: `คำนวณเส้นทางจัดส่ง (${type}) สำหรับ ${count} รายการ`,
  })
};
