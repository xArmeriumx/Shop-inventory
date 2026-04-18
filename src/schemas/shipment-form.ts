/**
 * Shipment Form Schema
 * 
 * Client-side validation for react-hook-form.
 * Normalization (phone stripping) happens in the backend shipmentSchema.
 */
import { z } from 'zod';

export const shipmentFormSchema = z.object({
    saleId: z.string().min(1, 'กรุณาเลือกรายการขาย'),
    recipientName: z.string().min(1, 'กรุณากรอกชื่อผู้รับ').max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร'),
    recipientPhone: z.string().max(10).optional().nullable(),
    shippingAddress: z.string().min(1, 'กรุณากรอกที่อยู่จัดส่ง'),
    customerAddressId: z.string().optional().nullable(),
    trackingNumber: z.string().max(100, 'หมายเลข Tracking ต้องไม่เกิน 100 ตัวอักษร').optional().nullable(),
    shippingProvider: z.string().max(100, 'บริษัทขนส่งต้องไม่เกิน 100 ตัวอักษร').optional().nullable(),
    shippingCost: z.coerce.number().min(0, 'ค่าส่งต้องไม่ติดลบ').optional().nullable(),
    notes: z.string().optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

export function getShipmentFormDefaults(shipment?: any): ShipmentFormValues {
    return {
        saleId: shipment?.saleId ?? '',
        recipientName: shipment?.recipientName ?? '',
        recipientPhone: shipment?.recipientPhone ?? '',
        shippingAddress: shipment?.shippingAddress ?? '',
        customerAddressId: shipment?.customerAddressId ?? null,
        trackingNumber: shipment?.trackingNumber ?? '',
        shippingProvider: shipment?.shippingProvider ?? '',
        shippingCost: shipment?.shippingCost ?? null,
        notes: shipment?.notes ?? '',
        latitude: shipment?.latitude ?? null,
        longitude: shipment?.longitude ?? null,
    };
}
