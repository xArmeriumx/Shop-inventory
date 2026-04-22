import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { documentStyles } from '../document-styles';
import { formatCurrency, formatDate } from '@/lib/formatters';

const styles = StyleSheet.create({
    ...documentStyles,
    certTitle: {
        fontSize: 16,
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: 4,
    },
    certSubTitle: {
        fontSize: 10,
        textAlign: 'center',
        marginBottom: 12,
    },
    infoBox: {
        borderWidth: 1,
        borderColor: '#000',
        padding: 8,
        marginBottom: 10,
    },
    boxTitle: {
        fontSize: 10,
        fontWeight: 700,
        marginBottom: 4,
        backgroundColor: '#eee',
        padding: 2,
    },
    gridRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderColor: '#ccc',
        minHeight: 24,
        alignItems: 'center',
    },
    gridHeader: {
        backgroundColor: '#f3f4f6',
        fontWeight: 700,
    },
    col1: { width: '40%', paddingLeft: 4 },
    col2: { width: '20%', textAlign: 'right', paddingRight: 4 },
    col3: { width: '15%', textAlign: 'right', paddingRight: 4 },
    col4: { width: '25%', textAlign: 'right', paddingRight: 4 },
});

interface WhtCertificatePDFProps {
    data: {
        shop: any;
        payee: any;
        entry: any;
        certificate: any;
    };
}

export const WhtCertificatePDF: React.FC<WhtCertificatePDFProps> = ({ data }) => {
    const { shop, payee, entry, certificate } = data;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={styles.certTitle}>หนังสือรับรองการหักภาษี ณ ที่จ่าย</Text>
                    <Text style={styles.certSubTitle}>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</Text>
                    <View style={{ position: 'absolute', right: 0, top: 0 }}>
                        <Text style={styles.docInfoLabel}>เลขที่เล่ม: {certificate?.certNumber?.split('-')[1] || '-'}</Text>
                        <Text style={styles.docInfoLabel}>เลขที่: {certificate?.certNumber?.split('-')[2] || '-'}</Text>
                    </View>
                </View>

                {/* Part 1: Payor */}
                <View style={styles.infoBox}>
                    <Text style={styles.boxTitle}>1. ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (Payor)</Text>
                    <Text style={styles.valueBold}>{shop.name}</Text>
                    <Text style={styles.label}>เลขประจำตัวผู้เสียภาษีอากร: {shop.taxId || '-'}</Text>
                    <Text style={styles.label}>ที่อยู่: {shop.address || '-'}</Text>
                </View>

                {/* Part 2: Payee */}
                <View style={styles.infoBox}>
                    <Text style={styles.boxTitle}>2. ผู้ถูกหักภาษี ณ ที่จ่าย (Payee)</Text>
                    <Text style={styles.valueBold}>{entry.payeeNameSnapshot}</Text>
                    <Text style={styles.label}>เลขประจำตัวผู้เสียภาษีอากร: {entry.payeeTaxIdSnapshot || '-'}</Text>
                    <Text style={styles.label}>ที่อยู่: {payee?.address || '-'}</Text>
                </View>

                {/* Part 3: Form Type */}
                <View style={{ flexDirection: 'row', marginBottom: 10, columnGap: 20 }}>
                    <Text style={styles.label}>แบบที่นำส่ง:</Text>
                    <Text style={styles.valueBold}>[ {entry.formTypeSnapshot === 'PND3' ? 'X' : '  '} ] ภ.ง.ด.3</Text>
                    <Text style={styles.valueBold}>[ {entry.formTypeSnapshot === 'PND53' ? 'X' : '  '} ] ภ.ง.ด.53</Text>
                </View>

                {/* Part 4: Tax Details Grid */}
                <View style={{ borderWidth: 1, borderColor: '#000' }}>
                    <View style={[styles.gridRow, styles.gridHeader]}>
                        <Text style={styles.col1}>ประเภทเงินได้</Text>
                        <Text style={styles.col2}>วัน เดือน ปี ที่จ่าย</Text>
                        <Text style={styles.col3}>จำนวนเงินที่จ่าย</Text>
                        <Text style={styles.col4}>ภาษีที่หักและนำส่ง</Text>
                    </View>
                    <View style={styles.gridRow}>
                        <Text style={styles.col1}>{entry.incomeCategorySnapshot || 'ค่าบริการ'}</Text>
                        <Text style={styles.col2}>{formatDate(entry.paymentDate)}</Text>
                        <Text style={styles.col3}>{formatCurrency(entry.grossPayableAmount)}</Text>
                        <Text style={styles.col4}>{formatCurrency(entry.whtAmount)}</Text>
                    </View>
                    {/* Totals */}
                    <View style={[styles.gridRow, { borderBottomWidth: 0, fontWeight: 700 }]}>
                        <Text style={[styles.col1, { textAlign: 'right' }]}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</Text>
                        <Text style={styles.col2}></Text>
                        <Text style={styles.col3}>{formatCurrency(entry.grossPayableAmount)}</Text>
                        <Text style={styles.col4}>{formatCurrency(entry.whtAmount)}</Text>
                    </View>
                </View>

                <View style={{ marginTop: 10, padding: 5, backgroundColor: '#f9fafb' }}>
                    <Text style={styles.valueBold}>ตัวอักษร: ({entry.whtAmountText || '-'})</Text>
                </View>

                {/* Footer / Signature */}
                <View style={{ marginTop: 40, alignItems: 'center', width: '100%' }}>
                    <View style={{ width: '50%', textAlign: 'center' }}>
                        <View style={{ borderBottomWidth: 1, borderColor: '#000', marginBottom: 5 }} />
                        <Text style={styles.label}>ลงชื่อ...........................................................ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</Text>
                        <Text style={styles.label}>( {shop.authorizedPerson || '...........................................................'} )</Text>
                        <Text style={styles.label}>ตำแหน่ง {shop.authorizedPosition || '...........................................................'}</Text>
                        <Text style={styles.label}>วันที่ {formatDate(certificate.issuedDate)}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text>หนังสือรับรองนี้สร้างขึ้นโดยระบบ Namfon ERP - Thai Statutory Compliance</Text>
                </View>
            </Page>
        </Document>
    );
};
