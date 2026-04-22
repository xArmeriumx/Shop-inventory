import { Font, StyleSheet } from '@react-pdf/renderer';

// Register Sarabun Thai Font (Professional ERP Standard)
// We use public Google Fonts URLs to avoid local asset complexity
Font.register({
    family: 'Sarabun',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/sarabun/v13/dtpT24GPrE_9u7At8SAtbX7Ut-xU.ttf', fontWeight: 'normal' },
        { src: 'https://fonts.gstatic.com/s/sarabun/v13/dtpT24GPrE_9u7At8SAtfX7Ut-xU.ttf', fontWeight: 'medium' },
        { src: 'https://fonts.gstatic.com/s/sarabun/v13/dtpT24GPrE_9u7At8SAtan7Ut-xU.ttf', fontWeight: 'bold' },
    ],
});

export const documentStyles = StyleSheet.create({
    page: {
        fontFamily: 'Sarabun',
        fontSize: 10,
        padding: 40,
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
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        backgroundColor: '#F3F4F6',
        padding: 4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    column: {
        flex: 1,
    },
    label: {
        color: '#6B7280',
        marginBottom: 2,
    },
    value: {
        fontWeight: 'medium',
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
        marginBottom: 4,
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
