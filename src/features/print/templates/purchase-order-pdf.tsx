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
                <View style={s.header}>
                    <View>
                        <Text style={s.title}>ใบสั่งซื้อสินค้า </Text>
                        <Text
                            style={{
                                fontSize: 10,
                                marginTop: 2,
                                lineHeight: 1.6,
                                color: '#374151',
                            }}
                        >
                            ( PURCHASE ORDER )
                        </Text>
                    </View>

                    <View style={s.docInfo}>
                        <Text style={s.value}>เลขที่: {data.docNumber}</Text>
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
                            <Text style={s.sectionTitle}>ผู้สั่งซื้อ (Requester)</Text>
                        </View>

                        <Text style={s.value}>{data.requester.name || '-'}</Text>
                        <Text style={s.label}>{data.requester.address || '-'}</Text>
                        <Text style={s.label}>โทร: {data.requester.phone || '-'}</Text>
                        <Text style={s.label}>
                            เลขประจำตัวผู้เสียภาษี: {data.requester.taxId || '-'}
                        </Text>
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
                            <Text style={s.sectionTitle}>ผู้จำหน่าย (Supplier)</Text>
                        </View>

                        <Text style={s.value}>{data.supplier.name || '-'}</Text>
                        <Text style={s.label}>{data.supplier.address || '-'}</Text>
                        <Text style={s.label}>โทร: {data.supplier.phone || '-'}</Text>
                        <Text style={s.label}>
                            เลขประจำตัวผู้เสียภาษี: {data.supplier.taxId || '-'}
                        </Text>
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
                                <Text style={s.cellTextMuted}>{item.sku || '-'}</Text>
                            </View>

                            <View style={s.cellPrice}>
                                <Text style={s.cellText}>{formatCurrency(item.unitPrice)} </Text>
                            </View>

                            <View style={s.cellQty}>
                                <Text style={s.cellText}>
                                    {item.quantity} {item.uom}
                                </Text>
                            </View>

                            <View style={s.cellAmount}>
                                <Text style={s.cellText}>{formatCurrency(item.subtotal)} </Text>
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
                                ตัวอักษร: {data.financials.netText || '-'}
                            </Text>
                        </View>
                    </View>

                    <View style={{ width: 180 }}>
                        <View style={s.summaryItem}>
                            <Text style={s.label}>รวมเงิน (Subtotal)</Text>
                            <Text style={s.value}>{formatCurrency(data.financials.subtotal)} </Text>
                        </View>

                        {data.financials.discount > 0 ? (
                            <View style={s.summaryItem}>
                                <Text style={s.label}>ส่วนลด (Discount)</Text>
                                <Text style={s.value}>-{formatCurrency(data.financials.discount)} </Text>
                            </View>
                        ) : null}

                        <View style={s.summaryItem}>
                            <Text style={s.label}>ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
                            <Text style={s.value}>{formatCurrency(data.financials.tax)} </Text>
                        </View>

                        <View style={s.totalRow}>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.7,
                                }}
                            >
                                รวมยอดเงินสุทธิ
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.7,
                                }}
                            >
                                {formatCurrency(data.financials.net)}
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
                        <Text style={s.label}>ผู้เสนอซื้อ / จัดซื้อ</Text>
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
                        <Text style={s.label}>ผู้มีอำนาจลงนาม / อนุมัติ</Text>
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
                        ขอบคุณที่ร่วมเป็นพันธมิตรทางธุรกิจ (Powered by Namfon ERP)
                    </Text>
                </View>
            </Page>
        </Document>
    );
};