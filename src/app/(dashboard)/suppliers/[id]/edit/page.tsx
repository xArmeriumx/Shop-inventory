import { notFound } from 'next/navigation';
import { getSupplier } from '@/actions/purchases/suppliers.actions';
import { SupplierForm } from '@/components/purchases/suppliers/supplier-form';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
    params: { id: string };
}

export default async function EditSupplierPage({ params }: PageProps) {
    const result = await getSupplier(params.id);

    if (!result.success || !result.data) {
        notFound();
    }

    const supplier = result.data;

    // Map SerializedSupplier to the thin Supplier interface expected by the form
    const mappedSupplier = {
        id: (supplier as any).id,
        name: (supplier as any).name,
        code: (supplier as any).code,
        contactName: (supplier as any).contactName,
        phone: (supplier as any).phone,
        email: (supplier as any).email,
        address: (supplier as any).address,
        taxId: (supplier as any).taxId,
        notes: (supplier as any).notes,
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
                    description={`แก้ไขข้อมูลของ ${(supplier as any).name}`}
                />
            </div>

            <SupplierForm supplier={mappedSupplier} />
        </div>
    );
}
