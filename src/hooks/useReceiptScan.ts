// src/hooks/useReceiptScan.ts

import { useCallback } from 'react';
import { useProStatus } from '../context/ProContext';
import { canScanReceipts, scanReceipt, type ScanFill } from '../utils/receiptScan';

/** The spending sheet's "Scan a receipt" (NumpadModal's onScan), or undefined where scanning isn't built. */
export const useReceiptScan = (): (() => Promise<ScanFill | null>) | undefined => {
  const { isPro } = useProStatus();
  const scan = useCallback(() => scanReceipt(isPro), [isPro]);
  return canScanReceipts ? scan : undefined;
};
