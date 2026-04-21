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
export * from './iam.service';
export * from './settings.service';
export * from './dashboard.service';
export * from './export.service';
export * from './lookup.service';
export * from './notification.service';
export * from './ai.service';
export * from './onboarding.service';
export * from './system.service';
export * from './payment.service';
export type { OcrParcel, ParcelMatch } from './shipment.service';

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
