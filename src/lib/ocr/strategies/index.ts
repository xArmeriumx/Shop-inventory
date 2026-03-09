/**
 * OCR Strategies Index
 * Export all strategies for easy access
 */

export * from './base';
export { receiptStrategy, ReceiptStrategy } from './receipt';
export { purchaseStrategy, PurchaseStrategy } from './purchase';
export { shipmentStrategy, ShipmentStrategy } from './shipment';
export { saleStrategy, SaleStrategy } from './sale';

import { DocumentType, OCRStrategy } from './base';
import { receiptStrategy } from './receipt';
import { purchaseStrategy } from './purchase';
import { shipmentStrategy } from './shipment';
import { saleStrategy } from './sale';

/**
 * Get strategy by document type
 */
export function getStrategy(docType: DocumentType): OCRStrategy {
  switch (docType) {
    case 'receipt':
      return receiptStrategy;
    case 'purchase':
      return purchaseStrategy;
    case 'invoice':
      return purchaseStrategy; // Use purchase strategy for invoices too
    case 'shipment':
      return shipmentStrategy;
    case 'sale':
      return saleStrategy;
    default:
      return receiptStrategy;
  }
}

/**
 * All available strategies
 */
export const strategies: Record<DocumentType, OCRStrategy> = {
  receipt: receiptStrategy,
  purchase: purchaseStrategy,
  invoice: purchaseStrategy,
  shipment: shipmentStrategy,
  sale: saleStrategy,
};
