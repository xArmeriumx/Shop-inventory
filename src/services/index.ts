export * from './product.service';
export * from './stock.service';
export * from './sale.service';
export * from './purchase.service';
export * from './return.service';
export * from './shipment.service';
export * from './sequence.service';
export * as ReportService from './report.service';
export type { ReportData } from './report.service';
export * from './customer.service';
export * from './supplier.service';
export * from './finance.service';
export * from './tax-resolution.service';
export * from './tax-settings.service';
export * from './wht.service';

// TODO: WhtCertificateService (T5.2)
export * from './purchase-tax.service';
export * from './workflow.service';
export * from './export.service';
export * from './lookup.service';
export * from './notification.service';
export * from './ai.service';
export * from './onboarding.service';
export * from './system.service';
export * from './payment.service';
export * from './iam.service';
export * from './invoice.service';
export * from './approval.service';
export * from './dashboard.service';
export * from './delivery-order.service';
export * from './order-request.service';
export * from './quotation.service';
export * from './stock-take.service';
export * from './product-intelligence.service';
export * from './audit.service';
export * from './settings.service';
export type { OcrParcel, ParcelMatch } from './shipment.service';

// TAX SYSTEM: Phase T1
export { TaxCalculationService } from './tax-calculation.service';
export type { LineCalcInput, LineCalcResult, HeaderTotals, TaxKind, TaxCalculationMode } from './tax-calculation.service';
export { TaxResolutionService } from './tax-resolution.service';
export type { TaxResolutionInput, ResolvedTaxCode, TaxDirection } from './tax-resolution.service';
export { TaxSettingsService } from './tax-settings.service';
export type {
  UpsertCompanyTaxProfileInput,
  CreateTaxCodeInput,
  UpsertPartnerTaxProfileInput,
  UpsertProductTaxProfileInput,
} from './tax-settings.service';

export { ServiceError } from '@/types/domain';
export type {
  RequestContext,
  GetCustomersParams,
  GetProductsParams,
  GetSalesParams,
  GetPurchasesParams,
  BatchProductInput,
  BatchCreateResult,
  PaginatedResult,
  SerializedProduct,
  SerializedSale,
  SerializedPurchase,
  SerializedSaleWithItems
} from '@/types/domain';
