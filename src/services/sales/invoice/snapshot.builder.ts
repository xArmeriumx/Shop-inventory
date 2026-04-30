import { Prisma } from '@prisma/client';

export const InvoiceSnapshotBuilder = {
  async build(tx: Prisma.TransactionClient, shopId: string, sale: any) {
    // Load Company Tax Profile (for Seller Snapshot)
    const companyTaxProfile = await (tx as any).companyTaxProfile.findUnique({
      where: { shopId },
    });

    // Load buyer's PartnerTaxProfile for branch info
    const buyerTaxProfile = sale.customerId
      ? await (tx as any).partnerTaxProfile.findUnique({
          where: { customerId: sale.customerId },
        })
      : null;

    // Load shop info for Seller Snapshot fallback
    const shop = await tx.shop.findUnique({
      where: { id: shopId },
      select: { name: true, address: true, taxId: true },
    });

    // BUYER Snapshots
    const customerNameSnapshot = sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป';
    const billingAddressSnapshot = sale.customer?.billingAddress || '-';
    const taxIdSnapshot = sale.customer?.taxId || null;
    const customerBranchSnapshot = buyerTaxProfile?.branchName || null;

    // SELLER Snapshots (Tax Invoice compliance)
    const sellerNameSnapshot = companyTaxProfile?.legalName || shop?.name || '-';
    const sellerAddressSnapshot = companyTaxProfile?.registeredAddress || shop?.address || '-';
    const sellerTaxIdSnapshot = companyTaxProfile?.taxPayerId || shop?.taxId || null;
    const sellerBranchSnapshot = companyTaxProfile?.branchCode
      ? (companyTaxProfile.branchCode === '00000' ? 'สำนักงานใหญ่' : `สาขา ${companyTaxProfile.branchCode}`)
      : null;

    const isTaxInvoice = companyTaxProfile?.isVatRegistered ?? false;

    return {
      customerNameSnapshot,
      billingAddressSnapshot,
      taxIdSnapshot,
      customerBranchSnapshot,
      sellerNameSnapshot,
      sellerAddressSnapshot,
      sellerTaxIdSnapshot,
      sellerBranchSnapshot,
      isTaxInvoice,
    };
  }
};
