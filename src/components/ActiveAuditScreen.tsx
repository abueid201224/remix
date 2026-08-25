import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ScanLine, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RotateCcw, 
  Package, 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  ArrowUpDown, 
  QrCode, 
  Camera,
  Hash,
  Clock,
  CheckCheck,
  AlertCircle,
  PauseCircle,
  Play,
  Trash2,
  Layers,
  ShieldAlert,
  Archive,
  Ban,
  Check,
  HelpCircle,
  SlidersHorizontal
} from 'lucide-react';
import type { 
  ActiveInvoiceSession, 
  MasterInvoiceItem, 
  ScannedAuditItem, 
  AuditDiscrepancy,
  WrongPickingItem,
  WrongPickingRecord,
  AppSettings,
  IncompleteInvoiceRecord,
  CompletedInvoiceRecord,
  LongBarcodePolicy,
  DailyAuditSnapshot
} from '../types';
import { 
  getInvoiceMasterItems, 
  saveActiveSession, 
  saveAuditDiscrepancies, 
  saveAuditHistory,
  getAllUniqueInvoices,
  isInvoiceCompleted,
  markInvoiceAsCompleted,
  getAllCompletedInvoices,
  reopenCompletedInvoice,
  saveIncompleteInvoice,
  getAllIncompleteInvoices,
  getIncompleteInvoice,
  deleteIncompleteInvoice,
  getInvoicesAuditSummaryStats,
  saveWrongPicking,
  findItemBelonging,
  getWrongPickingsByInvoice,
  saveDailyAuditSnapshot,
  getLatestDailyAuditSnapshot,
  isBatchClosedAndCountersZeroed,
  resetActiveBatchCountersState,
  getAllAuditDiscrepancies,
  getAllWrongPickings
} from '../services/db';
import { SoundEffects } from '../services/audio';
import { translations } from '../services/i18n';
import { CameraQrScannerModal } from './CameraQrScannerModal';
import { InternalDiscrepancyModal } from './InternalDiscrepancyModal';
import { BookOpen } from 'lucide-react';

interface ActiveAuditScreenProps {
  activeSession: ActiveInvoiceSession | null;
  setActiveSession: (session: ActiveInvoiceSession | null) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onInvoiceCompleted: (
    invoiceNo: string, 
    discarded: number, 
    discrepancies: AuditDiscrepancy[], 
    totalRequiredQty: number, 
    totalScannedQty: number, 
    totalLineItems: number
  ) => void;
  onOpenSyncModal: () => void;
  lastScannedCode: string | null;
  discrepancies?: AuditDiscrepancy[];
  wrongPickings?: WrongPickingRecord[];
  onRefreshDiscrepancies?: () => void;
  onOpenLogicGuide?: (tab?: string) => void;
}

// Normalizes barcode strings to ensure robust random matching (ignores leading zeroes and whitespace)
function findMatchingItemKey(items: Record<string, ScannedAuditItem>, code: string): string | null {
  const clean = code.trim();
  if (items[clean]) return clean;

  const cleanLower = clean.toLowerCase();
  const strippedClean = clean.replace(/^0+/, '');

  for (const key of Object.keys(items)) {
    if (key.toLowerCase() === cleanLower) return key;
    if (strippedClean && key.replace(/^0+/, '').toLowerCase() === strippedClean.toLowerCase()) return key;
  }
  return null;
}

