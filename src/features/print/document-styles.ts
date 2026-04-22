import { Font, StyleSheet } from '@react-pdf/renderer';

// Register Sarabun Thai Font (Professional ERP Standard)
// We use public Google Fonts URLs to avoid local asset complexity
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
        padding: 30,
        fontFamily: 'Sarabun',
        fontSize: 10,
        lineHeight: 1.2,
        color: '#1F2937',
        backgroundColor: '#FFFFFF',
    },
    header: {
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    docInfo: {
        textAlign: 'right',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 6,
        lineHeight: 1.4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    column: {
        flex: 1,
    },
    label: {
        fontSize: 9,
        color: '#6B7280',
        marginTop: 2,
        lineHeight: 1.4,
    },
    value: {
        fontSize: 10,
        fontWeight: 'medium',
        color: '#111827',
        lineHeight: 1.4,
    },
    // Table Styles
    table: {
        marginTop: 10,
        borderWidth: 0.5,
        borderColor: '#E5E7EB',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
        fontWeight: 'bold',
        padding: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.2,
        borderBottomColor: '#F3F4F6',
        padding: 6,
    },
    cell: {
        flex: 1,
    },
    cellRight: {
        flex: 0.5,
        textAlign: 'right',
    },
    cellCenter: {
        flex: 0.3,
        textAlign: 'center',
    },
    // Summary Styles
    summaryContainer: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    summaryBox: {
        width: '40%',
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
        lineHeight: 1.4,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#000000',
        fontWeight: 'bold',
        fontSize: 12,
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#9CA3AF',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    }
});
