import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import { documentStyles as s } from '../document-styles';
import { InvoicePrintSnapshotDTO } from '../builders/invoice-print.builder';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface InvoicePDFProps {
    data: InvoicePrintSnapshotDTO;
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({ data }) => {
    return (
        <Document title={`Invoice-${data.docNumber}`}>
            <Page size="A4" style={s.page}>
                {/* Header Segment */}
                <View style={s.header}>
                    <View>
                        <Text style={s.title}>ใบกำกับภาษี / ใบแจ้งหนี้</Text>
                        <Text style={{ fontSize: 10, marginTop: 4 }}>( TAX INVOICE / INVOICE )</Text>
                    </View>
                    <View style={s.docInfo}>
                        <Text style={s.value}>เลขที่: {data.docNumber}</Text>
                        <Text style={s.label}>วันที่: {formatDate(data.docDate)}</Text>
                    </View>
                </View>

                {/* Parties Segment */}
                {/* Parties Segment */}
                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={s.sectionTitle}>ผู้ขาย (Seller)</Text>
                        <Text style={s.value}>{data.seller.name}</Text>
                        <Text style={s.label}>{data.seller.address}</Text>
                        <Text style={s.label}>โทร: {data.seller.phone}</Text>
                        <Text style={s.label}>เลขประจำตัวผู้เสียภาษี: {data.seller.taxId}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.sectionTitle}>ลูกค้า (Customer)</Text>
                        <Text style={s.value}>{data.buyer.name}</Text>
                        <Text style={s.label}>{data.buyer.address}</Text>
                        <Text style={s.label}>เลขประจำตัวผู้เสียภาษี: {data.buyer.taxId || '-'}</Text>
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
                            <Text>ยอดเงินสุทธิ</Text>
                            <Text>{formatCurrency(data.financials.net)}</Text>
                        </View>
                    </View>
                </View>

                {/* Footer Signature */}
                <View style={{ flexDirection: 'row', marginTop: 60 }}>
                    <View style={{ flex: 1, textAlign: 'center', borderTopWidth: 0.5, paddingTop: 10, marginRight: 20 }}>
                        <Text style={s.label}>ผู้รับสินค้า / บรรจุสินค้า</Text>
                        <Text style={{ marginTop: 20 }}>......................................................</Text>
                        <Text style={{ fontSize: 8, marginTop: 5 }}>วันที่ ........./........../..........</Text>
                    </View>
                    <View style={{ flex: 1, textAlign: 'center', borderTopWidth: 0.5, paddingTop: 10, marginLeft: 20 }}>
                        <Text style={s.label}>ผู้ได้รับมอบอำนาจ / ผู้ส่งสินค้า</Text>
                        <Text style={{ marginTop: 20 }}>......................................................</Text>
                        <Text style={{ fontSize: 8, marginTop: 5 }}>วันที่ ........./........../..........</Text>
                    </View>
                </View>

                <View style={s.footer}>
                    <Text>ขอบคุณที่ใช้บริการ (Powered by Namfon ERP)</Text>
                </View>
            </Page>
        </Document>
    );
};
