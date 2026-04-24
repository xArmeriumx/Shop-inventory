'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { ScanPurchaseButton } from './scan-purchase-button';
import { ScanReviewModal } from '@/components/core/ocr/scan-review-modal';
import { 
  usePurchaseScanner, 
  savePendingScanResult, 
  type ScanResult 
} from './use-purchase-scanner';

interface PurchaseScannerButtonProps {
  /** 
   * Where is this button placed?
   * - 'list' = on /purchases page (will navigate after scan)
   * - 'form' = on /purchases/new page (will call onConfirm directly)
   */
  mode: 'list' | 'form';
  
  /** Called when scan is confirmed (only used in 'form' mode) */
  onConfirm?: (result: ScanResult) => void;
  
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Standalone purchase scanner button with integrated review modal
 * 
 * Can be used in two modes:
 * 1. List mode: On /purchases page - saves result to sessionStorage and navigates to /purchases/new
 * 2. Form mode: On /purchases/new page - calls onConfirm directly with result
 */
export function PurchaseScannerButton({
  mode,
  onConfirm,
  variant = 'outline',
  size = 'default',
}: PurchaseScannerButtonProps) {
  const router = useRouter();
  
  const {
    products,
    suppliers,
    pendingScanData,
    showReviewModal,
    handleScanComplete,
    setShowReviewModal,
  } = usePurchaseScanner({ autoLoadData: true });

  // Handle review modal confirmation
  const handleReviewConfirm = (result: ScanResult) => {
    if (mode === 'list') {
      // Save to session storage and navigate
      savePendingScanResult(result);
      router.push('/purchases/new?fromScan=true');
    } else {
      // Call parent handler directly
      if (onConfirm) {
        onConfirm(result);
      }
    }
    setShowReviewModal(false);
  };

  return (
    <>
      <ScanPurchaseButton
        onScanComplete={handleScanComplete}
        variant={variant}
        size={size}
      />
      
      <ScanReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        scanData={pendingScanData}
        products={products}
        suppliers={suppliers}
        onConfirm={handleReviewConfirm}
      />
    </>
  );
}
