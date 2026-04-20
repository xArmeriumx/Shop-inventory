import { notFound } from 'next/navigation';
import { getSupplier } from '@/actions/suppliers';
import { SupplierForm } from '@/components/suppliers/supplier-form';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

export default async function EditSupplierPage({ params }: PageProps) {
    const supplier = await getSupplier(params.id);

    if (!supplier) {
        notFound();
    }

    // Map SerializedSupplier to the thin Supplier interface expected by the form
    const mappedSupplier = {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        taxId: supplier.taxId,
        notes: supplier.notes,
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/suppliers/${params.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <SectionHeader
                    title="แก้ไขผู้จำหน่าย"
                    description={`แก้ไขข้อมูลของ ${supplier.name}`}
                />
            </div>

            <SupplierForm supplier={mappedSupplier} />
        </div>
    );
}
