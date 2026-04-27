import React from 'react';
import { Page, Text, View, Document } from '@react-pdf/renderer';
import { documentStyles as s } from '../document-styles';
import { PurchaseReceiptPrintDTO } from '../builders/purchase-receipt-print.builder';
import { formatDate } from '@/lib/formatters';

interface PurchaseReceiptPDFProps {
  data: PurchaseReceiptPrintDTO;
}

export const PurchaseReceiptPDF: React.FC<PurchaseReceiptPDFProps> = ({ data }) => {
  return (
    <Document title={`GRN-${data.docNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>ใบรับสินค้า</Text>
            <Text
              style={{
                fontSize: 10,
                marginTop: 2,
                lineHeight: 1.6,
                color: '#374151',
              }}
            >
              ( GOODS RECEIPT NOTE )
            </Text>
          </View>

          <View style={s.docInfo}>
            <Text style={s.value}>เลขที่: {data.docNumber}</Text>
            <Text style={s.label}>วันที่รับ: {formatDate(data.docDate)}</Text>
            <Text style={s.label}>อ้างอิง PO: {data.poNumber}</Text>
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
              <Text style={s.sectionTitle}>ผู้รับสินค้า (Requester)</Text>
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
            <View style={{ ...s.cellNo }}>
              <Text style={s.tableHeaderText}>ลำดับ</Text>
            </View>
            <View style={{ ...s.cellDescription, flex: 3 }}>
              <Text style={s.tableHeaderText}>รายการสินค้า (Description)</Text>
            </View>
            <View style={{ ...s.cellQty, flex: 1 }}>
              <Text style={s.tableHeaderText}>จำนวนรับ</Text>
            </View>
            <View style={{ ...s.cellQty, flex: 1.5 }}>
              <Text style={s.tableHeaderText}>คลังสินค้า</Text>
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

              <View style={{ ...s.cellDescription, flex: 3 }}>
                <Text style={s.cellTextBold}>{item.name || '-'}</Text>
                <Text style={s.cellTextMuted}>SKU: {item.sku || '-'}</Text>
              </View>

              <View style={{ ...s.cellQty, flex: 1 }}>
                <Text style={s.cellText}>
                  {item.quantity} {item.uom}
                </Text>
              </View>

              <View style={{ ...s.cellQty, flex: 1.5 }}>
                <Text style={s.cellText}>{item.warehouse}</Text>
              </View>
            </View>
          ))}
        </View>

        {data.notes ? (
          <View style={{ marginTop: 20 }}>
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
            <Text style={s.label}>{data.notes}</Text>
          </View>
        ) : null}

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
            <Text style={s.label}>ผู้ตรวจสอบ / ผู้รับของ</Text>
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
