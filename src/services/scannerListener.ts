import { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeScanEvent {
  barcode: string;
  timestamp: number;
  isFastWedge: boolean; // whether it arrived via ultra-fast scanner cadence (< 50ms)
  source?: 'hardware_wedge' | 'camera' | 'intent_broadcast' | 'manual';
}

interface UseScannerListenerOptions {
  onScan: (barcode: string, isFastWedge: boolean) => void;
  minLength?: number;
  maxKeystrokeIntervalMs?: number; // threshold in ms to distinguish hardware scanner from slow human typing (50ms for high-speed laser scanners)
  enabled?: boolean;
}

export function useScannerListener({
  onScan,
  minLength = 2,
  maxKeystrokeIntervalMs = 50, // Low latency threshold for Zebra & Honeywell PDAs
  enabled = true,
}: UseScannerListenerOptions) {
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number | null>(null);
  const [isScannerActive, setIsScannerActive] = useState<boolean>(false);

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const fastKeyCountRef = useRef<number>(0);
  const totalKeyCountRef = useRef<number>(0);
  const clearTimerRef = useRef<number | null>(null);

  const handleScanTrigger = useCallback((scannedCode: string, isFast: boolean) => {
    const clean = scannedCode.trim();
    if (clean.length >= minLength) {
      setLastScannedBarcode(clean);
      setLastScanTimestamp(Date.now());
      setIsScannerActive(true);
      onScan(clean, isFast);
    }
  }, [minLength, onScan]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Hardware Keystroke Wedge Listener (USB, Bluetooth, Zebra DataWedge, Honeywell, Urovo)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape key to clear buffer
      if (e.key === 'Escape') {
        bufferRef.current = '';
        fastKeyCountRef.current = 0;
        totalKeyCountRef.current = 0;
        return;
      }

      // Ignore standard modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      const target = e.target as HTMLElement;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      const isScannerDedicatedInput = target?.getAttribute('data-scanner-input') === 'true';

      const currentTime = Date.now();
      const interval = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Detect Enter key = scanner transmission terminator
      if (e.key === 'Enter' || e.key === 'Tab') {
        const currentBuffer = bufferRef.current;
        const total = totalKeyCountRef.current;
        const fast = fastKeyCountRef.current;
        const isFastWedge = total > 0 && (fast / total) > 0.5;

        bufferRef.current = '';
        fastKeyCountRef.current = 0;
        totalKeyCountRef.current = 0;

        if (clearTimerRef.current) {
          window.clearTimeout(clearTimerRef.current);
          clearTimerRef.current = null;
        }

        // If focused in dedicated scanner input in ActiveAuditScreen, let the form onSubmit handle it directly
        if (isScannerDedicatedInput) {
          return;
        }

        if (currentBuffer.trim().length >= minLength) {
          if (isInput) {
            e.preventDefault();
          }
          handleScanTrigger(currentBuffer, isFastWedge);
        }
        return;
      }

      // If regular printable character
      if (e.key.length === 1) {
        totalKeyCountRef.current += 1;
        if (interval <= maxKeystrokeIntervalMs && interval > 0) {
          fastKeyCountRef.current += 1;
        }

        bufferRef.current += e.key;

        // Auto-clear buffer if user pauses for more than 400ms (prevents lingering partial scans)
        if (clearTimerRef.current) {
          window.clearTimeout(clearTimerRef.current);
        }
        clearTimerRef.current = window.setTimeout(() => {
          bufferRef.current = '';
          fastKeyCountRef.current = 0;
          totalKeyCountRef.current = 0;
        }, 400);
      }
    };

    // 2. Android Custom Broadcast Intent Listeners (DataWedge / Honeywell Webview bridge)
    const handleCustomScanEvent = (e: Event) => {
      const customEvt = e as CustomEvent;
      const scannedData = customEvt.detail?.barcode || customEvt.detail?.data || customEvt.detail?.scanData;
      if (typeof scannedData === 'string' && scannedData.trim().length >= minLength) {
        handleScanTrigger(scannedData.trim(), true);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('wms_barcode_scan', handleCustomScanEvent);
    window.addEventListener('datawedge_scan', handleCustomScanEvent);
    window.addEventListener('honeywell_scan', handleCustomScanEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('wms_barcode_scan', handleCustomScanEvent);
      window.removeEventListener('datawedge_scan', handleCustomScanEvent);
      window.removeEventListener('honeywell_scan', handleCustomScanEvent);
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, [enabled, handleScanTrigger, maxKeystrokeIntervalMs, minLength]);

  return {
    lastScannedBarcode,
    lastScanTimestamp,
    isScannerActive,
    manualScan: (code: string) => handleScanTrigger(code, false),
  };
}
