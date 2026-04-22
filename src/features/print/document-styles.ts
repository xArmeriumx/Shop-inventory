import { Font, StyleSheet } from '@react-pdf/renderer';

Font.register({
    family: 'Sarabun',
    fonts: [
        { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 400 },
        { src: '/fonts/Sarabun-Medium.ttf', fontWeight: 500 },
        { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 700 },
    ],
});

export const documentStyles = StyleSheet.create({
    page: {
        paddingTop: 32,
        paddingRight: 30,
        paddingBottom: 36,
        paddingLeft: 30,
        fontFamily: 'Sarabun',
        fontSize: 10,
        lineHeight: 1.8,
        color: '#1F2937',
        backgroundColor: '#FFFFFF',
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#111827',
        paddingBottom: 14,
        marginBottom: 22,
    },

    titleBlock: {
        flexDirection: 'column',
    },

    title: {
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.35,
        paddingTop: 2,
        paddingBottom: 2,
        color: '#0F172A',
    },

    titleSub: {
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 1.55,
        color: '#334155',
        marginTop: -2,
    },

    docInfo: {
        textAlign: 'right',
        justifyContent: 'flex-start',
    },

    docInfoLabel: {
        fontSize: 10,
        color: '#475569',
        lineHeight: 1.7,
    },

    docInfoValue: {
        fontSize: 11,
        fontWeight: 700,
        color: '#111827',
        lineHeight: 1.7,
    },

    section: {
        marginBottom: 16,
    },

    sectionRow: {
        flexDirection: 'row',
        columnGap: 16,
    },

    sectionCol: {
        flex: 1,
    },

    sectionTitleBox: {
        backgroundColor: '#F8FAFC',
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 6,
    },

    sectionTitle: {
        fontSize: 10,
        fontWeight: 700,
        color: '#374151',
        lineHeight: 1.7,
        paddingTop: 1,
        paddingBottom: 1,
    },

    label: {
        fontSize: 9,
        color: '#6B7280',
        lineHeight: 1.75,
        paddingTop: 1,
        paddingBottom: 1,
    },

    value: {
        fontSize: 10,
        fontWeight: 500,
        color: '#111827',
        lineHeight: 1.8,
        paddingTop: 1,
        paddingBottom: 1,
    },

    valueBold: {
        fontSize: 10,
        fontWeight: 700,
        color: '#111827',
        lineHeight: 1.8,
        paddingTop: 1,
        paddingBottom: 1,
    },

    muted: {
        fontSize: 9,
        color: '#64748B',
        lineHeight: 1.75,
    },

    table: {
        width: '100%',
        marginTop: 10,
        borderWidth: 0.5,
        borderColor: '#D1D5DB',
    },

    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 0.75,
        borderBottomColor: '#D1D5DB',
        paddingVertical: 8,
        paddingHorizontal: 8,
        alignItems: 'flex-start',
    },

    tableHeaderText: {
        fontSize: 10,
        fontWeight: 700,
        color: '#0F172A',
        lineHeight: 1.7,
        paddingTop: 1,
        paddingBottom: 1,
    },

    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
        paddingHorizontal: 8,
        alignItems: 'flex-start',
    },

    tableRowLast: {
        borderBottomWidth: 0,
    },

    cellNo: {
        width: '6%',
        paddingRight: 6,
    },

    cellDescription: {
        width: '50%',
        paddingRight: 8,
    },

    cellPrice: {
        width: '16%',
        textAlign: 'right',
        paddingRight: 8,
    },

    cellQty: {
        width: '12%',
        textAlign: 'center',
        paddingRight: 8,
    },

    cellAmount: {
        width: '16%',
        textAlign: 'right',
    },

    cellText: {
        fontSize: 10,
        color: '#111827',
        lineHeight: 1.8,
        paddingTop: 1,
        paddingBottom: 1,
    },

    cellTextBold: {
        fontSize: 10,
        fontWeight: 700,
        color: '#111827',
        lineHeight: 1.8,
        paddingTop: 1,
        paddingBottom: 1,
    },

    cellTextMuted: {
        fontSize: 9,
        color: '#64748B',
        lineHeight: 1.75,
        marginTop: 2,
    },

    summaryContainer: {
        marginTop: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },

    amountTextBox: {
        width: '63%',
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },

    amountTextLabel: {
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.8,
        color: '#111827',
    },

    summaryBox: {
        width: '32%',
    },

    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingTop: 1,
        paddingBottom: 1,
    },

    summaryLabel: {
        fontSize: 10,
        color: '#64748B',
        lineHeight: 1.75,
        width: '68%',
    },

    summaryValue: {
        fontSize: 10,
        color: '#111827',
        fontWeight: 500,
        lineHeight: 1.75,
        width: '32%',
        textAlign: 'right',
    },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#111827',
    },

    totalLabel: {
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.7,
        color: '#111827',
    },

    totalValue: {
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.7,
        color: '#111827',
        textAlign: 'right',
    },

    signatureSection: {
        marginTop: 90,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    signatureBox: {
        width: '44%',
        alignItems: 'center',
    },

    signatureLine: {
        width: '100%',
        borderTopWidth: 0.75,
        borderTopColor: '#374151',
        marginBottom: 10,
    },

    signatureText: {
        fontSize: 10,
        color: '#6B7280',
        lineHeight: 1.75,
        textAlign: 'center',
    },

    signatureNameLine: {
        marginTop: 34,
        fontSize: 10,
        lineHeight: 1.75,
        textAlign: 'center',
    },

    footer: {
        position: 'absolute',
        bottom: 18,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
        color: '#94A3B8',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
        paddingTop: 8,
        lineHeight: 1.6,
    },
});