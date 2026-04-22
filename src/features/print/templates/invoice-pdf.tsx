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
        <Document title={`${data.isTaxInvoice ? 'Tax-Invoice' : 'Invoice'}-${data.docNumber}`}>
            <Page size="A4" style={s.page}>
                <View style={s.header}>
                    <View>
                        <Text style={s.title}>
                            {data.isTaxInvoice ? 'ใบกำกับภาษี / ใบแจ้งหนี้ ' : 'ใบแจ้งหนี้ '}
                        </Text>
                        <Text
                            style={{
                                fontSize: 10,
                                marginTop: 2,
                                lineHeight: 1.6,
                                color: '#374151',
                            }}
                        >
                            {data.isTaxInvoice ? '( TAX INVOICE / INVOICE )' : '( INVOICE )'}
                        </Text>
                    </View>

                    <View style={s.docInfo}>
                        <Text style={s.value}>เลขที่: {data.docNumber || '-'}</Text>
                        <Text style={s.label}>วันที่: {formatDate(data.docDate)}</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <View
                            style={{
                                backgroundColor: '#F9FAFB',
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                marginBottom: 6,
                            }}
                        >
                            <Text style={s.sectionTitle}>ผู้ขาย (Seller)</Text>
                        </View>

                        <Text style={s.value}>{data.seller?.name || '-'}</Text>
                        <Text style={s.label}>{data.seller?.address || '-'}</Text>
                        <Text style={s.label}>โทร: {data.seller?.phone || '-'}</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Text style={s.label}>
                                เลขประจำตัวผู้เสียภาษี: {data.seller?.taxId || '-'}
                            </Text>
                            {data.seller?.branch && (
                                <Text style={s.label}>สาขา: {data.seller.branch}</Text>
                            )}
                        </View>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <View
                            style={{
                                backgroundColor: '#F9FAFB',
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                marginBottom: 6,
                            }}
                        >
                            <Text style={s.sectionTitle}>ลูกค้า (Customer)</Text>
                        </View>

                        <Text style={s.value}>{data.buyer?.name || '-'}</Text>
                        <Text style={s.label}>{data.buyer?.address || '-'}</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Text style={s.label}>
                                เลขประจำตัวผู้เสียภาษี: {data.buyer?.taxId || '-'}
                            </Text>
                            {data.buyer?.branch && (
                                <Text style={s.label}>สาขา: {data.buyer.branch}</Text>
                            )}
                        </View>
                    </View>
                </View>

                <View style={s.table}>
                    <View style={s.tableHeader}>
                        <View style={s.cellNo}>
                            <Text style={s.tableHeaderText}>ลำดับ </Text>
                        </View>
                        <View style={s.cellDescription}>
                            <Text style={s.tableHeaderText}>รายการสินค้า (Description) </Text>
                        </View>
                        <View style={s.cellPrice}>
                            <Text style={s.tableHeaderText}>ราคา/หน่วย </Text>
                        </View>
                        <View style={s.cellQty}>
                            <Text style={s.tableHeaderText}>จำนวน </Text>
                        </View>
                        <View style={s.cellAmount}>
                            <Text style={s.tableHeaderText}>จำนวนเงิน </Text>
                        </View>
                    </View>

                    {data.items.map((item, index) => (
                        <View
                            key={index}
                            style={[s.tableRow, index === data.items.length - 1 ? s.tableRowLast : {}]}
                        >
                            <View style={s.cellNo}>
                                <Text style={s.cellText}>{index + 1}</Text>
                            </View>

                            <View style={s.cellDescription}>
                                <Text style={s.cellTextBold}>{item.name || '-'}</Text>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <Text style={s.cellTextMuted}>{item.sku || '-'}</Text>
                                    {item.taxCode && (
                                        <Text style={[s.cellTextMuted, { fontSize: 7, border: '0.5pt solid #E5E7EB', padding: '1pt 2pt' }]}>
                                            {item.taxCode}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={s.cellPrice}>
                                <Text style={s.cellText}>{formatCurrency(item.unitPrice || 0)}</Text>
                            </View>

                            <View style={s.cellQty}>
                                <Text style={s.cellText}>
                                    {item.quantity || 0} {item.uom || ''}
                                </Text>
                            </View>

                            <View style={s.cellAmount}>
                                <Text style={s.cellText}>{formatCurrency(item.subtotal || 0)}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', marginTop: 20 }}>
                    <View style={{ flex: 1, paddingRight: 20 }}>
                        {data.notes ? (
                            <View>
                                <View
                                    style={{
                                        backgroundColor: '#F9FAFB',
                                        paddingVertical: 4,
                                        paddingHorizontal: 8,
                                        marginBottom: 6,
                                    }}
                                >
                                    <Text style={s.sectionTitle}>หมายเหตุ (Notes)</Text>
                                </View>
                                <Text style={s.label}>{data.notes || ''} </Text>
                            </View>
                        ) : null}

                        <View
                            style={{
                                marginTop: 10,
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                backgroundColor: '#F9FAFB',
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 9,
                                    fontWeight: 500,
                                    lineHeight: 1.8,
                                    color: '#111827',
                                }}
                            >
                                ตัวอักษร: {data.financials?.netText || '-'}
                            </Text>
                        </View>
                    </View>

                    <View style={{ width: 180 }}>
                        <View style={s.summaryItem}>
                            <Text style={s.label}>รวมเงิน (Subtotal)</Text>
                            <Text style={s.value}>
                                {formatCurrency(data.financials?.subtotal || 0)}
                            </Text>
                        </View>

                        {(data.financials?.discount || 0) > 0 ? (
                            <View style={s.summaryItem}>
                                <Text style={s.label}>ส่วนลด (Discount)</Text>
                                <Text style={s.value}>
                                    -{formatCurrency(data.financials?.discount || 0)}
                                </Text>
                            </View>
                        ) : null}

                        {/* T2 Taxable Base row */}
                        <View style={s.summaryItem}>
                            <Text style={s.label}>ฐานภาษี (Taxable Base)</Text>
                            <Text style={s.value}>
                                {formatCurrency(data.financials?.taxableBase || 0)}
                            </Text>
                        </View>

                        <View style={s.summaryItem}>
                            <Text style={s.label}>
                                {data.isTaxInvoice ? `ภาษีมูลค่าเพิ่ม (VAT ${data.taxRate}%)` : 'ภาษีมูลค่าเพิ่ม (VAT)'}
                            </Text>
                            <Text style={s.value}>{formatCurrency(data.financials?.tax || 0)} </Text>
                        </View>

                        <View style={s.totalRow}>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.7,
                                }}
                            >
                                ยอดเงินสุทธิ
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.7,
                                }}
                            >
                                {formatCurrency(data.financials?.net || 0)}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', marginTop: 60 }}>
                    <View
                        style={{
                            flex: 1,
                            textAlign: 'center',
                            borderTopWidth: 0.5,
                            borderTopColor: '#9CA3AF',
                            paddingTop: 10,
                            marginRight: 20,
                        }}
                    >
                        <Text style={s.label}>ผู้รับสินค้า / บรรจุสินค้า</Text>
                        <Text
                            style={{
                                marginTop: 20,
                                lineHeight: 1.8,
                            }}
                        >
                            ......................................................
                        </Text>
                        <Text
                            style={{
                                fontSize: 8,
                                marginTop: 5,
                                lineHeight: 1.6,
                            }}
                        >
                            วันที่ ........./........../..........
                        </Text>
                    </View>

                    <View
                        style={{
                            flex: 1,
                            textAlign: 'center',
                            borderTopWidth: 0.5,
                            borderTopColor: '#9CA3AF',
                            paddingTop: 10,
                            marginLeft: 20,
                        }}
                    >
                        <Text style={s.label}>ผู้ได้รับมอบอำนาจ / ผู้ส่งสินค้า </Text>
                        <Text
                            style={{
                                marginTop: 20,
                                lineHeight: 1.8,
                            }}
                        >
                            ......................................................
                        </Text>
                        <Text
                            style={{
                                fontSize: 8,
                                marginTop: 5,
                                lineHeight: 1.6,
                            }}
                        >
                            วันที่ ........./........../..........
                        </Text>
                    </View>
                </View>

                <View style={s.footer}>
                    <Text style={{ lineHeight: 1.6 }}>
                        ขอบคุณที่ใช้บริการ (Powered by Namfon ERP)
                    </Text>
                </View>
            </Page>
        </Document>
    );
};