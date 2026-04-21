import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import { documentStyles as s } from '../document-styles';
import { PurchasePrintDTO } from '../builders/purchase-order-print.builder';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface PurchaseOrderPDFProps {
    data: PurchasePrintDTO;
}

export const PurchaseOrderPDF: React.FC<PurchaseOrderPDFProps> = ({ data }) => {
    return (
        <Document title={`PO-${data.docNumber}`}>
            <Page size="A4" style={s.page}>
                {/* Header Segment */}
                <View style={s.header}>
                    <View>
                        <Text style={s.title}>ใบสั่งซื้อสินค้า</Text>
                        <Text style={{ fontSize: 10, marginTop: 4 }}>( PURCHASE ORDER )</Text>
                    </View>
                    <View style={s.docInfo}>
                        <Text style={s.value}>เลขที่: {data.docNumber}</Text>
                        <Text style={s.label}>วันที่: {formatDate(data.docDate)}</Text>
                    </View>
                </View>

                {/* Parties Segment */}
                <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>ผู้สั่งซื้อ (Requester)</Text>
                        <Text style={s.value}>{data.requester.name}</Text>
                        <Text style={s.label}>{data.requester.address}</Text>
                        <Text style={s.label}>โทร: {data.requester.phone}</Text>
                        <Text style={s.label}>เลขประจำตัวผู้เสียภาษี: {data.requester.taxId}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.sectionTitle}>ผู้จำหน่าย (Supplier)</Text>
                        <Text style={s.value}>{data.supplier.name}</Text>
                        <Text style={s.label}>{data.supplier.address}</Text>
                        <Text style={s.label}>โทร: {data.supplier.phone}</Text>
                        <Text style={s.label}>เลขประจำตัวผู้เสียภาษี: {data.supplier.taxId || '-'}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <Text style={{ width: '5%', textAlign: 'center' }}>ลำดับ</Text>
                        <Text style={{ width: '50%' }}>รายการสินค้า (Description)</Text>
                        <Text style={{ width: '15%', textAlign: 'right' }}>ราคา/หน่วย</Text>
                        <Text style={{ width: '10%', textAlign: 'center' }}>จำนวน</Text>
                        <Text style={{ width: '20%', textAlign: 'right' }}>จำนวนเงิน</Text>
                    </View>
                    {data.items.map((item, index) => (
                        <View key={index} style={s.tableRow}>
                            <Text style={{ width: '5%', textAlign: 'center' }}>{index + 1}</Text>
                            <View style={{ width: '50%' }}>
                                <Text style={s.value}>{item.name}</Text>
                                <Text style={{ fontSize: 8, color: '#666' }}>{item.sku}</Text>
                            </View>
                            <Text style={{ width: '15%', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</Text>
                            <Text style={{ width: '10%', textAlign: 'center' }}>{item.quantity} {item.uom}</Text>
                            <Text style={{ width: '20%', textAlign: 'right' }}>{formatCurrency(item.subtotal)}</Text>
                        </View>
                    ))}
                </View>

                {/* Financial Summary */}
                <View style={{ flexDirection: 'row', marginTop: 20 }}>
                    <View style={{ flex: 1, paddingRight: 20 }}>
                        {data.notes && (
                            <>
                                <Text style={s.sectionTitle}>หมายเหตุ (Notes)</Text>
                                <Text style={s.label}>{data.notes}</Text>
                            </>
                        )}
                        <View style={{ marginTop: 10, padding: 8, backgroundColor: '#F9FAFB' }}>
                            <Text style={{ fontSize: 9, fontWeight: 'medium' }}>ตัวอักษร: {data.financials.netText}</Text>
                        </View>
                    </View>
                    <View style={{ width: 180 }}>
                        <View style={s.summaryItem}>
                            <Text style={s.label}>รวมเงิน (Subtotal)</Text>
                            <Text style={s.value}>{formatCurrency(data.financials.subtotal)}</Text>
                        </View>
                        {data.financials.discount > 0 && (
                            <View style={s.summaryItem}>
                                <Text style={s.label}>ส่วนลด (Discount)</Text>
                                <Text style={s.value}>-{formatCurrency(data.financials.discount)}</Text>
                            </View>
                        )}
                        <View style={s.summaryItem}>
                            <Text style={s.label}>ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
                            <Text style={s.value}>{formatCurrency(data.financials.tax)}</Text>
                        </View>
                        <View style={s.totalRow}>
                            <Text>รวมยอดเงินสุทธิ</Text>
                            <Text>{formatCurrency(data.financials.net)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer Signature */}
                <View style={{ flexDirection: 'row', marginTop: 60, gap: 40 }}>
                    <View style={{ flex: 1, textAlign: 'center', borderTopWidth: 0.5, paddingTop: 10 }}>
                        <Text style={s.label}>ผู้เสนอซื้อ / จัดซื้อ</Text>
                        <Text style={{ marginTop: 20 }}>......................................................</Text>
                        <Text style={{ fontSize: 8, marginTop: 5 }}>วันที่ ........./........../..........</Text>
                    </View>
                    <View style={{ flex: 1, textAlign: 'center', borderTopWidth: 0.5, paddingTop: 10 }}>
                        <Text style={s.label}>ผู้มีอำนาจลงนาม / อนุมัติ</Text>
                        <Text style={{ marginTop: 20 }}>......................................................</Text>
                        <Text style={{ fontSize: 8, marginTop: 5 }}>วันที่ ........./........../..........</Text>
                    </View>
                </View>

                <View style={s.footer}>
                    <Text>ขอบคุณที่ร่วมเป็นพันธมิตรทางธุรกิจ (Powered by Namfon ERP)</Text>
                </View>
            </Page>
        </Document>
    );
};
