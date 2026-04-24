import { z } from "zod";
// import { WhtPayeeType, WhtFormType, TaxPostingStatus } from "@prisma/client";
const WhtPayeeType = { INDIVIDUAL: "INDIVIDUAL", CORPORATE: "CORPORATE", UNKNOWN: "UNKNOWN", ANY: "ANY" } as any;
const WhtFormType = { PND3: "PND3", PND53: "PND53" } as any;
const TaxPostingStatus = { DRAFT: "DRAFT", POSTED: "POSTED", VOIDED: "VOIDED" } as any;

/**
 * Schema for WHT Code Management (Master Data)
 */
export const whtCodeSchema = z.object({
    code: z.string().min(1, "รหัสต้องไม่ว่างเปล่า").max(50),
    name: z.string().min(1, "ชื่อต้องไม่ว่างเปล่า").max(100),
    rate: z.coerce.number().min(0).max(100),
    formType: z.nativeEnum(WhtFormType),
    payeeType: z.nativeEnum(WhtPayeeType),
    incomeCategory: z.string().min(1, "ประเภทเงินได้ต้องไม่ว่างเปล่า"),
    isActive: z.boolean().default(true),
});

export type WhtCodeFormValues = z.infer<typeof whtCodeSchema>;

export const getDefaultWhtCodeValues = (data?: Partial<WhtCodeFormValues>): WhtCodeFormValues => ({
    code: data?.code || "",
    name: data?.name || "",
    rate: data?.rate || 3, // Default to 3% (Service)
    formType: data?.formType || WhtFormType.PND53,
    payeeType: data?.payeeType || WhtPayeeType.CORPORATE,
    incomeCategory: data?.incomeCategory || "ค่าบริการ",
    isActive: data?.isActive ?? true,
});

/**
 * Schema for WHT Certificate Issuance (50 ทวิ)
 */
export const whtCertificateSchema = z.object({
    paymentId: z.string().optional(),
    partnerId: z.string().min(1, "กรุณาเลือกผู้รับเงิน"),
    issueDate: z.coerce.date(),

    // Amounts
    grossPayableAmount: z.coerce.number().min(0, "ยอดก่อนหักต้องไม่ติดลบ"),
    whtBaseAmount: z.coerce.number().min(0, "ฐานภาษีต้องไม่ติดลบ"),
    rate: z.coerce.number().min(0).max(100),
    whtAmount: z.coerce.number().min(0),
    netPaidAmount: z.coerce.number().min(0),

    // Tax Details
    whtCodeId: z.string().min(1, "กรุณาเลือกรหัสภาษี"),
    incomeCategory: z.string().min(1, "ประเภทเงินได้ต้องไม่ว่างเปล่า"),

    // Payee Snapshot
    payeeNameSnapshot: z.string().min(1, "ชื่อผู้รับเงินต้องไม่ว่างเปล่า"),
    payeeTaxIdSnapshot: z.string().optional(),
    payeeBranchSnapshot: z.string().default("00000"),
    payeeAddressSnapshot: z.string().optional(),
});

export type WhtCertificateFormValues = z.infer<typeof whtCertificateSchema>;

export const getDefaultWhtCertificateValues = (data?: Partial<WhtCertificateFormValues>): WhtCertificateFormValues => {
    const base = data?.whtBaseAmount || 0;
    const rate = data?.rate || 3;
    const wht = (base * rate) / 100;

    return {
        paymentId: data?.paymentId,
        partnerId: data?.partnerId || "",
        issueDate: data?.issueDate || new Date(),
        grossPayableAmount: data?.grossPayableAmount || 0,
        whtBaseAmount: base,
        rate: rate,
        whtAmount: data?.whtAmount ?? wht,
        netPaidAmount: data?.netPaidAmount ?? (data?.grossPayableAmount || 0) - wht,
        whtCodeId: data?.whtCodeId || "",
        incomeCategory: data?.incomeCategory || "",
        payeeNameSnapshot: data?.payeeNameSnapshot || "",
        payeeTaxIdSnapshot: data?.payeeTaxIdSnapshot || "",
        payeeBranchSnapshot: data?.payeeBranchSnapshot || "00000",
        payeeAddressSnapshot: data?.payeeAddressSnapshot || "",
    };
};