export const ActiveAuditScreen: React.FC<ActiveAuditScreenProps> = ({
  activeSession,
  setActiveSession,
  settings,
  onUpdateSettings,
  onInvoiceCompleted,
  onOpenSyncModal,
  lastScannedCode,
  discrepancies = [],
  wrongPickings = [],
  onRefreshDiscrepancies = () => {},
  onOpenLogicGuide,
}) => {
  const t = translations[settings.language] || translations.en;
  const isRtl = settings.language === 'ar';

  const [manualInput, setManualInput] = useState('');
  const [availableInvoices, setAvailableInvoices] = useState<{ invoiceNo: string; orderNo?: string; itemCount: number; totalQty: number }[]>([]);
  const [completedInvoices, setCompletedInvoices] = useState<CompletedInvoiceRecord[]>([]);
  const [incompleteInvoices, setIncompleteInvoices] = useState<IncompleteInvoiceRecord[]>([]);
  const [isBatchZeroed, setIsBatchZeroed] = useState<boolean>(false);
  const [latestDailySnapshot, setLatestDailySnapshot] = useState<DailyAuditSnapshot | null>(null);
  
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'PENDING' | 'EXACT' | 'DISCREPANCIES'>('ALL');
  const [isCameraQrOpen, setIsCameraQrOpen] = useState(false);
  const [isIncompleteDrawerOpen, setIsIncompleteDrawerOpen] = useState(false);
  const [isInternalDiscrepancyOpen, setIsInternalDiscrepancyOpen] = useState(false);
  
  // Blocked Completed Invoice Warning Modal
  const [blockedInvoiceWarning, setBlockedInvoiceWarning] = useState<{
    invoiceNo: string;
    completedRecord: CompletedInvoiceRecord;
  } | null>(null);

  // Long Barcode Warning & Decision Modal (> 10 digits)
  const [longBarcodePrompt, setLongBarcodePrompt] = useState<{
    isOpen: boolean;
    barcode: string;
    length: number;
  } | null>(null);

  const [recentScanFeedback, setRecentScanFeedback] = useState<{ 
    code: string; 
    message: string; 
    type: 'match' | 'exact' | 'mismatch' | 'surplus' | 'blocked';
    itemName?: string;
    currentQty?: number;
    reqQty?: number;
    unit?: string;
  } | null>(null);

  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Load available invoices list, completed list, and incomplete list
  useEffect(() => {
    loadAllAuditData();
  }, [activeSession]);

  const loadAllAuditData = async () => {
    try {
      const [allInvs, completedList, incompleteList, zeroedFlag, latestSnapshot] = await Promise.all([
        getAllUniqueInvoices(),
        getAllCompletedInvoices(),
        getAllIncompleteInvoices(),
        isBatchClosedAndCountersZeroed(),
        getLatestDailyAuditSnapshot(),
      ]);
      setAvailableInvoices(allInvs);
      setCompletedInvoices(completedList);
      setIncompleteInvoices(incompleteList);
      setIsBatchZeroed(zeroedFlag);
      setLatestDailySnapshot(latestSnapshot);
    } catch (err) {
      console.error('Failed to load audit data', err);
    }
  };

  // Keep scanner input focused for hardware wedge readiness and auto-clearing
  const focusAndClearInput = () => {
    setManualInput('');
    setTimeout(() => {
      if (scannerInputRef.current) {
        scannerInputRef.current.focus();
      }
      const el = document.getElementById('barcode-input') as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 40);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeSession, isCameraQrOpen, blockedInvoiceWarning]);

  // STEP A: Lock into an Invoice session (by Invoice Number OR Order Number)
  const lockInvoiceSession = async (invoiceNoInput: string, forceReopen = false) => {
    const cleanInput = invoiceNoInput.trim();
    if (!cleanInput) return;

    // Reset previous batch counters record when starting a fresh scan
    if (isBatchZeroed) {
      await resetActiveBatchCountersState();
      setIsBatchZeroed(false);
    }

    setIsLoadingInvoice(true);
    try {
      // 1. CHECK IF INVOICE IS ALREADY COMPLETED (Prevent duplicate scanning)
      if (!forceReopen) {
        const completedRecord = await isInvoiceCompleted(cleanInput);
        if (completedRecord) {
          if (settings.soundEnabled) SoundEffects.playAlreadyCompletedBlocked(settings.soundVolume);
          if (settings.vibrationEnabled) SoundEffects.vibrate([200, 100, 200, 100, 200]);

          setBlockedInvoiceWarning({
            invoiceNo: completedRecord.invoiceNo,
            completedRecord,
          });

          setRecentScanFeedback({
            code: completedRecord.invoiceNo,
            message: isRtl 
              ? `⚠️ الفاتورة [${completedRecord.invoiceNo}] مكتملة ومقفلة مسبقاً! تم منع تكرار المسح.`
              : `⚠️ Invoice [${completedRecord.invoiceNo}] is already COMPLETED and closed! Duplicate scan blocked.`,
            type: 'blocked',
          });

          focusAndClearInput();
          return;
        }
      }

      // 2. CHECK IF INVOICE WAS PREVIOUSLY DEFERRED AS INCOMPLETE (Resume State!)
      const savedIncomplete = await getIncompleteInvoice(cleanInput);
      if (savedIncomplete && !forceReopen) {
        // Resume previous incomplete session with scanned counts preserved!
        await saveActiveSession(savedIncomplete.session);
        setActiveSession(savedIncomplete.session);

        if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
        if (settings.vibrationEnabled) SoundEffects.vibrate(100);

        setRecentScanFeedback({
          code: savedIncomplete.invoiceNo,
          message: isRtl 
            ? `تم استرجاع الفاتورة المرحلة [${savedIncomplete.invoiceNo}] بنجاح (${savedIncomplete.completedItemsCount}/${savedIncomplete.totalItemsCount} صنف مكتمل). يمكنك استكمال مسح النواقص الآن.`
            : `Resumed Incomplete Invoice [${savedIncomplete.invoiceNo}] (${savedIncomplete.completedItemsCount}/${savedIncomplete.totalItemsCount} items completed). Ready to scan shortages.`,
          type: 'match',
        });

        focusAndClearInput();
        return;
      }

      // 3. FRESH INVOICE INITIALIZATION FROM MASTER DATA
      const masterItems = await getInvoiceMasterItems(cleanInput);
      const effectiveInvoiceNo = masterItems.length > 0 ? masterItems[0].invoiceNo : cleanInput;
      const effectiveOrderNo = masterItems.length > 0 ? masterItems[0].orderNo : undefined;

      const initialItems: Record<string, ScannedAuditItem> = {};
      const now = new Date().toISOString();

      masterItems.forEach((m, idx) => {
        initialItems[m.itemCode] = {
          orderNo: m.orderNo,
          itemCode: m.itemCode,
          itemName: m.itemName,
          unit: m.unit,
          requiredQty: m.requiredQty,
          actualQty: 0,
          codeStatus: 'MATCH',
          qtyStatus: 'SHORTAGE', // 0 < reqQty
          lastScannedAt: now,
          scanHistory: [],
          originalIndex: m.originalIndex !== undefined ? m.originalIndex : idx,
        };
      });

      const newSession: ActiveInvoiceSession = {
        invoiceNo: effectiveInvoiceNo,
        orderNo: effectiveOrderNo,
        startedAt: now,
        lastActivityAt: now,
        items: initialItems,
        isLocked: true,
        lastScannedItemCode: null,
        longBarcodePolicy: 'ASK', // Reset policy to prompt alert for each new invoice session
      };

      await saveActiveSession(newSession);
      setActiveSession(newSession);

      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      if (settings.vibrationEnabled) SoundEffects.vibrate(100);

      setRecentScanFeedback({
        code: effectiveInvoiceNo,
        message: masterItems.length > 0 
          ? (isRtl 
              ? `تم قفل الفاتورة ${effectiveInvoiceNo}${effectiveOrderNo ? ` (أوردر: ${effectiveOrderNo})` : ''} - (${masterItems.length} صنف). جاهز للإسكان العشوائي.` 
              : `Locked Invoice ${effectiveInvoiceNo}${effectiveOrderNo ? ` (Order: ${effectiveOrderNo})` : ''} - (${masterItems.length} items). Ready for random scanning.`)
          : (isRtl 
              ? `الفاتورة ${cleanInput} غير مدرجة بالملف، ولكن تم تهيئة الجلسة.` 
              : `Invoice ${cleanInput} not in master file, but session initialized.`),
        type: 'match',
      });
    } catch (err) {
      console.error('Failed to lock invoice session', err);
    } finally {
      setIsLoadingInvoice(false);
      focusAndClearInput();
    }
  };

  // Core scan execution (increment item count and update session state)
  const executeRecordItemScan = async (scannedItemCode: string, currentSession: ActiveInvoiceSession) => {
    const cleanCode = scannedItemCode.trim();
    if (!cleanCode) return;

    const session = { ...currentSession };
    const items = { ...session.items };
    const now = new Date().toISOString();

    const matchingKey = findMatchingItemKey(items, cleanCode);
    let targetItem = matchingKey ? items[matchingKey] : null;

    let feedbackType: 'match' | 'exact' | 'mismatch' | 'surplus' = 'match';
    let feedbackMsg = '';
    let resolvedItemCode = cleanCode;

    if (targetItem) {
      // ITEM BELONGS TO INVOICE (Calculate Shortage, Exact, Surplus strictly for invoice items)
      resolvedItemCode = targetItem.itemCode;
      const newActualQty = targetItem.actualQty + 1;
      let newQtyStatus: 'EXACT' | 'SHORTAGE' | 'SURPLUS' = 'SHORTAGE';

      if (newActualQty === targetItem.requiredQty) {
        newQtyStatus = 'EXACT';
        feedbackType = 'exact';
        feedbackMsg = isRtl 
          ? `مطابقة تامة! الصنف [${resolvedItemCode}] وصل للعدد المطلوب بالكامل (${targetItem.requiredQty} ${targetItem.unit})` 
          : `EXACT MATCH! [${resolvedItemCode}] reached required ${targetItem.requiredQty} ${targetItem.unit}`;
        if (settings.soundEnabled) SoundEffects.playExactComplete(settings.soundVolume);
        if (settings.vibrationEnabled) SoundEffects.vibrate([80, 50, 80]);
      } else if (newActualQty > targetItem.requiredQty) {
        newQtyStatus = 'SURPLUS';
        feedbackType = 'surplus';
        feedbackMsg = isRtl 
          ? `تحذير زيادة! الصنف [${resolvedItemCode}] أصبح (${newActualQty}) وتجاوز المطلوب (${targetItem.requiredQty} ${targetItem.unit})` 
          : `SURPLUS WARNING! [${resolvedItemCode}] count ${newActualQty} exceeds required ${targetItem.requiredQty}`;
        if (settings.soundEnabled) SoundEffects.playSurplusAlert(settings.soundVolume);
        if (settings.vibrationEnabled) SoundEffects.vibrate([150, 100, 150]);
      } else {
        newQtyStatus = 'SHORTAGE';
        feedbackType = 'match';
        feedbackMsg = isRtl 
          ? `الصنف [${resolvedItemCode}] +1 (تم مسح ${newActualQty} من ${targetItem.requiredQty} ${targetItem.unit})` 
          : `Item [${resolvedItemCode}] +1 (Scanned ${newActualQty} of ${targetItem.requiredQty} ${targetItem.unit})`;
        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
        if (settings.vibrationEnabled) SoundEffects.vibrate(40);
      }

      items[targetItem.itemCode] = {
        ...targetItem,
        actualQty: newActualQty,
        qtyStatus: newQtyStatus,
        lastScannedAt: now,
        scanHistory: [...(targetItem.scanHistory || []), now],
      };

      session.items = items;
      session.lastActivityAt = now;
      session.lastScannedItemCode = resolvedItemCode;

      setRecentScanFeedback({
        code: resolvedItemCode,
        itemName: targetItem.itemName,
        currentQty: newActualQty,
        reqQty: targetItem.requiredQty,
        unit: targetItem.unit,
        message: feedbackMsg,
        type: feedbackType,
      });

      await saveActiveSession(session);
      setActiveSession(session);
    } else {
      // ITEM DOES NOT BELONG TO INVOICE -> WRONG PICKING (تجهيز خاطئ)
      // DO NOT add to session.items! Divert directly to dedicated Wrong Picking Report.
      if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
      if (settings.vibrationEnabled) SoundEffects.vibrate([200, 100, 200, 100, 200]);

      // Look up if this item belongs to another invoice/order in master database
      const belonging = await findItemBelonging(cleanCode);

      await saveWrongPicking({
        activeInvoiceNo: session.invoiceNo,
        orderNo: session.orderNo,
        itemCode: cleanCode,
        itemName: belonging?.itemName || (isRtl ? 'صنف دخيل غير مدرج بالفاتورة' : 'Foreign Unlisted Item'),
        unit: belonging?.unit || 'PCS',
        actualBelongingInvoiceNo: belonging?.invoiceNo,
        actualBelongingOrderNo: belonging?.orderNo,
        scannedAt: now,
        auditorName: settings.auditorName || 'أحمد حمادة',
        auditorId: settings.auditorId || 'AUD-101',
        quantity: 1,
        notes: belonging?.invoiceNo 
          ? (isRtl ? `صنف يتبع الفاتورة ${belonging.invoiceNo}${belonging.orderNo ? ` (أوردر: ${belonging.orderNo})` : ''}` : `Belongs to Invoice ${belonging.invoiceNo}`)
          : (isRtl ? 'صنف غير مدرج بقاعدة البيانات' : 'Item not found in master database'),
      });

      feedbackType = 'mismatch';
      feedbackMsg = isRtl 
        ? `⚠️ تجهيز خاطئ! الباركود [${cleanCode}] لا ينتمي للفاتورة ${session.invoiceNo}! لم يتم إضافته لسجل الفاتورة ورُحّل لتقرير التجهيز الخاطئ.${belonging?.invoiceNo ? ` (ينتمي للفاتورة: ${belonging.invoiceNo})` : ''}` 
        : `⚠️ WRONG PICKING! Item [${cleanCode}] does NOT belong to Invoice ${session.invoiceNo}! Excluded from invoice ledger and routed to Wrong Picking Report.${belonging?.invoiceNo ? ` (Belongs to: ${belonging.invoiceNo})` : ''}`;

      setRecentScanFeedback({
        code: cleanCode,
        itemName: belonging?.itemName || (isRtl ? 'تجهيز خاطئ (مستبعد من الفاتورة)' : 'Wrong Picking (Excluded)'),
        currentQty: 0,
        reqQty: 0,
        unit: belonging?.unit || 'PCS',
        message: feedbackMsg,
        type: 'mismatch',
      });

      // Update session activity timestamp without polluting items table
      session.lastActivityAt = now;
      await saveActiveSession(session);
      setActiveSession(session);
    }
  };

  // STEP B: Handle Random Item Scan (with > 10 digits conditional rule)
  const handleItemScan = async (scannedItemCode: string) => {
    if (!activeSession) return;
    const cleanCode = scannedItemCode.trim();
    if (!cleanCode) return;

    const threshold = settings.longBarcodeThreshold || 10;
    const isLongBarcode = cleanCode.length > threshold;

    if (isLongBarcode) {
      const policy: LongBarcodePolicy = activeSession.longBarcodePolicy || 'ASK';

      if (policy === 'BLOCK') {
        // Automatically reject/ignore without popping up modal
        if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume * 0.5);
        setRecentScanFeedback({
          code: cleanCode,
          message: isRtl 
            ? `⚠️ تم تجاهل الباركود [${cleanCode}] (${cleanCode.length} رقم) تلقائياً وفقاً لقرار عدم السماح لهذه الجلسة.`
            : `⚠️ Barcode [${cleanCode}] (${cleanCode.length} digits) blocked according to session policy.`,
          type: 'blocked',
        });
        focusAndClearInput();
        return;
      }

      if (policy === 'ASK') {
        // Trigger alert sound & open the 3-option modal
        if (settings.soundEnabled) SoundEffects.playLongBarcodeAlert(settings.soundVolume);
        if (settings.vibrationEnabled) SoundEffects.vibrate([150, 80, 150]);

        setLongBarcodePrompt({
          isOpen: true,
          barcode: cleanCode,
          length: cleanCode.length,
        });
        focusAndClearInput();
        return;
      }

      // If policy === 'ALLOW': Proceed directly to record barcode without alert
    }

    // Normal item recording
    await executeRecordItemScan(cleanCode, activeSession);
    focusAndClearInput();
  };

  // Modal Action 1: ALLOW for entire session (سماح)
  const handleLongBarcodeAllow = async () => {
    if (!activeSession || !longBarcodePrompt) return;
    const barcodeToRecord = longBarcodePrompt.barcode;

    const updatedSession: ActiveInvoiceSession = {
      ...activeSession,
      longBarcodePolicy: 'ALLOW',
    };
    await saveActiveSession(updatedSession);
    setActiveSession(updatedSession);
    setLongBarcodePrompt(null);

    // Record the barcode
    await executeRecordItemScan(barcodeToRecord, updatedSession);
    focusAndClearInput();
  };

  // Modal Action 2: BLOCK for entire session (عدم السماح)
  const handleLongBarcodeBlock = async () => {
    if (!activeSession || !longBarcodePrompt) return;
    const barcodeToBlock = longBarcodePrompt.barcode;

    const updatedSession: ActiveInvoiceSession = {
      ...activeSession,
      longBarcodePolicy: 'BLOCK',
    };
    await saveActiveSession(updatedSession);
    setActiveSession(updatedSession);
    setLongBarcodePrompt(null);

    setRecentScanFeedback({
      code: barcodeToBlock,
      message: isRtl 
        ? `تم اعتماد [عدم السماح]: تم تجاهل الباركود (${barcodeToBlock}) وسيتم حظر أي باركود أطول من ${settings.longBarcodeThreshold || 10} أرقام حتى نهاية الجلسة بدون تنبيه.`
        : `Policy set to [BLOCK]: Barcode (${barcodeToBlock}) ignored and all barcodes > 10 digits will be blocked for this session.`,
      type: 'blocked',
    });
    focusAndClearInput();
  };

  // Modal Action 3: DECIDE LATER (Skip once, keep prompt active for future) (قرر لاحقاً)
  const handleLongBarcodeDecideLater = async () => {
    if (!activeSession || !longBarcodePrompt) return;
    const barcodeToSkip = longBarcodePrompt.barcode;

    const updatedSession: ActiveInvoiceSession = {
      ...activeSession,
      longBarcodePolicy: 'ASK',
    };
    await saveActiveSession(updatedSession);
    setActiveSession(updatedSession);
    setLongBarcodePrompt(null);

    setRecentScanFeedback({
      code: barcodeToSkip,
      message: isRtl 
        ? `تم تخطي الباركود [${barcodeToSkip}] دون تسجيل. سيستمر ظهور التنبيه عند مسح أي باركود أطول من ${settings.longBarcodeThreshold || 10} أرقام.`
        : `Barcode [${barcodeToSkip}] skipped without recording; prompt will appear again for long barcodes.`,
      type: 'blocked',
    });
    focusAndClearInput();
  };

  // Quick toggle long barcode policy from session header
  const handleToggleLongBarcodePolicy = async (newPolicy: LongBarcodePolicy) => {
    if (!activeSession) return;
    const updatedSession: ActiveInvoiceSession = {
      ...activeSession,
      longBarcodePolicy: newPolicy,
    };
    await saveActiveSession(updatedSession);
    setActiveSession(updatedSession);
    focusAndClearInput();
  };

  // Manual Adjustments (+, -, Reset)
  const adjustItemQuantity = async (itemCode: string, delta: number) => {
    if (!activeSession) return;
    const session = { ...activeSession };
    const items = { ...session.items };
    const item = items[itemCode];
    if (!item) return;

    const newQty = Math.max(0, item.actualQty + delta);
    let newQtyStatus: 'EXACT' | 'SHORTAGE' | 'SURPLUS' = 'SHORTAGE';

    if (item.codeStatus === 'MISMATCH') {
      newQtyStatus = newQty > 0 ? 'SURPLUS' : 'EXACT';
    } else {
      if (newQty === item.requiredQty) newQtyStatus = 'EXACT';
      else if (newQty > item.requiredQty) newQtyStatus = 'SURPLUS';
      else newQtyStatus = 'SHORTAGE';
    }

    const now = new Date().toISOString();
    items[itemCode] = {
      ...item,
      actualQty: newQty,
      qtyStatus: newQtyStatus,
      lastScannedAt: now,
    };

    session.items = items;
    session.lastScannedItemCode = itemCode;
    await saveActiveSession(session);
    setActiveSession(session);
  };

  // ACTION 1: Complete and Finalize Invoice (100% Exact or Finalizing with Error Report)
  const handleFinalizeInvoice = async (markCompletedAsExact = false, nextInvoiceToLock?: string) => {
    if (!activeSession) return;

    const session = activeSession;
    const allItems: ScannedAuditItem[] = Object.values(session.items);
    const auditedAt = new Date().toISOString();

    let cleanDiscardedCount = 0;
    const discrepanciesToArchive: AuditDiscrepancy[] = [];
    let totalReqQty = 0;
    let totalActQty = 0;

    // Evaluate each row
    for (const item of allItems) {
      totalReqQty += item.requiredQty;
      totalActQty += item.actualQty;
      const isExactMatch = item.codeStatus === 'MATCH' && item.qtyStatus === 'EXACT';

      if (isExactMatch) {
        cleanDiscardedCount += 1;
      } else {
        discrepanciesToArchive.push({
          orderNo: session.orderNo || item.orderNo,
          invoiceNo: session.invoiceNo,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
          requiredQty: item.requiredQty,
          actualQty: item.actualQty,
          codeStatus: item.codeStatus,
          qtyStatus: item.qtyStatus,
          difference: item.actualQty - item.requiredQty,
          auditedAt,
          notes: item.codeStatus === 'MISMATCH' 
            ? (isRtl ? 'صنف غير مدرج بالفاتورة' : 'Item not present in invoice manifest')
            : item.qtyStatus === 'SHORTAGE' 
              ? (isRtl ? `نقص بقيمة ${item.requiredQty - item.actualQty} ${item.unit}` : `Shortage of ${item.requiredQty - item.actualQty} ${item.unit}`)
              : (isRtl ? `زيادة بقيمة ${item.actualQty - item.requiredQty} ${item.unit}` : `Surplus of ${item.actualQty - item.requiredQty} ${item.unit}`),
        });
      }
    }

    if (discrepanciesToArchive.length > 0) {
      await saveAuditDiscrepancies(discrepanciesToArchive);
    }

    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date().getTime();
    const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

    // Save to audit history
    await saveAuditHistory({
      orderNo: session.orderNo,
      invoiceNo: session.invoiceNo,
      totalRequiredItems: allItems.filter(i => i.codeStatus === 'MATCH').length,
      totalRequiredQty: totalReqQty,
      totalScannedQty: totalActQty,
      scannedItemsCount: allItems.reduce((acc, curr) => acc + curr.actualQty, 0),
      exactItemsCount: cleanDiscardedCount,
      discrepancyCount: discrepanciesToArchive.length,
      status: discrepanciesToArchive.length === 0 ? 'COMPLETED' : 'DISCREPANCIES_FOUND',
      completedAt: auditedAt,
      durationSeconds,
    });

    // If completely clean or marked completed, lock it to prevent duplicate scans
    if (discrepanciesToArchive.length === 0 || markCompletedAsExact) {
      await markInvoiceAsCompleted({
        invoiceNo: session.invoiceNo,
        orderNo: session.orderNo,
        completedAt: auditedAt,
        totalItems: allItems.length,
        totalQty: totalActQty,
      });

      if (settings.soundEnabled) SoundEffects.playInvoiceFinished(settings.soundVolume);
    }

    // Delete any pending incomplete record since it's now completed
    await deleteIncompleteInvoice(session.invoiceNo);

    // Check if this was the last invoice of the batch
    const [allInvs, updatedCompleted] = await Promise.all([
      getAllUniqueInvoices(),
      getAllCompletedInvoices(),
    ]);

    const isLastInvoiceOfBatch = allInvs.length > 0 && updatedCompleted.length >= allInvs.length;
    if (isLastInvoiceOfBatch) {
      const [currentDiscrepancies, currentWrongs] = await Promise.all([
        getAllAuditDiscrepancies(),
        getAllWrongPickings(),
      ]);

      const snapshot: DailyAuditSnapshot = {
        id: `snapshot-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        closedAt: auditedAt,
        totalInvoices: allInvs.length,
        completedInvoices: updatedCompleted.length,
        totalItems: updatedCompleted.reduce((acc, c) => acc + (c.totalItems || 0), 0),
        totalRequiredQty: updatedCompleted.reduce((acc, c) => acc + (c.totalQty || 0), 0),
        totalScannedQty: updatedCompleted.reduce((acc, c) => acc + (c.totalQty || 0), 0),
        totalDiscrepancies: currentDiscrepancies.length,
        totalWrongPickings: currentWrongs.length,
        auditorName: settings.auditorName || 'أحمد حمادة',
        auditorId: settings.auditorId || 'AUD-101',
        notes: 'تم إقفال آخر فاتورة وتسجيل قيم عدادات اليوم وتصفير عدادات التشغيل بنجاح لحين مزامنة جديدة.'
      };

      await saveDailyAuditSnapshot(snapshot);
      setIsBatchZeroed(true);
      setLatestDailySnapshot(snapshot);
      if (settings.soundEnabled) SoundEffects.playExactComplete(settings.soundVolume);
    }

    // Clear active session
    await saveActiveSession(null);
    setActiveSession(null);

    // Reload lists
    await loadAllAuditData();

    onInvoiceCompleted(
      session.invoiceNo, 
      cleanDiscardedCount, 
      discrepanciesToArchive, 
      totalReqQty, 
      totalActQty, 
      allItems.filter(i => i.codeStatus === 'MATCH').length
    );

    focusAndClearInput();

    if (nextInvoiceToLock && nextInvoiceToLock !== session.invoiceNo) {
      setTimeout(() => {
        lockInvoiceSession(nextInvoiceToLock);
      }, 250);
    }
  };

  // ACTION 2: Defer Invoice as Incomplete (Save scanned items & resume later)
  const handleDeferAsIncomplete = async () => {
    if (!activeSession) return;

    const session = activeSession;
    const allItems: ScannedAuditItem[] = Object.values(session.items);
    const now = new Date().toISOString();

    let completedItemsCount = 0;
    let missingQty = 0;
    let scannedQty = 0;
    let totalRequiredQty = 0;

    allItems.forEach((item) => {
      totalRequiredQty += item.requiredQty;
      scannedQty += item.actualQty;
      if (item.codeStatus === 'MATCH' && item.qtyStatus === 'EXACT') {
        completedItemsCount += 1;
      }
      if (item.codeStatus === 'MATCH' && item.actualQty < item.requiredQty) {
        missingQty += (item.requiredQty - item.actualQty);
      }
    });

    const incompleteRecord: IncompleteInvoiceRecord = {
      invoiceNo: session.invoiceNo,
      orderNo: session.orderNo,
      savedAt: now,
      session,
      completedItemsCount,
      totalItemsCount: allItems.filter(i => i.codeStatus === 'MATCH').length,
      missingQty,
      scannedQty,
      totalRequiredQty,
    };

    await saveIncompleteInvoice(incompleteRecord);
    await saveActiveSession(null);
    setActiveSession(null);

    await loadAllAuditData();

    setRecentScanFeedback({
      code: session.invoiceNo,
      message: isRtl 
        ? `تم ترحيل الفاتورة الناقصة [${session.invoiceNo}] للاستكمال لاحقاً مع حفظ كافة الأصناف الممسوحة (${scannedQty} قطعة).`
        : `Deferred Incomplete Invoice [${session.invoiceNo}] for later completion (${scannedQty} units preserved).`,
      type: 'surplus',
    });

    focusAndClearInput();
  };

  // Reopen a completed invoice for emergency supervisor re-audit
  const handleReopenInvoice = async (invoiceNo: string) => {
    await reopenCompletedInvoice(invoiceNo);
    setBlockedInvoiceWarning(null);
    await loadAllAuditData();
    await lockInvoiceSession(invoiceNo, true);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualInput.trim();
    if (!code) return;

    if (!activeSession) {
      await lockInvoiceSession(code);
    } else {
      const isKnownInvoice = availableInvoices.some(inv => 
        inv.invoiceNo.toLowerCase() === code.toLowerCase() || 
        (inv.orderNo && inv.orderNo.toLowerCase() === code.toLowerCase())
      );
      if (isKnownInvoice && code.toLowerCase() !== activeSession.invoiceNo.toLowerCase() && code.toLowerCase() !== activeSession.orderNo?.toLowerCase()) {
        // Completing current and switching to next
        await handleFinalizeInvoice(false, code);
      } else {
        await handleItemScan(code);
      }
    }
  };

  // Active session metrics calculation
  const itemsList: ScannedAuditItem[] = activeSession ? Object.values(activeSession.items) : [];
  const totalItemsRequired = itemsList.filter(i => i.codeStatus === 'MATCH').length;
  const exactCount = itemsList.filter(i => i.codeStatus === 'MATCH' && i.qtyStatus === 'EXACT').length;
  const shortageCount = itemsList.filter(i => i.codeStatus === 'MATCH' && i.qtyStatus === 'SHORTAGE').length;
  const surplusCount = itemsList.filter(i => i.qtyStatus === 'SURPLUS').length;
  const mismatchCount = itemsList.filter(i => i.codeStatus === 'MISMATCH').length;
  
  const totalRequiredQuantity = itemsList.reduce((acc, curr) => acc + curr.requiredQty, 0);
  const totalScannedQuantity = itemsList.reduce((acc, curr) => acc + curr.actualQty, 0);
  
  const progressPercent = totalRequiredQuantity > 0 
    ? Math.min(100, Math.round((totalScannedQuantity / totalRequiredQuantity) * 100)) 
    : 0;

  const isInvoice100PercentComplete = totalItemsRequired > 0 && exactCount === totalItemsRequired && mismatchCount === 0 && surplusCount === 0;

  const hasAnyOrderNo = useMemo(() => {
    return Boolean(activeSession?.orderNo || itemsList.some(i => Boolean(i.orderNo)));
  }, [activeSession, itemsList]);

  // Active last-scanned item object for the spotlight focus card
  const lastScannedItem = useMemo(() => {
    if (!activeSession?.lastScannedItemCode) return null;
    return activeSession.items[activeSession.lastScannedItemCode] || null;
  }, [activeSession]);

  // Smart Sorting
  const sortedAndFilteredItems = useMemo(() => {
    let result = itemsList.filter((item) => {
      if (activeTabFilter === 'PENDING') return item.qtyStatus === 'SHORTAGE';
      if (activeTabFilter === 'EXACT') return item.qtyStatus === 'EXACT';
      if (activeTabFilter === 'DISCREPANCIES') return item.codeStatus === 'MISMATCH' || item.qtyStatus === 'SURPLUS' || (item.actualQty > 0 && item.qtyStatus === 'SHORTAGE');
      return true;
    });

    const mode = settings.itemSortMode || 'LAST_SCANNED';

    result = [...result].sort((a, b) => {
      if (mode === 'LAST_SCANNED') {
        const timeA = a.lastScannedAt ? new Date(a.lastScannedAt).getTime() : 0;
        const timeB = b.lastScannedAt ? new Date(b.lastScannedAt).getTime() : 0;
        if (a.actualQty > 0 && b.actualQty === 0) return -1;
        if (b.actualQty > 0 && a.actualQty === 0) return 1;
        return timeB - timeA;
      }
      
      if (mode === 'ORIGINAL_ORDER') {
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      }

      if (mode === 'PENDING_FIRST') {
        if (a.qtyStatus === 'SHORTAGE' && b.qtyStatus !== 'SHORTAGE') return -1;
        if (b.qtyStatus === 'SHORTAGE' && a.qtyStatus !== 'SHORTAGE') return 1;
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      }

      if (mode === 'ERRORS_FIRST') {
        const aHasError = a.codeStatus === 'MISMATCH' || a.qtyStatus === 'SURPLUS';
        const bHasError = b.codeStatus === 'MISMATCH' || b.qtyStatus === 'SURPLUS';
        if (aHasError && !bHasError) return -1;
        if (bHasError && !aHasError) return 1;
        return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
      }

      return 0;
    });

    return result;
  }, [itemsList, activeTabFilter, settings.itemSortMode]);

  return (
    <div className={`space-y-4 ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 🌟 0. BATCH CLOSED & DAILY COUNTERS SNAPSHOT BANNER */}
      {isBatchZeroed && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border-2 border-emerald-500/70 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-800/40">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/40 shadow-inner">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    {isRtl ? 'تم إقفال آخر فاتورة بنجاح' : 'Final Invoice Closed'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {latestDailySnapshot?.closedAt ? new Date(latestDailySnapshot.closedAt).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US') : ''}
                  </span>
                </div>
                <h2 className="text-base font-black text-white mt-1">
                  {isRtl ? 'تم تسجيل قيم عدادات اليوم وتصفير عدادات الفواتير والأخطاء لحين بدء مزامنة جديدة' : 'Today Counters Recorded & Batch Reset Until Next Sync'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenSyncModal}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>{isRtl ? 'بدء مزامنة جديدة (Excel/CSV)' : 'New Manifest Sync'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await resetActiveBatchCountersState();
                  setIsBatchZeroed(false);
                  await loadAllAuditData();
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
                title="تصفير السجل السابق وبدء دورة مسح جديدة"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRtl ? 'تصفير السجل وبدء مسح جديد' : 'Clear Log & Start Fresh'}</span>
              </button>
            </div>
          </div>

          {/* Snapshot KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[11px] text-slate-400 block">{isRtl ? 'إجمالي الفواتير المنجزة' : 'Total Completed Invoices'}</span>
              <span className="text-base font-black font-mono text-emerald-400">
                {latestDailySnapshot?.completedInvoices ?? completedInvoices.length} {isRtl ? 'فاتورة' : 'inv'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[11px] text-slate-400 block">{isRtl ? 'إجمالي القطع المفحوصة' : 'Scanned Units'}</span>
              <span className="text-base font-black font-mono text-blue-400">
                {latestDailySnapshot?.totalScannedQty ?? 0} {isRtl ? 'قطعة' : 'units'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[11px] text-slate-400 block">{isRtl ? 'الأخطاء والنواقص المسجلة' : 'Recorded Errors'}</span>
              <span className="text-base font-black font-mono text-amber-400">
                {latestDailySnapshot?.totalDiscrepancies ?? 0} {isRtl ? 'حالة' : 'errors'}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <span className="text-[11px] text-slate-400 block">{isRtl ? 'المراجع المعتمد' : 'Certified Auditor'}</span>
              <span className="text-xs font-bold text-white truncate block mt-0.5">
                {latestDailySnapshot?.auditorName || settings.auditorName || 'أحمد حمادة'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 1. GLOBAL AUDIT PROGRESS & KPI COUNTER BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md">
        {/* Total Invoices */}
        <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="p-2 bg-blue-950/60 border border-blue-700/40 text-blue-400 rounded-lg shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">{isRtl ? 'إجمالي الفواتير' : 'Total Invoices'}</span>
            <div className="text-base sm:text-lg font-black font-mono text-white">
              {isBatchZeroed ? 0 : availableInvoices.length}
            </div>
          </div>
        </div>

        {/* Completed Invoices (تسجيل الفواتير المكتملة) */}
        <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="p-2 bg-emerald-900/60 border border-emerald-600/40 text-emerald-400 rounded-lg shrink-0">
            <CheckCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-emerald-400 block font-medium">{isRtl ? 'فواتير مكتملة ومقفلة' : 'Completed Invoices'}</span>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-300">
              {isBatchZeroed ? 0 : completedInvoices.length} <span className="text-xs text-slate-400 font-normal">/ {isBatchZeroed ? 0 : availableInvoices.length}</span>
            </div>
          </div>
        </div>

        {/* Incomplete Invoices (الفواتير الناقصة والمرحلة) */}
        <button 
          onClick={() => setIsIncompleteDrawerOpen(true)}
          className="bg-amber-950/40 border border-amber-800/50 hover:bg-amber-950/70 p-2.5 rounded-lg flex items-center justify-between text-left transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-900/60 border border-amber-600/40 text-amber-400 rounded-lg shrink-0">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-amber-400 block font-medium">{isRtl ? 'فواتير مرحلة للاستكمال' : 'Incomplete Queue'}</span>
              <div className="text-base sm:text-lg font-black font-mono text-amber-300">
                {isBatchZeroed ? 0 : incompleteInvoices.length} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'ناقصة' : 'pending'}</span>
              </div>
            </div>
          </div>
          {!isBatchZeroed && incompleteInvoices.length > 0 && (
            <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full shrink-0">
              {isRtl ? 'عرض' : 'View'}
            </span>
          )}
        </button>

        {/* Remaining Invoices */}
        <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="p-2 bg-slate-800 text-slate-400 rounded-lg shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">{isRtl ? 'فواتير متبقية' : 'Remaining Invoices'}</span>
            <div className="text-base sm:text-lg font-black font-mono text-slate-200">
              {isBatchZeroed ? 0 : Math.max(0, availableInvoices.length - completedInvoices.length)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP SCANNER INPUT & WEDGE STATUS BAR */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 sm:p-4 shadow-lg">
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-xs font-semibold text-emerald-300 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t.randomScanBanner}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Logic & Math Guide Button */}
            {onOpenLogicGuide && (
              <button
                type="button"
                onClick={() => onOpenLogicGuide('audit')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 text-[11px] font-bold transition-all shadow-sm"
                title={isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية للتدقيق' : 'Dispatch Audit Logic & Equations'}
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                <span>{isRtl ? 'المنطق والمعادلات 💡' : 'Logic Guide'}</span>
              </button>
            )}

            {/* Quick Internal Discrepancy report trigger */}
            <button
              type="button"
              onClick={() => setIsInternalDiscrepancyOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 text-[11px] font-bold transition-all shadow-sm"
              title="عرض تقرير النواقص والأخطاء (داخلي)"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>{isRtl ? 'الأخطاء والنواقص' : 'Discrepancies'}</span>
              {(discrepancies.length > 0 || wrongPickings.length > 0) && (
                <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded-full font-black">
                  {discrepancies.length + wrongPickings.length}
                </span>
              )}
            </button>

            {/* View Incomplete Queue quick button */}
            {incompleteInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => setIsIncompleteDrawerOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-[11px] font-black transition-all shadow-sm"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>{isRtl ? `استكمال النواقص (${incompleteInvoices.length})` : `Resume Pending (${incompleteInvoices.length})`}</span>
              </button>
            )}

            {/* Quick Camera QR Launcher badge */}
            <button
              type="button"
              onClick={() => setIsCameraQrOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isRtl ? 'كاميرا QR للفاتورة/الأوردر' : 'Camera QR for Invoice/Order'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleInputSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1">
            <div className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-3.5' : 'left-0 pl-3.5'} flex items-center pointer-events-none text-emerald-400`}>
              <ScanLine className="w-5 h-5 animate-pulse" />
            </div>
            <input
              ref={scannerInputRef}
              id="barcode-input"
              data-scanner-input="true"
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={
                !activeSession 
                  ? (isRtl ? 'امسح باركود الفاتورة أو الأوردر بالسكانر لبدء الجرد...' : 'Scan Invoice or Order barcode with scanner to start...')
                  : (isRtl ? 'امسح باركود أي صنف عشوائياً بالسكانر...' : 'Scan ANY item barcode with scanner...')
              }
              className={`w-full ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-slate-950 text-white font-mono text-sm sm:text-base rounded-lg border-2 border-emerald-500/70 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-500`}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>

          {/* Camera QR Button */}
          <button
            type="button"
            onClick={() => setIsCameraQrOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-emerald-500/50 font-bold px-4 py-3 rounded-lg text-sm sm:text-base shadow transition-all whitespace-nowrap"
            title={t.qrScannerBtn}
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{isRtl ? 'مسح QR' : 'Camera QR'}</span>
          </button>

          {/* Action / Enter Button */}
          <button
            type="submit"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg text-sm sm:text-base shadow transition-all whitespace-nowrap"
          >
            <Zap className="w-4 h-4" />
            <span>{!activeSession ? (isRtl ? 'قفل الفاتورة' : 'Lock Invoice') : (isRtl ? 'مسح الصنف' : 'Scan Item')}</span>
          </button>
        </form>

        {/* Live Feedback Toast */}
        {recentScanFeedback && (
          <div className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 border animate-in fade-in slide-in-from-top-1 duration-150 ${
            recentScanFeedback.type === 'exact'
              ? 'bg-emerald-950/90 border-emerald-600/80 text-emerald-200'
              : recentScanFeedback.type === 'mismatch'
                ? 'bg-red-950/90 border-red-600/80 text-red-200'
                : recentScanFeedback.type === 'surplus'
                  ? 'bg-amber-950/90 border-amber-600/80 text-amber-200'
                  : recentScanFeedback.type === 'blocked'
                    ? 'bg-red-950/95 border-red-500 text-red-100 font-bold animate-pulse'
                    : 'bg-blue-950/80 border-blue-600/80 text-blue-200'
          }`}>
            <div className="flex items-center gap-2 truncate">
              {recentScanFeedback.type === 'exact' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {recentScanFeedback.type === 'mismatch' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
              {recentScanFeedback.type === 'surplus' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {recentScanFeedback.type === 'blocked' && <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />}
              {recentScanFeedback.type === 'match' && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
              <span className="truncate">{recentScanFeedback.message}</span>
            </div>
            <span className="font-mono text-[11px] opacity-75 shrink-0">{isRtl ? 'الآن' : 'Just now'}</span>
          </div>
        )}
      </div>

      {/* 3. NO ACTIVE INVOICE SCREEN (Waiting to scan / Lock Invoice) */}
      {!activeSession ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 text-center space-y-6 shadow-md">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 border border-slate-700 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {t.stepATitle}
            </h2>
            <p className="text-sm text-slate-400">
              {t.stepADesc}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsCameraQrOpen(true)}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-950/50 transition-all border border-emerald-400/40"
              >
                <Camera className="w-5 h-5 animate-pulse" />
                <span>{isRtl ? 'مسح QR الفاتورة / الأوردر بالكاميرا' : 'Scan Invoice / Order QR Code with Camera'}</span>
              </button>
            </div>
          </div>

          {/* Quick Picker & Pending Queue */}
          {availableInvoices.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-4 pt-4 border-t border-slate-800 text-left">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-slate-300">
                  {isRtl ? `قائمة فواتير اليوم (${availableInvoices.length}):` : `Today's Invoices Manifest (${availableInvoices.length}):`}
                </span>
                <span className="text-emerald-400 font-mono">{completedInvoices.length} {isRtl ? 'مكتملة ومقفلة' : 'completed'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {availableInvoices.map((inv) => {
                  const isCompleted = completedInvoices.some(c => c.invoiceNo.toLowerCase() === inv.invoiceNo.toLowerCase() || (inv.orderNo && c.orderNo?.toLowerCase() === inv.orderNo.toLowerCase()));
                  const isIncomplete = incompleteInvoices.some(inc => inc.invoiceNo.toLowerCase() === inv.invoiceNo.toLowerCase() || (inv.orderNo && inc.orderNo?.toLowerCase() === inv.orderNo.toLowerCase()));

                  return (
                    <button
                      key={inv.invoiceNo}
                      onClick={() => lockInvoiceSession(inv.invoiceNo)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left group ${
                        isCompleted 
                          ? 'bg-emerald-950/30 border-emerald-800/60 opacity-85 hover:opacity-100 hover:border-emerald-600'
                          : isIncomplete
                            ? 'bg-amber-950/40 border-amber-700 hover:border-amber-500 shadow-md shadow-amber-950/20'
                            : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 hover:border-emerald-500/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${
                          isCompleted ? 'bg-emerald-900/60 text-emerald-400' : isIncomplete ? 'bg-amber-900/60 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isCompleted ? <CheckCheck className="w-4 h-4" /> : isIncomplete ? <PauseCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-mono font-bold text-sm text-white group-hover:text-emerald-300 flex items-center gap-2">
                            <span>{inv.invoiceNo}</span>
                            {inv.orderNo && (
                              <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 font-mono font-normal">
                                {inv.orderNo}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {inv.itemCount} {isRtl ? 'أصناف' : 'items'} &bull; <strong className="text-slate-300">{inv.totalQty} {isRtl ? 'قطعة' : 'qty'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCompleted && (
                          <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                            {isRtl ? 'مكتملة' : 'Done'}
                          </span>
                        )}
                        {isIncomplete && (
                          <span className="text-[10px] font-bold bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full border border-amber-700">
                            {isRtl ? 'استكمال' : 'Resume'}
                          </span>
                        )}
                        <ArrowRight className={`w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors ${isRtl ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-5 max-w-md mx-auto text-xs text-slate-400 space-y-3">
              <p>{isRtl ? 'لا توجد بيانات فواتير محملة لليوم.' : 'No master invoice data loaded yet for today.'}</p>
              <button
                onClick={onOpenSyncModal}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.updateExcel}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 4. ACTIVE INVOICE SESSION DASHBOARD */
        <div className="space-y-4">
          {/* Active Session Header Card */}
          <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
            {/* Top Row: Title + Finish Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 bg-emerald-950 border border-emerald-600/60 rounded-2xl text-emerald-400 shadow-inner">
                  <Package className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-700/60">
                      {t.activeInvoice}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Long Barcode Policy Status Tag */}
                    <div className="flex items-center gap-1.5">
                      {activeSession.longBarcodePolicy === 'ALLOW' && (
                        <button
                          type="button" 
                          onClick={() => handleToggleLongBarcodePolicy('BLOCK')}
                          title={isRtl ? 'اضغط للتبديل إلى حظر الباركود > 10' : 'Click to toggle blocking barcodes > 10'}
                          className="text-[11px] font-bold bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-700/70 flex items-center gap-1 hover:bg-emerald-900 transition-colors shadow-sm"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{isRtl ? 'باركود > 10: مسموح به' : 'Barcode > 10: Allowed'}</span>
                        </button>
                      )}
                      {activeSession.longBarcodePolicy === 'BLOCK' && (
                        <button
                          type="button" 
                          onClick={() => handleToggleLongBarcodePolicy('ALLOW')}
                          title={isRtl ? 'اضغط للتبديل إلى السماح بالباركود > 10' : 'Click to toggle allowing barcodes > 10'}
                          className="text-[11px] font-bold bg-red-950 text-red-300 px-2.5 py-0.5 rounded-full border border-red-700/70 flex items-center gap-1 hover:bg-red-900 transition-colors shadow-sm"
                        >
                          <Ban className="w-3 h-3 text-red-400" />
                          <span>{isRtl ? 'باركود > 10: غير مسموح' : 'Barcode > 10: Blocked'}</span>
                        </button>
                      )}
                      {(!activeSession.longBarcodePolicy || activeSession.longBarcodePolicy === 'ASK') && (
                        <button
                          type="button" 
                          onClick={() => handleToggleLongBarcodePolicy('ALLOW')}
                          title={isRtl ? 'اضغط لضبط الخيار' : 'Click to configure'}
                          className="text-[11px] font-bold bg-amber-950/70 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-700/70 flex items-center gap-1 hover:bg-amber-900 transition-colors shadow-sm"
                        >
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          <span>{isRtl ? 'باركود > 10: تنبيه وتخيير' : 'Barcode > 10: Prompt'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Invoice Number & Order Number with IDENTICAL prominent font size side-by-side */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">{isRtl ? 'فاتورة:' : 'Inv:'}</span>
                      <h2 className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                        {activeSession.invoiceNo}
                      </h2>
                    </div>
                    {activeSession.orderNo && (
                      <div className="flex items-center gap-2 border-r sm:border-r-2 border-slate-700 pr-3 sm:pr-4 rtl:border-r-0 rtl:border-l rtl:pl-3 rtl:sm:pl-4">
                        <span className="text-xs font-bold text-indigo-400 uppercase">{isRtl ? 'أوردر:' : 'Order:'}</span>
                        <h2 className="text-2xl sm:text-3xl font-black font-mono text-indigo-300 tracking-tight">
                          {activeSession.orderNo}
                        </h2>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Finish / Defer Buttons */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* 1. If 100% Match: Prominent Finish & Lock Button */}
                {isInvoice100PercentComplete ? (
                  <button
                    onClick={() => handleFinalizeInvoice(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white font-black px-5 py-3 rounded-xl text-sm shadow-lg shadow-emerald-950/60 transition-all border border-emerald-400/50 animate-pulse"
                  >
                    <CheckCheck className="w-5 h-5" />
                    <span>{isRtl ? 'إنهاء وقفل الفاتورة (مكتملة 100%)' : 'Complete & Lock Invoice (100%)'}</span>
                  </button>
                ) : (
                  <>
                    {/* 2. Defer as Incomplete & Resume Later */}
                    <button
                      onClick={handleDeferAsIncomplete}
                      className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all border border-amber-400/50"
                      title={isRtl ? 'حفظ الأصناف الممسوحة وترحيل الفاتورة للاستكمال لاحقاً' : 'Save scanned items & defer for later completion'}
                    >
                      <PauseCircle className="w-4 h-4" />
                      <span>{isRtl ? 'ترحيل للاستكمال لاحقاً (ناقصة)' : 'Defer as Incomplete'}</span>
                    </button>

                    {/* 3. Finalize with Error Report */}
                    <button
                      onClick={() => handleFinalizeInvoice(false)}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow transition-all border border-slate-700"
                    >
                      <Archive className="w-4 h-4 text-amber-400" />
                      <span>{isRtl ? 'إنهاء وتسجيل النواقص' : 'Finish & Record Errors'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 🌟 PROMINENT TOTAL INVOICE QUANTITY & ITEM COUNT CARDS (Requirement 4) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-inner">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {/* Total Invoice Quantity (الكمية الإجمالية للفاتورة) */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-xs font-semibold mb-1">
                    {isRtl ? 'إجمالي كمية الفاتورة (مطلوب)' : 'Total Invoice Quantity (Req)'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
                    {totalRequiredQuantity} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'قطعة' : 'units'}</span>
                  </div>
                </div>

                {/* Scanned Actual Quantity (الكمية الممسوحة فعلياً) */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-xs font-semibold mb-1">
                    {isRtl ? 'الكمية الممسوحة فعلياً' : 'Total Scanned Quantity'}
                  </span>
                  <div className={`text-2xl sm:text-3xl font-black font-mono ${
                    totalScannedQuantity === totalRequiredQuantity 
                      ? 'text-emerald-300' 
                      : totalScannedQuantity < totalRequiredQuantity 
                        ? 'text-amber-400' 
                        : 'text-purple-400'
                  }`}>
                    {totalScannedQuantity} <span className="text-xs text-slate-400 font-normal">/ {totalRequiredQuantity}</span>
                  </div>
                </div>

                {/* Total Line Items Count (عدد الأصناف / السطور) */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-xs font-semibold mb-1">
                    {isRtl ? 'عدد الأصناف (السطور)' : 'Line Items Count'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
                    {totalItemsRequired} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'صنف' : 'items'}</span>
                  </div>
                </div>

                {/* Exact Matches Count (الأصناف المكتملة) */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-xs font-semibold mb-1">
                    {isRtl ? 'أصناف مكتملة مطابقة' : 'Exact Matched Items'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
                    {exactCount} <span className="text-xs text-slate-400 font-normal">/ {totalItemsRequired}</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Status Pill */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{isRtl ? 'نسبة اكتمال فحص الفاتورة:' : 'Audit Completion:'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                      isInvoice100PercentComplete 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : shortageCount > 0 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    }`}>
                      {isInvoice100PercentComplete 
                        ? (isRtl ? 'جاهزة للإقفال (مكتملة 100%)' : 'Ready to Close (100%)')
                        : shortageCount > 0 
                          ? (isRtl ? `يوجد نواقص (${totalRequiredQuantity - totalScannedQuantity} قطعة)` : `Has Shortages (${totalRequiredQuantity - totalScannedQuantity} units)`)
                          : (isRtl ? 'يوجد زيادات' : 'Has Surplus')}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-mono text-sm">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      progressPercent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 SPOTLIGHT FOCUS CARD: LAST SCANNED ITEM */}
          {lastScannedItem && (
            <div className="bg-slate-900 border-2 border-emerald-400/80 rounded-xl p-4 shadow-xl animate-in zoom-in-95 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl font-bold flex items-center justify-center ${
                    lastScannedItem.codeStatus === 'MISMATCH' 
                      ? 'bg-red-950 border border-red-600 text-red-400 animate-pulse' 
                      : lastScannedItem.qtyStatus === 'EXACT' 
                        ? 'bg-emerald-950 border border-emerald-500 text-emerald-400' 
                        : lastScannedItem.qtyStatus === 'SURPLUS'
                          ? 'bg-amber-950 border border-amber-500 text-amber-400'
                          : 'bg-blue-950 border border-blue-500 text-blue-400'
                  }`}>
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {t.lastScannedTitle}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(lastScannedItem.lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-300 mt-0.5 flex items-center gap-2">
                      <span>{lastScannedItem.itemCode}</span>
                      {lastScannedItem.orderNo && (
                        <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50 font-normal">
                          {lastScannedItem.orderNo}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 font-medium truncate max-w-md">
                      {lastScannedItem.itemName}
                    </div>
                  </div>
                </div>

                {/* Big Count & Quick Adjust Actions */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-center bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">{t.scannedCount} / {t.requiredTarget}</span>
                    <div className="text-2xl font-black font-mono text-white">
                      <span className={lastScannedItem.qtyStatus === 'EXACT' ? 'text-emerald-400' : lastScannedItem.qtyStatus === 'SURPLUS' ? 'text-amber-400' : 'text-blue-400'}>
                        {lastScannedItem.actualQty}
                      </span>
                      <span className="text-sm text-slate-400 font-normal"> / {lastScannedItem.requiredQty} {lastScannedItem.unit}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {lastScannedItem.codeStatus === 'MISMATCH' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-red-950 text-red-400 border border-red-700">
                        {t.statusMismatch}
                      </span>
                    ) : lastScannedItem.qtyStatus === 'EXACT' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-600">
                        {t.statusExact}
                      </span>
                    ) : lastScannedItem.qtyStatus === 'SHORTAGE' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-950 text-amber-400 border border-amber-700">
                        {isRtl ? `متبقي (${lastScannedItem.requiredQty - lastScannedItem.actualQty})` : `Remaining (${lastScannedItem.requiredQty - lastScannedItem.actualQty})`}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-950 text-purple-400 border border-purple-700">
                        {isRtl ? `زيادة (+${lastScannedItem.actualQty - lastScannedItem.requiredQty})` : `Surplus (+${lastScannedItem.actualQty - lastScannedItem.requiredQty})`}
                      </span>
                    )}

                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        onClick={() => adjustItemQuantity(lastScannedItem.itemCode, -1)}
                        disabled={lastScannedItem.actualQty === 0}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30"
                        title="-1"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => adjustItemQuantity(lastScannedItem.itemCode, 1)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded"
                        title="+1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. ITEM TABS & SORT CONTROLS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTabFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTabFilter === 'ALL' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {t.allTab} ({itemsList.length})
                </button>
                <button
                  onClick={() => setActiveTabFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTabFilter === 'PENDING' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {t.pendingTab} ({shortageCount})
                </button>
                <button
                  onClick={() => setActiveTabFilter('EXACT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTabFilter === 'EXACT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {t.exactTab} ({exactCount})
                </button>
                <button
                  onClick={() => setActiveTabFilter('DISCREPANCIES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeTabFilter === 'DISCREPANCIES' ? 'bg-red-950 text-red-300 border border-red-800' : 'text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  {t.discrepanciesTab} ({mismatchCount + surplusCount})
                </button>
              </div>

              {/* Sorting Mode Selector */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 self-end sm:self-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{isRtl ? 'الترتيب:' : 'Sort:'}</span>
                <select
                  value={settings.itemSortMode || 'LAST_SCANNED'}
                  onChange={(e) => onUpdateSettings({ ...settings, itemSortMode: e.target.value as any })}
                  className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                >
                  <option value="LAST_SCANNED">{isRtl ? 'آخر ما تم مسحه (الأحدث أولاً)' : 'Last Scanned First'}</option>
                  <option value="PENDING_FIRST">{isRtl ? 'النواقص أولاً' : 'Pending First'}</option>
                  <option value="ORIGINAL_ORDER">{isRtl ? 'ترتيب ملف الإكسيل' : 'Excel Order'}</option>
                  <option value="ERRORS_FIRST">{isRtl ? 'الأخطاء أولاً' : 'Errors First'}</option>
                </select>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs text-slate-200 font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-start">#</th>
                    <th className="py-2.5 px-3 text-start">{t.thBarcode}</th>
                    <th className="py-2.5 px-3 text-start">{t.thItemName}</th>
                    <th className="py-2.5 px-3 text-center">{t.thRequired}</th>
                    <th className="py-2.5 px-3 text-center">{t.thActual}</th>
                    <th className="py-2.5 px-3 text-center">{t.thDiff}</th>
                    <th className="py-2.5 px-3 text-center">{t.thStatus}</th>
                    <th className="py-2.5 px-3 text-end">{isRtl ? 'تعديل' : 'Adjust'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedAndFilteredItems.map((item, idx) => {
                    const diff = item.actualQty - item.requiredQty;
                    const isLastScanned = activeSession.lastScannedItemCode === item.itemCode;

                    return (
                      <tr 
                        key={item.itemCode}
                        className={`transition-colors ${
                          isLastScanned 
                            ? 'bg-emerald-950/40 font-semibold' 
                            : item.codeStatus === 'MISMATCH' 
                              ? 'bg-red-950/30' 
                              : item.qtyStatus === 'SURPLUS'
                                ? 'bg-amber-950/20'
                                : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400 text-start">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-start font-bold text-white">
                          <span>{item.itemCode}</span>
                          {item.orderNo && (
                            <span className="block text-[10px] text-indigo-400 font-normal">
                              {item.orderNo}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-start text-slate-300 font-sans truncate max-w-xs">{item.itemName}</td>
                        <td className="py-2.5 px-3 text-center text-slate-400">{item.requiredQty} {item.unit}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-white">
                          <span className={item.qtyStatus === 'EXACT' ? 'text-emerald-400' : item.qtyStatus === 'SURPLUS' ? 'text-amber-400' : 'text-blue-400'}>
                            {item.actualQty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {diff === 0 ? (
                            <span className="text-emerald-400">0</span>
                          ) : diff < 0 ? (
                            <span className="text-amber-400">{diff}</span>
                          ) : (
                            <span className="text-purple-400">+{diff}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.codeStatus === 'MISMATCH' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                              {t.statusMismatch}
                            </span>
                          ) : item.qtyStatus === 'EXACT' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              {t.statusExact}
                            </span>
                          ) : item.qtyStatus === 'SHORTAGE' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                              {isRtl ? 'نقص' : 'SHORTAGE'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-400 border border-purple-800">
                              {isRtl ? 'زيادة' : 'SURPLUS'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-end">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              onClick={() => adjustItemQuantity(item.itemCode, -1)}
                              disabled={item.actualQty === 0}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30"
                              title="-1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => adjustItemQuantity(item.itemCode, 1)}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded"
                              title="+1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 6. BLOCKED COMPLETED INVOICE WARNING MODAL (Requirement 2) */}
      {blockedInvoiceWarning && (
        <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-6 shadow-2xl max-w-lg w-full text-slate-100 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950 border border-red-700 rounded-xl">
                <ShieldAlert className="w-7 h-7 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {isRtl ? 'تحذير: الفاتورة مكتملة ومقفلة مسبقاً!' : 'Warning: Invoice Already Completed & Closed!'}
                </h3>
                <p className="text-xs text-red-300 font-mono">
                  {isRtl ? 'رقم الفاتورة:' : 'Invoice No:'} <strong className="text-white">{blockedInvoiceWarning.invoiceNo}</strong>
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">{isRtl ? 'تاريخ ووقت الاكتمال:' : 'Completed At:'}</span>
                <span className="text-white font-bold">{new Date(blockedInvoiceWarning.completedRecord.completedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isRtl ? 'إجمالي الكمية المدققة:' : 'Audited Total Qty:'}</span>
                <span className="text-emerald-400 font-bold">{blockedInvoiceWarning.completedRecord.totalQty} {isRtl ? 'قطعة' : 'units'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isRtl ? 'عدد الأصناف:' : 'Line Items:'}</span>
                <span className="text-white font-bold">{blockedInvoiceWarning.completedRecord.totalItems} {isRtl ? 'صنف' : 'items'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isRtl 
                ? 'تم قفل الفاتورة تلقائياً لمنع تكرار مسحها أو إدخال بضاعة مضاعفة. إذا كنت ترغب في إعادة فحصها يرجى الضغط على زر إعادة الفتح أدناه.'
                : 'This invoice was locked automatically to prevent accidental duplicate scanning. You can force reopen it below if required.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBlockedInvoiceWarning(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors"
              >
                {isRtl ? 'إلغاء وإغلاق' : 'Dismiss'}
              </button>
              <button
                onClick={() => handleReopenInvoice(blockedInvoiceWarning.invoiceNo)}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition-colors"
              >
                {isRtl ? '🔓 إعادة فتح اضطراري للمراجعة' : '🔓 Force Reopen for Re-Audit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 7. INCOMPLETE INVOICES DRAWER (Requirement 3: الفواتير الناقصة والمرحلة) */}
      {isIncompleteDrawerOpen && (
        <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-slate-900 border-2 border-amber-600/70 rounded-2xl shadow-2xl max-w-2xl w-full text-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-950 text-amber-400 rounded-xl border border-amber-700/50">
                  <PauseCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {isRtl ? 'قائمة الفواتير الناقصة والمرحلة للاستكمال' : 'Incomplete Invoices Queue'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRtl ? 'فواتير تم حفظ ما تم مسحه منها وجاهزة لمتابعة فحص النواقص' : 'Invoices with saved partial scans ready to resume'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIncompleteDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {incompleteInvoices.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {isRtl ? 'لا توجد فواتير ناقصة أو مرحلة حالياً.' : 'No incomplete invoices currently in queue.'}
                </div>
              ) : (
                incompleteInvoices.map((inc) => (
                  <div
                    key={inc.invoiceNo}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/60 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black font-mono text-white">{inc.invoiceNo}</span>
                        {inc.orderNo && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700 font-mono">
                            {inc.orderNo}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(inc.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                        <span>{isRtl ? 'المطابق:' : 'Completed:'} <strong className="text-emerald-400">{inc.completedItemsCount}/{inc.totalItemsCount} {isRtl ? 'صنف' : 'items'}</strong></span>
                        <span>&bull;</span>
                        <span>{isRtl ? 'النواقص المتبقية:' : 'Missing:'} <strong className="text-amber-400">{inc.missingQty} {isRtl ? 'قطعة' : 'units'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={async () => {
                          setIsIncompleteDrawerOpen(false);
                          await lockInvoiceSession(inc.invoiceNo);
                        }}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isRtl ? 'استكمال المسح الآن' : 'Resume Audit'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 text-end">
              <button
                onClick={() => setIsIncompleteDrawerOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 8. LONG BARCODE ALERT & DECISION MODAL (> 10 digits) */}
      {longBarcodePrompt && longBarcodePrompt.isOpen && (
        <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full text-slate-100 animate-in zoom-in-95 duration-150 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 text-amber-400 pb-3 border-b border-slate-800">
              <div className="p-3 bg-amber-950 border border-amber-600/70 rounded-xl">
                <AlertTriangle className="w-7 h-7 animate-pulse text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {isRtl ? 'تنبيه: باركود أطول من 10 أرقام!' : 'Alert: Barcode Longer Than 10 Digits!'}
                </h3>
                <p className="text-xs text-amber-300">
                  {isRtl 
                    ? `تم رصد باركود بطول (${longBarcodePrompt.length}) رقم. لم يتم تسجيله تلقائياً حتى تحدد الإجراء:` 
                    : `Detected barcode with (${longBarcodePrompt.length}) digits. Not recorded yet:`}
                </p>
              </div>
            </div>

            {/* Scanned Barcode Display */}
            <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <ScanLine className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-mono font-black text-sm sm:text-base text-amber-300 tracking-wider break-all">
                  {longBarcodePrompt.barcode}
                </span>
              </div>
              <span className="text-xs font-bold bg-amber-950 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-700 font-mono shrink-0">
                {longBarcodePrompt.length} {isRtl ? 'أرقام' : 'digits'}
              </span>
            </div>

            {/* Options Explanation */}
            <div className="text-xs text-slate-300 space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 leading-relaxed">
              <p className="text-slate-200 font-semibold mb-1">
                {isRtl ? 'اختر الإجراء المناسب لهذه الجلسة:' : 'Choose action for this audit session:'}
              </p>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex items-start gap-1.5 text-emerald-400">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{isRtl ? 'سماح:' : 'Allow:'}</strong> {isRtl ? 'تسجيل هذا الباركود واعتماد قبول أي باركود > 10 أرقام طوال الجلسة بدون تنبيه.' : 'Record barcode and allow all > 10 digits for the rest of session without alerts.'}</span>
                </div>
                <div className="flex items-start gap-1.5 text-red-400">
                  <Ban className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{isRtl ? 'عدم السماح:' : 'Block:'}</strong> {isRtl ? 'عدم تسجيل هذا الباركود وحظر أي باركود > 10 أرقام طوال الجلسة بدون تنبيه.' : 'Do not record, and block all > 10 digits for the rest of session without alerts.'}</span>
                </div>
                <div className="flex items-start gap-1.5 text-amber-300">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <span><strong>{isRtl ? 'قرر لاحقاً:' : 'Decide Later:'}</strong> {isRtl ? 'تخطي هذا الباركود دون تسجيل، واستمرار التنبيه عند مسح باركودات طويلة أخرى.' : 'Skip this barcode without recording; alert will prompt again for future long barcodes.'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              {/* 1. ALLOW (سماح) */}
              <button
                type="button"
                onClick={handleLongBarcodeAllow}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black py-3 px-3 rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-950/40 transition-all border border-emerald-400/40"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isRtl ? 'سماح' : 'Allow'}</span>
              </button>

              {/* 2. BLOCK (عدم السماح) */}
              <button
                type="button"
                onClick={handleLongBarcodeBlock}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black py-3 px-3 rounded-xl text-xs sm:text-sm shadow-md shadow-red-950/40 transition-all border border-red-400/40"
              >
                <Ban className="w-4 h-4 stroke-[3]" />
                <span>{isRtl ? 'عدم السماح' : 'Block'}</span>
              </button>

              {/* 3. DECIDE LATER (قرر لاحقاً) */}
              <button
                type="button"
                onClick={handleLongBarcodeDecideLater}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-amber-300 font-black py-3 px-3 rounded-xl text-xs sm:text-sm shadow transition-all border border-slate-700 hover:border-amber-500/50"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{isRtl ? 'قرر لاحقاً' : 'Decide Later'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera QR Modal */}
      <CameraQrScannerModal
        isOpen={isCameraQrOpen}
        onClose={() => setIsCameraQrOpen(false)}
        onScanSuccess={async (scannedCode) => {
          setIsCameraQrOpen(false);
          if (!activeSession) {
            await lockInvoiceSession(scannedCode);
          } else {
            await handleItemScan(scannedCode);
          }
        }}
        expectedType={!activeSession ? 'INVOICE_OR_ORDER' : 'ITEM_OR_INVOICE'}
        activeInvoiceNo={activeSession?.invoiceNo}
      />

      {/* Internal Discrepancies Modal (خدمة داخلية مكررة في الواجهة) */}
      <InternalDiscrepancyModal
        isOpen={isInternalDiscrepancyOpen}
        onClose={() => setIsInternalDiscrepancyOpen(false)}
        discrepancies={discrepancies}
        wrongPickings={wrongPickings}
        onRefresh={onRefreshDiscrepancies}
        settings={settings}
      />
    </div>
  );
};
