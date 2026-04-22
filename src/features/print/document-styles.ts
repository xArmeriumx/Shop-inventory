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
        lineHeight: 1.6,
        color: '#1F2937',
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 15,
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        paddingTop: 4, // Clearance for Thai marks at the top
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
        lineHeight: 1.6,
        backgroundColor: '#F9FAFB',
        padding: '4 8',
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
        lineHeight: 1.6,
        paddingTop: 1,
    },
    value: {
        fontSize: 10,
        fontWeight: 'medium',
        color: '#111827',
        lineHeight: 1.6,
        paddingTop: 1,
    },
    // Table Styles
    table: {
        width: '100%',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#9CA3AF',
        backgroundColor: '#F9FAFB',
        paddingVertical: 6,
        paddingHorizontal: 4,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
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
        marginTop: 6,
        lineHeight: 1.6,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#1F2937',
        fontSize: 12,
        fontWeight: 'bold',
        lineHeight: 1.6,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 8,
        color: '#9CA3AF',
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
    }
});
