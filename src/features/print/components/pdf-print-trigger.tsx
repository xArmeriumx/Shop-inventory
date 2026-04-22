'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
// Do NOT import templates here at top level to avoid ESM/SSR build issues

// Dynamically import the PDF components to avoid SSR/Initial load weight
const PDFDownloadLink = dynamic(
    () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
    { ssr: false, loading: () => <Button disabled variant="outline" size="sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> กำลังเตรียม...</Button> }
);

interface PdfPrintTriggerProps {
    type: 'INVOICE' | 'PURCHASE' | 'WHT_CERTIFICATE';
    documentData: any;
    fileName?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'link' | 'secondary' | 'destructive';
    className?: string;
    label?: string;
}

/**
 * A client-side trigger that dynamically loads and generates PDFs.
 * This avoids bundling the heavy @react-pdf/renderer on every page load.
 */
export function PdfPrintTrigger({
    type,
    documentData,
    fileName = 'document.pdf',
    variant = 'outline',
    className,
    label
}: PdfPrintTriggerProps) {
    const [isClient, setIsClient] = React.useState(false);
    const [importError, setImportError] = React.useState<string | null>(null);
    const [templates, setTemplates] = React.useState<any>(null);

    React.useEffect(() => {
        setIsClient(true);

        // Lazy load templates ONLY on client to avoid ESM build issues on server
        Promise.all([
            import('../templates/invoice-pdf'),
            import('../templates/purchase-order-pdf'),
            import('../templates/wht-certificate-pdf')
        ]).then(([inv, pur, wht]) => {
            setTemplates({
                InvoicePDF: inv.InvoicePDF,
                PurchaseOrderPDF: pur.PurchaseOrderPDF,
                WhtCertificatePDF: wht.WhtCertificatePDF
            });
        }).catch(err => {
            console.error('Failed to load PDF templates:', err);
            setImportError('ไม่สามารถโหลด Template ได้');
        });
    }, []);

    if (!isClient) return null;

    if (importError) {
        return (
            <Button variant="destructive" size="sm" className={className} disabled>
                <FileText className="h-4 w-4 mr-2" /> {importError}
            </Button>
        );
    }

    if (!templates) {
        return (
            <Button variant={variant} className={className} disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> {label || 'เตรียม PDF...'}
            </Button>
        );
    }

    const { InvoicePDF, PurchaseOrderPDF, WhtCertificatePDF } = templates;

    return (
        <PDFDownloadLink
            document={
                type === 'INVOICE' ? (
                    <InvoicePDF data={documentData} />
                ) : type === 'PURCHASE' ? (
                    <PurchaseOrderPDF data={documentData} />
                ) : (
                    <WhtCertificatePDF data={documentData} />
                )
            }
            fileName={fileName}
        >
            {({ loading, error, blob, url }: any) => {
                if (error) {
                    console.error('PDF Generation Error:', error);
                    return (
                        <Button variant="destructive" size="sm" className={className}>
                            <FileText className="h-4 w-4 mr-2" /> ดาวน์โหลดไม่สำเร็จ
                        </Button>
                    );
                }

                return (
                    <Button variant={variant} className={className} disabled={loading}>
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Download className="h-4 w-4 mr-2" />
                        )}
                        {loading ? 'กำลังสร้าง...' : (label || 'ดาวน์โหลด PDF')}
                    </Button>
                );
            }}
        </PDFDownloadLink>
    );
}
