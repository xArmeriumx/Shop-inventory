'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProductsForPurchase } from '@/actions/inventory/products.actions';
import { getSuppliersForSelect } from '@/actions/purchases/suppliers.actions';
import type { ProductForMatch, SupplierForMatch } from '@/lib/ocr/matcher';

/**
 * Result from the scan review modal
 */
export interface ScanResult {
  supplierId?: string;
  supplierName?: string;
  date?: string;
  documentNumber?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    costPrice: number;
  }>;
}

/**
 * Hook options
 */
interface UsePurchaseScannerOptions {
  /** Called when scan is confirmed */
  onConfirm?: (result: ScanResult) => void;
  /** Auto-load products and suppliers */
  autoLoadData?: boolean;
}

/**
 * Hook return type
 */
interface UsePurchaseScannerReturn {
  // State
  isLoading: boolean;
  products: ProductForMatch[];
  suppliers: SupplierForMatch[];
  pendingScanData: any;
  showReviewModal: boolean;

  // Actions
  handleScanComplete: (scanData: any) => void;
  handleReviewConfirm: (result: ScanResult) => void;
  closeReviewModal: () => void;
  refreshData: () => Promise<void>;

  // For review modal props
  setShowReviewModal: (show: boolean) => void;
}

/**
 * Custom hook for purchase receipt scanning
 * 
 * This hook encapsulates all the logic for:
 * - Loading products and suppliers for matching
 * - Managing scan data and review modal state
 * - Handling the confirm flow
 * 
 * Can be used from multiple places (list page, form page)
 */
export function usePurchaseScanner(options: UsePurchaseScannerOptions = {}): UsePurchaseScannerReturn {
  const { onConfirm, autoLoadData = true } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductForMatch[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierForMatch[]>([]);
  const [pendingScanData, setPendingScanData] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Load products and suppliers
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [productsResult, suppliersResult] = await Promise.all([
        getProductsForPurchase(),
        getSuppliersForSelect(),
      ]);

      if (productsResult.success) {
        setProducts(productsResult.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          costPrice: Number(p.costPrice),
        })));
      } else {
        console.error('Failed to fetch products for scanner:', productsResult.message);
      }

      if (suppliersResult.success) {
        setSuppliers(suppliersResult.data.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })));
      } else {
        console.error('Failed to fetch suppliers for scanner:', suppliersResult.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoadData) {
      refreshData();
    }
  }, [autoLoadData, refreshData]);

  // Handle scan completion - opens review modal
  const handleScanComplete = useCallback((scanData: any) => {
    if (!scanData) return;
    setPendingScanData(scanData);
    setShowReviewModal(true);
  }, []);

  // Handle review modal confirmation
  const handleReviewConfirm = useCallback((result: ScanResult) => {
    if (onConfirm) {
      onConfirm(result);
    }
    setShowReviewModal(false);
    setPendingScanData(null);
  }, [onConfirm]);

  // Close review modal
  const closeReviewModal = useCallback(() => {
    setShowReviewModal(false);
    setPendingScanData(null);
  }, []);

  return {
    isLoading,
    products,
    suppliers,
    pendingScanData,
    showReviewModal,
    handleScanComplete,
    handleReviewConfirm,
    closeReviewModal,
    refreshData,
    setShowReviewModal,
  };
}

/**
 * Session storage key for passing scan results between pages
 */
export const PENDING_SCAN_RESULT_KEY = 'pendingScanResult';

/**
 * Save scan result to session storage for cross-page navigation
 */
export function savePendingScanResult(result: ScanResult): void {
  try {
    sessionStorage.setItem(PENDING_SCAN_RESULT_KEY, JSON.stringify(result));
  } catch (error) {
    console.error('Failed to save scan result to session storage:', error);
  }
}

/**
 * Load and clear pending scan result from session storage
 */
export function loadPendingScanResult(): ScanResult | null {
  try {
    const data = sessionStorage.getItem(PENDING_SCAN_RESULT_KEY);
    if (data) {
      sessionStorage.removeItem(PENDING_SCAN_RESULT_KEY);
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load scan result from session storage:', error);
  }
  return null;
}
