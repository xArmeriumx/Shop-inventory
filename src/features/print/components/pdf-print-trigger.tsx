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
    type: 'INVOICE' | 'PURCHASE';
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
    const [templates, setTemplates] = React.useState<any>(null);

    React.useEffect(() => {
        setIsClient(true);

        // Lazy load templates ONLY on client to avoid ESM build issues on server
        Promise.all([
            import('../templates/invoice-pdf'),
            import('../templates/purchase-order-pdf')
        ]).then(([inv, pur]) => {
            setTemplates({
                InvoicePDF: inv.InvoicePDF,
                PurchaseOrderPDF: pur.PurchaseOrderPDF
            });
        }).catch(err => {
            console.error('Failed to load PDF templates:', err);
        });
    }, []);

    if (!isClient || !templates) {
        return (
            <Button variant={variant} className={className} disabled>
                <FileText className="h-4 w-4 mr-2" /> {label || 'เตรียม PDF...'}
            </Button>
        );
    }

    const { InvoicePDF, PurchaseOrderPDF } = templates;

    return (
        <PDFDownloadLink
            document={
                type === 'INVOICE' ? (
                    <InvoicePDF data={documentData} />
                ) : (
                    <PurchaseOrderPDF data={documentData} />
                )
            }
            fileName={fileName}
        >
            {({ loading }: { loading: boolean }) => (
                <Button variant={variant} className={className} disabled={loading}>
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    {loading ? 'กำลังสร้าง...' : (label || 'ดาวน์โหลด PDF')}
                </Button>
            )}
        </PDFDownloadLink>
    );
}
