import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  FileText,
  Upload,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Search,
  ScanLine,
  Filter,
  DollarSign,
  PackageCheck,
  FlaskConical,
  Clock,
  Send,
  CreditCard,
  Building2,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Check,
  X,
  FileCheck2,
  Mail,
  AlertCircle,
  Truck,
  Zap,
  CheckCheck,
  Files,
  FolderPlus,
  ListFilter,
  SlidersHorizontal,
  FileUp,
  List,
  BookOpen
} from 'lucide-react';
import type { 
  AppSettings, 
  ReturnReport, 
  ReturnSessionItem, 
  ReturnItemCondition, 
  PaymentMethod,
  ReturnReportStatus,
  LabDecision,
  RefundRequestRecord,
  AuditDiscrepancy,
  WrongPickingRecord
} from '../types';
import { parsePdfInvoice } from '../services/pdfService';
import { 
  parseExcelOrCsvFile, 
  exportReturnReportToExcel, 
  exportReturnReportToPdf,
  exportCompletedReturnsToExcel,
  exportCompletedRefundsToExcel,
  exportPendingLabReportsToExcel,
  exportSaturdayWeeklyLabReportToExcel,
  exportRefundRequestExcelFormatted,
  exportAllRefundRequestsExcelFormatted
} from '../services/excelService';
import { 
  getAllReturnReports, 
  saveReturnReport, 
  deleteReturnReport,
  getOverdueLabReportsCount,
  saveMasterItems 
} from '../services/db';
import { SoundEffects } from '../services/audio';
import { ReopenConfirmationModal } from './ReopenConfirmationModal';
import { InternalDiscrepancyModal } from './InternalDiscrepancyModal';
import { PdfBatchUploadModal, type BatchExtractionResult } from './PdfBatchUploadModal';

interface ReturnsScreenProps {
  settings: AppSettings;
  lastScannedCode?: string | null;
  onOpenAuditorModal?: () => void;
  onTransferToAudit?: (invoiceNo: string, items?: Array<{ itemCode: string; itemName: string; unit: string; requiredQty: number; orderNo?: string }>) => void;
  discrepancies?: AuditDiscrepancy[];
  wrongPickings?: WrongPickingRecord[];
  onRefreshDiscrepancies?: () => void;
  onOpenLogicGuide?: (tab?: string) => void;
}

type ReturnsSubTab = 'editor' | 'pending_lab' | 'weekly_lab_report' | 'refunds' | 'completed_archive';

export const ReturnsScreen: React.FC<ReturnsScreenProps> = ({
  settings,
  lastScannedCode,
  onOpenAuditorModal,
  onTransferToAudit,
  discrepancies = [],
  wrongPickings = [],
  onRefreshDiscrepancies = () => {},
  onOpenLogicGuide,
}) => {
  const isRtl = settings.language === 'ar';

  // Navigation tab inside Returns
  const [activeSubTab, setActiveSubTab] = useState<ReturnsSubTab>('editor');

  // Helper: Format Return Receipt # as 'return' + Order Number without spaces/delimiters
  const formatReturnReceiptNo = (order: string): string => {
    if (!order) return '';
    const trimmed = order.trim();
    if (!trimmed) return '';
    const clean = trimmed.replace(/^(?:return|new)/i, '').trim();
    return `return${clean || trimmed}`;
  };

  // Active Return Session State (Goods Receipt Under Inspection - استلام تحت الفحص)
  const [returnReceiptNo, setReturnReceiptNo] = useState('');
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [returnItems, setReturnItems] = useState<ReturnSessionItem[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [scanNotification, setScanNotification] = useState<{ message: string; type: 'INVOICE' | 'ORDER' | 'ITEM' } | null>(null);

  // Full Return vs Scan-driven Return State
  const [isFullInvoiceReturn, setIsFullInvoiceReturn] = useState<boolean>(false);
  const [isInternalDiscrepancyOpen, setIsInternalDiscrepancyOpen] = useState<boolean>(false);

  // Filtering & Scanning State
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedConditionFilter, setSelectedConditionFilter] = useState<string>('ALL');
  const [scanStatusFilter, setScanStatusFilter] = useState<'ALL' | 'SCANNED_FULL' | 'SCANNED_PARTIAL' | 'NOT_SCANNED' | 'OVER_SCANNED' | 'VALID_FOR_RESTOCK' | 'TRANSFERRED_TO_LAB'>('ALL');
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isPdfBatchModalOpen, setIsPdfBatchModalOpen] = useState(false);
  const [pdfBatchProgress, setPdfBatchProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [uploadedBatchFiles, setUploadedBatchFiles] = useState<{ name: string; invoiceNo?: string; count: number; totalQty: number }[]>([]);
  const [manualBarcode, setManualBarcode] = useState('');

  // Database Saved Reports
  const [savedReports, setSavedReports] = useState<ReturnReport[]>([]);

  // Lab Review Modal for Suspended Reports (مراجعة المعمل وإعادة الاستلام)
  const [selectedReportForLabReview, setSelectedReportForLabReview] = useState<ReturnReport | null>(null);
  const [labReviewNotes, setLabReviewNotes] = useState('');
  const [labAuditorName, setLabAuditorName] = useState(settings.auditorName || 'أخصائي الجودة');

  // Email Dispatch Modal to Officer
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [officerEmail, setOfficerEmail] = useState('finance-returns@company.com');
  const [officerRole, setOfficerRole] = useState<'FINANCE' | 'RETURNS_MGR' | 'STORE_MGR'>('FINANCE');
  const [emailCopiedNotice, setEmailCopiedNotice] = useState(false);

  // Reopen Confirmation Prompt State (الموافقة المشروطة لإعادة فتح المستندات المكتملة)
  const [reopenPrompt, setReopenPrompt] = useState<{
    isOpen: boolean;
    report: ReturnReport | null;
    type: 'RETURN' | 'REFUND';
  }>({
    isOpen: false,
    report: null,
    type: 'RETURN',
  });

  // Read-only Details View Modal
  const [viewingReportModal, setViewingReportModal] = useState<ReturnReport | null>(null);

  // Handle Order Number manual input or paste (auto-formats returnReceiptNo as new+orderNo)
  const handleOrderNoChange = (val: string) => {
    setOrderNo(val);
    const receipt = formatReturnReceiptNo(val);
    if (receipt) {
      setReturnReceiptNo(receipt);
    }
  };

  // Reopen approved document for modifications
  const handleConfirmReopen = () => {
    if (!reopenPrompt.report) return;
    const target = reopenPrompt.report;

    setReturnReceiptNo(target.returnReceiptNo);
    setOriginalInvoiceNo(target.originalInvoiceNo);
    setOrderNo(target.orderNo || '');
    setCustomerName(target.customerName || '');
    setPaymentMethod(target.paymentMethod || 'CASH');
    setReturnItems(target.items ? JSON.parse(JSON.stringify(target.items)) : []);
    setGeneralNotes(target.notes || '');

    setReopenPrompt({ isOpen: false, report: null, type: 'RETURN' });
    setActiveSubTab('editor');

    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
  };

  // Load saved return reports
  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    const list = await getAllReturnReports();
    setSavedReports(list);
  };

  // Auto-dismiss scan notification banner
  useEffect(() => {
    if (!scanNotification) return;
    const timer = setTimeout(() => setScanNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [scanNotification]);

  // Hardware Scanner Integration with Smart Routing:
  // - Starts with 204: Routes to Invoice Number
  // - Starts with 200 or new200: Routes to Order Number & Return Receipt Number (new+orderNo)
  // - Other: Routes to Item barcode matching / addition
  useEffect(() => {
    if (!lastScannedCode || activeSubTab !== 'editor') return;
    const clean = lastScannedCode.trim();
    if (!clean) return;

    // 1. Barcode starting with 204 from left -> Invoice Number
    if (/^204\d*/i.test(clean) && clean.length >= 4) {
      setOriginalInvoiceNo(clean);
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? `✅ تم التعرف على رقم الفاتورة الأصلية وتسجيلها: (${clean})`
          : `✅ Original Invoice # Recorded: (${clean})`,
        type: 'INVOICE'
      });
      return;
    }

    // 2. Barcode starting with 200 or return200 / new200 -> Order Number on shipping order & Return Receipt # (return+orderNo)
    if (/^(?:return|new)?200\d*/i.test(clean) && clean.length >= 4) {
      const cleanOrder = clean.replace(/^(?:return|new)/i, '').trim();
      const finalOrder = cleanOrder || clean;
      const receipt = formatReturnReceiptNo(finalOrder);
      setOrderNo(finalOrder);
      setReturnReceiptNo(receipt);
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? `✅ تم تسجيل رقم الطلب (${finalOrder}) وإذن استلام المرتجع (${receipt}) من باركود أمر الشحن`
          : `✅ Order # (${finalOrder}) & Return Receipt # (${receipt}) Recorded from shipping barcode`,
        type: 'ORDER'
      });
      return;
    }

    // 3. Otherwise: Process as Item Barcode
    setReturnItems(prev => {
      // Prioritize items where scannedQty < invoicedQty for smooth multi-invoice workflow
      const pendingIdx = prev.findIndex(i => i.itemCode.toLowerCase() === clean.toLowerCase() && (i.scannedQty || 0) < i.invoicedQty);
      const idx = pendingIdx !== -1 ? pendingIdx : prev.findIndex(i => i.itemCode.toLowerCase() === clean.toLowerCase());

      if (idx !== -1) {
        const updated = [...prev];
        const current = updated[idx];
        const nextScanned = current.scannedQty + 1;
        const nextReturned = Math.max(current.actualReturnedQty, nextScanned);
        const invoicedQty = Number(current.invoicedQty) || 1;
        const itemSubtotal = current.subtotal || (invoicedQty * (current.unitPrice || 0));
        const unitRate = invoicedQty > 0 ? (itemSubtotal / invoicedQty) : (current.unitPrice || 0);
        const computedRefund = (nextReturned === invoicedQty && itemSubtotal > 0)
          ? itemSubtotal
          : Number((nextReturned * unitRate).toFixed(2));

        updated[idx] = {
          ...current,
          scannedQty: nextScanned,
          actualReturnedQty: nextReturned,
          refundTotal: computedRefund
        };
        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
        return updated;
      } else {
        const newItem: ReturnSessionItem = {
          id: `ret-scan-${Date.now()}`,
          itemCode: clean,
          itemName: `صنف ممسوح ${clean}`,
          unit: 'PCS',
          invoicedQty: 1,
          subtotal: 0,
          actualReturnedQty: 1,
          scannedQty: 1,
          unitPrice: 0,
          refundTotal: 0,
          condition: 'VALID_FOR_RESTOCK', // Default: صالحة للارتجاع للمستودع
          inspectionDecision: 'WAREHOUSE',
          size: 'L',
          color: 'أبيض',
          packagingCondition: 'مغلق بتغليف المصنع',
          reasonText: 'رفض العميل الاستلام',
          inspectorName: settings.auditorName || 'أحمد عيد',
          isIncludedInRefund: true,
          notes: 'صنف تم مسحه من واقع الفاتورة'
        };
        if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
        return [newItem, ...prev];
      }
    });
  }, [lastScannedCode, activeSubTab, settings.soundEnabled, settings.soundVolume, isRtl]);

  // Toggle full invoice return (ارتجاع الفاتورة كاملة)
  const handleToggleFullInvoiceReturn = (enable: boolean) => {
    setIsFullInvoiceReturn(enable);
    setReturnItems(prev => prev.map(item => {
      const targetQty = enable ? item.invoicedQty : item.scannedQty;
      const invoicedQty = Number(item.invoicedQty) || 1;
      const itemSubtotal = item.subtotal || (invoicedQty * (item.unitPrice || 0));
      const unitRate = invoicedQty > 0 ? (itemSubtotal / invoicedQty) : (item.unitPrice || 0);
      const computedRefund = (targetQty === invoicedQty && itemSubtotal > 0)
        ? itemSubtotal
        : Number((targetQty * unitRate).toFixed(2));

      return {
        ...item,
        actualReturnedQty: targetQty,
        scannedQty: enable ? item.invoicedQty : item.scannedQty,
        refundTotal: computedRefund,
      };
    }));
    if (enable) {
      if (settings.soundEnabled) SoundEffects.playExactComplete(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? '⚡ تم تفعيل ارتجاع الفاتورة كاملة (100% مطابقة لكافة الكميات).' 
          : '⚡ Full invoice return activated (100% quantity match).',
        type: 'INVOICE'
      });
    } else {
      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? 'تم التحويل لوضع التحقق والارتجاع بالمسح الفعلي بالسكانر.' 
          : 'Switched to scan-driven return verification.',
        type: 'INVOICE'
      });
    }
  };

  // Direct sync to Dispatch Audit Workstation (تأكيد ومراجعة في خدمة مدقق الفواتير والتجهيز)
  const handleSyncToAuditWorkstation = async () => {
    if (returnItems.length === 0 || !originalInvoiceNo.trim()) {
      alert(isRtl ? 'يرجى التأكد من استخلاص أصناف الفاتورة ورقم الفاتورة الأصلية أولاً.' : 'Please load invoice items and invoice number first.');
      return;
    }
    const masterItemsToSave = returnItems.map((item, idx) => ({
      invoiceNo: originalInvoiceNo.trim(),
      orderNo: orderNo.trim() || undefined,
      itemCode: item.itemCode,
      itemName: item.itemName,
      unit: item.unit || 'PCS',
      requiredQty: isFullInvoiceReturn ? item.invoicedQty : (item.actualReturnedQty > 0 ? item.actualReturnedQty : item.invoicedQty),
      originalIndex: idx,
    }));
    
    await saveMasterItems(masterItemsToSave);
    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);

    if (onTransferToAudit) {
      onTransferToAudit(originalInvoiceNo.trim(), masterItemsToSave);
    } else {
      alert(isRtl 
        ? `✅ تم تسجيل ${masterItemsToSave.length} صنف في قاعدة بيانات الفحص. انتقل إلى خدمة مدقق الفواتير لبدء المسح.` 
        : `✅ Synced ${masterItemsToSave.length} items to audit database.`
      );
    }
  };

  // Handle PDF Smart Extraction (Supports single and multiple batch PDFs + append mode)
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>, appendMode: boolean = false) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);

    setIsLoadingPdf(true);
    const newItems: ReturnSessionItem[] = [];
    const docNumbers: string[] = [];
    const orderNumbers: string[] = [];
    const customerNames: string[] = [];
    const paymentMethods: string[] = [];
    const fileSummaries: { name: string; invoiceNo?: string; count: number; totalQty: number }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setPdfBatchProgress({ current: i + 1, total: files.length, filename: file.name });
        
        try {
          const extracted = await parsePdfInvoice(file, false);
          if (extracted.documentNo && !docNumbers.includes(extracted.documentNo)) {
            docNumbers.push(extracted.documentNo);
          }
          if (extracted.orderNo) {
            const cleanOrder = extracted.orderNo.replace(/^(?:return|new)/i, '').trim();
            if (cleanOrder && !orderNumbers.includes(cleanOrder)) {
              orderNumbers.push(cleanOrder);
            }
          }
          if (extracted.customerName && !customerNames.includes(extracted.customerName)) {
            customerNames.push(extracted.customerName);
          }
          if (extracted.paymentMethod && !paymentMethods.includes(extracted.paymentMethod)) {
            paymentMethods.push(extracted.paymentMethod);
          }

          let fileTotalQty = 0;
          const itemsFromFile: ReturnSessionItem[] = extracted.items.map((item, itemIdx) => {
            const itemSubtotal = item.subtotal || item.totalPrice || (item.unitPrice ? item.quantity * item.unitPrice : 0);
            const invoicedQuantity = item.quantity || 1;
            fileTotalQty += invoicedQuantity;
            const computedUnitPrice = (invoicedQuantity > 0 && itemSubtotal > 0)
              ? Number((itemSubtotal / invoicedQuantity).toFixed(2))
              : (item.unitPrice || 0);

            const initialQty = isFullInvoiceReturn ? invoicedQuantity : 0;
            const computedRefund = (initialQty === invoicedQuantity && itemSubtotal > 0)
              ? itemSubtotal
              : Number((initialQty * (itemSubtotal > 0 ? itemSubtotal / invoicedQuantity : computedUnitPrice)).toFixed(2));

            return {
              id: item.id || `ret-pdf-${Date.now()}-${i}-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`,
              itemCode: item.itemCode,
              itemName: item.itemName,
              unit: item.unit || 'PCS',
              invoiceNo: extracted.documentNo || undefined,
              sourceFile: file.name,
              invoicedQty: invoicedQuantity,
              subtotal: itemSubtotal,
              actualReturnedQty: initialQty,
              scannedQty: initialQty,
              unitPrice: computedUnitPrice,
              refundTotal: computedRefund,
              condition: 'VALID_FOR_RESTOCK',
              inspectionDecision: 'WAREHOUSE',
              size: 'L',
              color: 'أبيض',
              packagingCondition: 'مغلق بتغليف المصنع',
              reasonText: 'رفض العميل الاستلام',
              inspectorName: settings.auditorName || 'أحمد عيد',
              isIncludedInRefund: true,
              notes: '',
            };
          });

          newItems.push(...itemsFromFile);
          fileSummaries.push({
            name: file.name,
            invoiceNo: extracted.documentNo,
            count: itemsFromFile.length,
            totalQty: fileTotalQty,
          });
        } catch (fileErr) {
          console.error(`Error parsing ${file.name}:`, fileErr);
        }
      }

      if (newItems.length === 0) {
        alert(isRtl ? 'لم يتم العثور على جداول أصناف في الملفات المحددة.' : 'No items found in selected PDF files.');
        return;
      }

      // Update Session Metadata & State
      if (appendMode) {
        setReturnItems(prev => [...prev, ...newItems]);
        setUploadedBatchFiles(prev => [...prev, ...fileSummaries]);
        if (docNumbers.length > 0) {
          const currentInvoices = originalInvoiceNo ? originalInvoiceNo.split(/[,،]\s*/).map(s => s.trim()) : [];
          const mergedInvs = Array.from(new Set([...currentInvoices, ...docNumbers]));
          setOriginalInvoiceNo(mergedInvs.join(', '));
        }
      } else {
        setReturnItems(newItems);
        setUploadedBatchFiles(fileSummaries);
        if (docNumbers.length > 0) {
          setOriginalInvoiceNo(docNumbers.join(', '));
        }
        if (orderNumbers.length > 0) {
          setOrderNo(orderNumbers.join(', '));
          setReturnReceiptNo(formatReturnReceiptNo(orderNumbers[0]));
        }
        if (customerNames.length > 0) {
          setCustomerName(customerNames.join(' / '));
        }
        if (paymentMethods.length > 0) {
          setPaymentMethod(paymentMethods.join(' / '));
        }
      }

      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? `✅ تم استخلاص ${files.length} ملف/ملفات PDF بنجاح (إجمالي ${newItems.length} صنف). ابدأ المسح للتحقق والفلترة.` 
          : `✅ Extracted ${files.length} PDF file(s) successfully (${newItems.length} items total). Ready for scan & filter.`,
        type: 'INVOICE'
      });
    } catch (err) {
      alert(`خطأ في قراءة ملفات PDF: ${(err as Error).message}`);
    } finally {
      setIsLoadingPdf(false);
      setPdfBatchProgress(null);
      e.target.value = '';
    }
  };

  // Handle completion from full interactive PdfBatchUploadModal
  const handleBatchExtractionComplete = (result: BatchExtractionResult) => {
    if (result.appendMode) {
      setReturnItems(prev => [...prev, ...result.items]);
      setUploadedBatchFiles(prev => [...prev, ...result.fileSummaries]);
      if (result.originalInvoiceNos.length > 0) {
        const currentInvoices = originalInvoiceNo ? originalInvoiceNo.split(/[,،]\s*/).map(s => s.trim()) : [];
        const mergedInvs = Array.from(new Set([...currentInvoices, ...result.originalInvoiceNos]));
        setOriginalInvoiceNo(mergedInvs.join(', '));
      }
    } else {
      setReturnItems(result.items);
      setUploadedBatchFiles(result.fileSummaries);
      if (result.originalInvoiceNos.length > 0) {
        setOriginalInvoiceNo(result.originalInvoiceNos.join(', '));
      }
      if (result.orderNos.length > 0) {
        setOrderNo(result.orderNos.join(', '));
        setReturnReceiptNo(formatReturnReceiptNo(result.orderNos[0]));
      }
      if (result.customerNames.length > 0) {
        setCustomerName(result.customerNames.join(' / '));
      }
      if (result.paymentMethods.length > 0) {
        setPaymentMethod(result.paymentMethods[0]);
      }
    }

    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
    setScanNotification({
      message: isRtl 
        ? `✅ تم استخلاص ${result.fileSummaries.length} ملف PDF بنجاح (إجمالي ${result.items.length} صنف). جاهز للمسح بالسكانر والفلترة.` 
        : `✅ Extracted ${result.fileSummaries.length} PDF file(s) successfully (${result.items.length} items). Ready for scan & filter.`,
      type: 'INVOICE'
    });
  };

  // Handle Excel Upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelOrCsvFile(file);
      if (parsed.items.length > 0) {
        if (parsed.items[0].invoiceNo) setOriginalInvoiceNo(parsed.items[0].invoiceNo);
        if (parsed.items[0].orderNo) {
          const cleanOrder = parsed.items[0].orderNo.replace(/^new/i, '').trim();
          const finalOrder = cleanOrder || parsed.items[0].orderNo;
          setOrderNo(finalOrder);
          setReturnReceiptNo(formatReturnReceiptNo(finalOrder));
        }
        
        const items: ReturnSessionItem[] = parsed.items.map((item, idx) => {
          const initialQty = isFullInvoiceReturn ? item.requiredQty : 0;
          return {
            id: `ret-excel-${idx}-${Date.now()}`,
            itemCode: item.itemCode,
            itemName: item.itemName,
            unit: item.unit,
            invoicedQty: item.requiredQty,
            actualReturnedQty: initialQty,
            scannedQty: initialQty,
            unitPrice: 0,
            refundTotal: 0,
            condition: 'VALID_FOR_RESTOCK',
            isIncludedInRefund: true,
          };
        });
        setReturnItems(items);
        if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      }
    } catch (err) {
      alert(`خطأ في قراءة ملف Excel: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Update item field directly with subtotal-derived unit price and partial return equations
  const handleUpdateItem = (id: string, updates: Partial<ReturnSessionItem>) => {
    setReturnItems(prev => prev.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updates };
        const invoicedQty = Number(merged.invoicedQty) || 1;
        const actualQty = Number(merged.actualReturnedQty) || 0;

        if (updates.subtotal !== undefined) {
          const sub = Number(updates.subtotal) || 0;
          merged.subtotal = sub;
          merged.unitPrice = invoicedQty > 0 ? Number((sub / invoicedQty).toFixed(2)) : 0;
        } else if (updates.unitPrice !== undefined) {
          const up = Number(updates.unitPrice) || 0;
          merged.unitPrice = up;
          if (merged.subtotal === undefined || merged.subtotal === 0) {
            merged.subtotal = Number((invoicedQty * up).toFixed(2));
          }
        }

        const itemSubtotal = merged.subtotal || (invoicedQty * (merged.unitPrice || 0));
        const unitRate = invoicedQty > 0 ? (itemSubtotal / invoicedQty) : (merged.unitPrice || 0);

        if (actualQty === invoicedQty && itemSubtotal > 0) {
          merged.refundTotal = itemSubtotal;
        } else {
          merged.refundTotal = Number((actualQty * unitRate).toFixed(2));
        }

        return merged;
      }
      return item;
    }));
  };

  // Toggle item condition between VALID_FOR_RESTOCK and TRANSFERRED_TO_LAB
  const handleToggleCondition = (id: string) => {
    setReturnItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextCondition: ReturnItemCondition = 
          item.condition === 'VALID_FOR_RESTOCK' ? 'TRANSFERRED_TO_LAB' : 'VALID_FOR_RESTOCK';
        return {
          ...item,
          condition: nextCondition,
          labDecision: nextCondition === 'TRANSFERRED_TO_LAB' ? 'PENDING' : undefined,
        };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setReturnItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAddManualItem = () => {
    if (!manualBarcode.trim()) return;
    const clean = manualBarcode.trim();

    // 1. If starts with 204: route to Invoice #
    if (/^204\d*/i.test(clean) && clean.length >= 4) {
      setOriginalInvoiceNo(clean);
      setManualBarcode('');
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setScanNotification({
        message: isRtl ? `✅ تم تسجيل رقم الفاتورة: (${clean})` : `✅ Invoice # Recorded: (${clean})`,
        type: 'INVOICE'
      });
      return;
    }

    // 2. If starts with 200 or return200 / new200: route to Order # and Return Receipt # (return+orderNo)
    if (/^(?:return|new)?200\d*/i.test(clean) && clean.length >= 4) {
      const cleanOrder = clean.replace(/^(?:return|new)/i, '').trim();
      const finalOrder = cleanOrder || clean;
      const receipt = formatReturnReceiptNo(finalOrder);
      setOrderNo(finalOrder);
      setReturnReceiptNo(receipt);
      setManualBarcode('');
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setScanNotification({
        message: isRtl 
          ? `✅ تم تسجيل رقم الطلب (${finalOrder}) وإذن استلام المرتجع (${receipt})` 
          : `✅ Order & Receipt Recorded: (${receipt})`,
        type: 'ORDER'
      });
      return;
    }

    // 3. Otherwise: Process as Item
    setReturnItems(prev => {
      const idx = prev.findIndex(i => i.itemCode.toLowerCase() === clean.toLowerCase());
      if (idx !== -1) {
        const updated = [...prev];
        const current = updated[idx];
        const nextScanned = current.scannedQty + 1;
        updated[idx] = {
          ...current,
          scannedQty: nextScanned,
          actualReturnedQty: Math.max(current.actualReturnedQty, nextScanned),
          refundTotal: Math.max(current.actualReturnedQty, nextScanned) * (current.unitPrice || 0)
        };
        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
        return updated;
      } else {
        const newItem: ReturnSessionItem = {
          id: `manual-${Date.now()}`,
          itemCode: clean,
          itemName: `صنف يدوي ${clean}`,
          unit: 'PCS',
          invoicedQty: 1,
          actualReturnedQty: 1,
          scannedQty: 1,
          unitPrice: 0,
          refundTotal: 0,
          condition: 'VALID_FOR_RESTOCK',
          inspectionDecision: 'WAREHOUSE',
          size: 'L',
          color: 'أبيض',
          packagingCondition: 'مغلق بتغليف المصنع',
          reasonText: 'رفض العميل الاستلام',
          inspectorName: settings.auditorName || 'أحمد عيد',
          isIncludedInRefund: true,
        };
        if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
        return [newItem, ...prev];
      }
    });
    setManualBarcode('');
  };

  // Helper: Direct Destination Router between Warehouse and Lab
  const handleSetDestination = (itemId: string, destination: 'WAREHOUSE' | 'LAB') => {
    setReturnItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const isLab = destination === 'LAB';
        return {
          ...item,
          condition: isLab ? ('TRANSFERRED_TO_LAB' as ReturnItemCondition) : ('VALID_FOR_RESTOCK' as ReturnItemCondition),
          inspectionDecision: destination,
          labDecision: isLab ? 'PENDING' : undefined,
          notes: isLab ? 'صنف محول للمعمل الفني للفحص' : 'صالح لإعادة الإدخال للمستودع'
        };
      }
      return item;
    }));
  };

  // Calculations for current active session
  const totalInvoicedPieces = returnItems.reduce((acc, i) => acc + (Number(i.invoicedQty) || 0), 0);
  const totalActualReturnedPieces = returnItems.filter(i => i.isIncludedInRefund).reduce((acc, i) => acc + (Number(i.actualReturnedQty) || 0), 0);
  const totalValidForRestockPieces = returnItems.filter(i => i.isIncludedInRefund && i.condition === 'VALID_FOR_RESTOCK').reduce((acc, i) => acc + (Number(i.actualReturnedQty) || 0), 0);
  const totalTransferredToLabPieces = returnItems.filter(i => i.isIncludedInRefund && i.condition === 'TRANSFERRED_TO_LAB').reduce((acc, i) => acc + (Number(i.actualReturnedQty) || 0), 0);
  const totalScannedPieces = returnItems.reduce((acc, i) => acc + (Number(i.scannedQty) || 0), 0);
  const totalRefundValue = returnItems.filter(i => i.isIncludedInRefund).reduce((acc, i) => acc + (Number(i.refundTotal) || 0), 0);

  // Business Rule:
  // If ANY item has condition 'TRANSFERRED_TO_LAB', report is suspended ('PENDING_LAB').
  // If ALL items are 'VALID_FOR_RESTOCK', report is completed ('COMPLETED').
  const hasLabItems = totalTransferredToLabPieces > 0;
  const computedSessionStatus: ReturnReportStatus = hasLabItems ? 'PENDING_LAB' : 'COMPLETED';

  // Save current Return & Quality Inspection Report
  const handleSaveReport = async () => {
    if (returnItems.length === 0) {
      alert('لا توجد أصناف في بيان الاستلام لحفظ التقرير.');
      return;
    }

    if (!originalInvoiceNo.trim()) {
      alert('يرجى إدخال أو استخلاص رقم الفاتورة الأصلية للعميل.');
      return;
    }

    const reportStatus = computedSessionStatus;

    const report: ReturnReport = {
      id: `rep-${Date.now()}`,
      returnReceiptNo,
      rmaNo: returnReceiptNo,
      originalInvoiceNo: originalInvoiceNo.trim(),
      orderNo: orderNo.trim() || undefined,
      customerName: customerName.trim() || 'عميل نقدي',
      paymentMethod,
      createdAt: new Date().toISOString(),
      auditorName: settings.auditorName || 'أحمد حمادة',
      auditorId: settings.auditorId || 'AUD-101',
      auditorSignature: settings.auditorSignature,
      status: reportStatus,
      items: returnItems,
      totalInvoicedQty: totalInvoicedPieces,
      totalReturnedQty: totalActualReturnedPieces,
      totalValidForRestockQty: totalValidForRestockPieces,
      totalTransferredToLabQty: totalTransferredToLabPieces,
      totalRefundAmount: totalRefundValue,
      notes: generalNotes,
    };

    await saveReturnReport(report);
    await loadSavedReports();

    if (reportStatus === 'COMPLETED') {
      alert(`✅ تم إنهاء واعتماد تقرير الارتجاع للمستودع بنجاح (${returnReceiptNo})، واكتمال طلب الاسترداد المالي.`);
      if (settings.soundEnabled) SoundEffects.playInvoiceFinished(settings.soundVolume);
    } else {
      alert(`⚠️ تم تعليق تقرير المرتجع (${returnReceiptNo}) لوجود (${totalTransferredToLabPieces}) حبة محولة للمعمل. يرجى متابعته في قائمة المعلقات.`);
      if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
    }

    // Reset session for next invoice
    setReturnReceiptNo(`RET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setOriginalInvoiceNo('');
    setOrderNo('');
    setCustomerName('');
    setReturnItems([]);
    setGeneralNotes('');
  };

  // Open Lab Review Modal for a Suspended Report
  const handleOpenLabReview = (report: ReturnReport) => {
    setSelectedReportForLabReview(JSON.parse(JSON.stringify(report)));
    setLabReviewNotes(report.labNotes || '');
    setLabAuditorName(report.labAuditorName || settings.auditorName || 'أخصائي المعمل والجودة');
  };

  // Save Lab Decision & Complete Re-receipt
  const handleSaveLabDecision = async () => {
    if (!selectedReportForLabReview) return;

    // Check if any item is still PENDING
    const hasUnresolvedLab = selectedReportForLabReview.items.some(
      i => i.condition === 'TRANSFERRED_TO_LAB' && (!i.labDecision || i.labDecision === 'PENDING')
    );

    if (hasUnresolvedLab) {
      alert('يرجى تحديد قرار المعمل (مقبول صالح للمستودع أو مرفوض هالك) لجميع الأصناف المحولة للمعمل.');
      return;
    }

    // Update items: approved items become VALID_FOR_RESTOCK
    const updatedItems = selectedReportForLabReview.items.map(item => {
      if (item.condition === 'TRANSFERRED_TO_LAB') {
        if (item.labDecision === 'APPROVED_FOR_RESTOCK') {
          return {
            ...item,
            condition: 'VALID_FOR_RESTOCK' as ReturnItemCondition,
            notes: `${item.notes ? item.notes + ' - ' : ''}تمت موافقة المعمل وإعادة الاستلام للمستودع`
          };
        } else {
          return {
            ...item,
            isIncludedInRefund: false, // Exclude scrapped from refund if company policy
            notes: `${item.notes ? item.notes + ' - ' : ''}تم رفض الصنف من المعمل (هالك)`
          };
        }
      }
      return item;
    });

    const validQty = updatedItems
      .filter(i => i.condition === 'VALID_FOR_RESTOCK')
      .reduce((sum, i) => sum + (Number(i.actualReturnedQty) || 0), 0);

    const refundAmt = updatedItems
      .filter(i => i.isIncludedInRefund)
      .reduce((sum, i) => sum + (Number(i.refundTotal) || 0), 0);

    const updatedReport: ReturnReport = {
      ...selectedReportForLabReview,
      items: updatedItems,
      status: 'COMPLETED', // Now Completed after lab clearance!
      totalValidForRestockQty: validQty,
      totalTransferredToLabQty: 0,
      totalRefundAmount: refundAmt,
      labNotes: labReviewNotes,
      labAuditorName,
      labResolvedAt: new Date().toISOString(),
      notes: `${selectedReportForLabReview.notes || ''} [تمت مراجعة المعمل واستكمال الاستلام للمستودع]`
    };

    await saveReturnReport(updatedReport);
    await loadSavedReports();
    setSelectedReportForLabReview(null);
    alert(`✅ تم اعتماد قرار المعمل وإنهاء تقرير المرتجع (${updatedReport.returnReceiptNo}) واكتمال الاسترداد.`);
    if (settings.soundEnabled) SoundEffects.playInvoiceFinished(settings.soundVolume);
  };

  // Filtered lists for various tabs
  const pendingLabReports = useMemo(() => {
    return savedReports.filter(r => r.status === 'PENDING_LAB');
  }, [savedReports]);

  const overdueLabReports = useMemo(() => {
    return pendingLabReports.filter(r => r.isOverdueForLab);
  }, [pendingLabReports]);

  const completedReports = useMemo(() => {
    return savedReports.filter(r => r.status === 'COMPLETED');
  }, [savedReports]);

  // Scan status filter stats for post-scan filtering
  const scanFilterStats = useMemo(() => {
    const all = returnItems.length;
    const scannedFull = returnItems.filter(i => (i.scannedQty || 0) >= i.invoicedQty && i.invoicedQty > 0).length;
    const scannedPartial = returnItems.filter(i => (i.scannedQty || 0) > 0 && (i.scannedQty || 0) < i.invoicedQty).length;
    const notScanned = returnItems.filter(i => (i.scannedQty || 0) === 0).length;
    const overScanned = returnItems.filter(i => (i.scannedQty || 0) > i.invoicedQty).length;
    const validRestock = returnItems.filter(i => i.condition === 'VALID_FOR_RESTOCK').length;
    const toLab = returnItems.filter(i => i.condition === 'TRANSFERRED_TO_LAB').length;

    return {
      all,
      scannedFull,
      scannedPartial,
      notScanned,
      overScanned,
      validRestock,
      toLab
    };
  }, [returnItems]);

  const filteredItems = useMemo(() => {
    return returnItems.filter(item => {
      // 1. Search Query Filter (Code, Name, Invoice Number, Source File)
      const q = filterQuery.trim().toLowerCase();
      const matchQ = !q || 
        item.itemCode.toLowerCase().includes(q) || 
        item.itemName.toLowerCase().includes(q) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(q)) ||
        (item.sourceFile && item.sourceFile.toLowerCase().includes(q));

      // 2. Scan Status Filter
      let matchScanStatus = true;
      const sQty = item.scannedQty || 0;
      if (scanStatusFilter === 'SCANNED_FULL') {
        matchScanStatus = (sQty >= item.invoicedQty && item.invoicedQty > 0);
      } else if (scanStatusFilter === 'SCANNED_PARTIAL') {
        matchScanStatus = (sQty > 0 && sQty < item.invoicedQty);
      } else if (scanStatusFilter === 'NOT_SCANNED') {
        matchScanStatus = (sQty === 0);
      } else if (scanStatusFilter === 'OVER_SCANNED') {
        matchScanStatus = (sQty > item.invoicedQty);
      } else if (scanStatusFilter === 'VALID_FOR_RESTOCK') {
        matchScanStatus = (item.condition === 'VALID_FOR_RESTOCK');
      } else if (scanStatusFilter === 'TRANSFERRED_TO_LAB') {
        matchScanStatus = (item.condition === 'TRANSFERRED_TO_LAB');
      }

      // 3. Condition Filter (Dropdown)
      const matchCond = selectedConditionFilter === 'ALL' || item.condition === selectedConditionFilter;

      return matchQ && matchScanStatus && matchCond;
    });
  }, [returnItems, filterQuery, scanStatusFilter, selectedConditionFilter]);

  return (
    <div className="space-y-4">
      {/* 1. OVERDUE LAB SUSPENSION ALERT BANNER (تنبيه تجاوز يوم عمل على المعلقات) */}
      {overdueLabReports.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/90 via-amber-950/80 to-slate-900 border-2 border-red-500/80 rounded-xl p-3.5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 text-white rounded-lg shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  {isRtl 
                    ? `تنبيه عاجل: يوجد (${overdueLabReports.length}) مرتجعات معلقة بالمعمل تجاوزت يوم عمل (24 ساعة)!` 
                    : `Urgent Alert: (${overdueLabReports.length}) returns pending lab review overdue > 24 hours!`}
                </h3>
              </div>
              <p className="text-xs text-red-200 mt-0.5">
                أرقام المرتجعات المعلقة: {overdueLabReports.map(r => r.returnReceiptNo).join(' ، ')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveSubTab('pending_lab')}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-md transition-all whitespace-nowrap"
          >
            <span>فتح قائمة المعلقات</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* 2. Top Header & Navigation Sub-tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">
                  {isRtl ? 'المرتجعات والفحص وطلبات الاسترداد المالي' : 'Returns, Quality Inspection & Refund Requests'}
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'استلام الكميات الفعلية تحت الفحص من واقع الفاتورة، فرز الحبات (صالح للمستودع / محول للمعمل)، إدارة المعلقات، واعتماد طلبات الاسترداد' 
                  : 'Receipt under inspection, item condition routing (Restock / Quality Lab), pending suspension alerts & completed refund dispatch'}
              </p>
            </div>
          </div>

          {/* Quick Export Actions for Officer & Emailing */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenLogicGuide && (
              <button
                onClick={() => onOpenLogicGuide('returns')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-xs font-bold text-purple-300 shadow-sm transition-all"
                title="دليل المنطق والمعادلات والحلول الرقابية للمرتجعات وفحص الجودة والاسترداد"
              >
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>المنطق والمعادلات 💡</span>
              </button>
            )}

            <button
              onClick={() => setIsPdfBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-xs font-bold text-white shadow-lg shadow-amber-900/30 transition-all border border-amber-400/40 animate-pulse hover:animate-none"
              title="رفع واستخلاص ملفات PDF المرتجعات مع متابعة تقدم الرفع وتفكيك الأصناف خطوة بخطوة"
            >
              <FileUp className="w-4 h-4 text-white" />
              <span>رفع واستخلاص PDF مع مؤشر التقدم</span>
              <span className="bg-slate-950/80 text-[10px] px-1.5 py-0.5 rounded text-amber-300 font-mono">
                Batch AI
              </span>
            </button>

            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md transition-all border border-purple-400/30"
              title="إعداد رسالة البريد الإلكتروني للموظف المختص مرفقاً بها تقرير الاسترداد المالي والإكسيل"
            >
              <Send className="w-4 h-4 text-purple-200" />
              <span>إرسال بريد للموظف المختص (Email)</span>
            </button>

            <button
              onClick={() => exportCompletedReturnsToExcel(savedReports)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-xs font-bold text-white border border-emerald-500/50 shadow-sm"
              title="تصدير تقرير إكسيل لجميع المرتجعات المكتملة للمستودع"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>إكسيل المرتجعات المكتملة</span>
            </button>

            <button
              onClick={() => exportCompletedRefundsToExcel(savedReports)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700/80 hover:bg-purple-600 text-xs font-bold text-white border border-purple-500/50 shadow-sm"
              title="تصدير تقرير إكسيل لطلبات الاسترداد المالي المكتملة للإرسال بالميل للموظف المختص"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-300" />
              <span>إكسيل الاسترداد المالي المكتمل</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex items-center gap-1 border-t border-slate-800 pt-3 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'editor'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>استلام مرتجع تحت الفحص (محرر الجلسة)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pending_lab')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              activeSubTab === 'pending_lab'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
            <span>قائمة المعلقات ومراجعة المعمل</span>
            {pendingLabReports.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                overdueLabReports.length > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingLabReports.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('weekly_lab_report')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              activeSubTab === 'weekly_lab_report'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
            <span>تقرير المعمل الأسبوعي (سبت)</span>
            <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded-full font-mono font-bold">
              {savedReports.reduce((s, r) => s + (r.totalTransferredToLabQty || (r.items || []).filter(i => i.condition === 'TRANSFERRED_TO_LAB').length), 0)}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('refunds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'refunds'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
            <span>طلبات الاسترداد المالي</span>
            {completedReports.length > 0 && (
              <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded-full font-mono">
                {completedReports.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('completed_archive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'completed_archive'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>سجل المرتجعات المكتملة للمستودع</span>
          </button>
        </div>
      </div>

      {/* 3. SUB-TAB CONTENT ROUTING */}
      {activeSubTab === 'editor' && (
        /* Active Return Inspection Session View */
        <div className="space-y-4">
          {/* Real-time Scan Notification Alert */}
          {scanNotification && (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all shadow-md ${
              scanNotification.type === 'INVOICE'
                ? 'bg-blue-950/80 border-blue-600/80 text-blue-200'
                : scanNotification.type === 'ORDER'
                ? 'bg-amber-950/80 border-amber-600/80 text-amber-200'
                : 'bg-emerald-950/80 border-emerald-600/80 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{scanNotification.message}</span>
              </div>
              <button 
                onClick={() => setScanNotification(null)}
                className="text-slate-400 hover:text-white px-2 py-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Smart Barcode Routing Guide Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ScanLine className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white">{isRtl ? 'قواعد التوجيه التلقائي للمسح الضوئي (Barcode Routing):' : 'Smart Barcode Routing Rules:'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-2.5 py-1 rounded-md font-mono text-[11px]">
                <strong className="text-blue-200">204...</strong> ⬅ {isRtl ? 'يسجل كرقم الفاتورة الأصلية' : 'Recorded as Invoice #'}
              </span>
              <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-1 rounded-md font-mono text-[11px]">
                <strong className="text-amber-200">200... / new200...</strong> ⬅ {isRtl ? 'يسجل كرقم الطلب وإذن الاستلام new+رقم الطلب' : 'Order & Receipt (newOrder#)'}
              </span>
            </div>
          </div>

          {/* Header Card: Invoice, Order, Customer, Payment Method, Document Upload */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-900/40 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {isRtl ? 'بيانات الاستلام من واقع الفاتورة الأصلية' : 'Receipt Under Inspection from Customer Invoice'}
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    لا يوجد RMA مسبقاً — يتم الاستلام وتحديد حالة الحبات (صالح للمستودع / محول للمعمل)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Full invoice return toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleFullInvoiceReturn(!isFullInvoiceReturn)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${
                    isFullInvoiceReturn
                      ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/50'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-emerald-500'
                  }`}
                  title="تحديد كامل الكميات كمرتجع بنسبة 100% فوراً"
                >
                  <CheckCheck className={`w-4 h-4 ${isFullInvoiceReturn ? 'text-white' : 'text-slate-400'}`} />
                  <span>
                    {isRtl 
                      ? (isFullInvoiceReturn ? '✓ تم تفعيل ارتجاع الفاتورة كاملة' : '⚡ خيار: ارتجاع الفاتورة كاملة (100%)')
                      : (isFullInvoiceReturn ? '✓ Full Invoice Return Active' : '⚡ Return Full Invoice')}
                  </span>
                </button>

                {/* Audit workstation confirmation sync */}
                <button
                  type="button"
                  onClick={handleSyncToAuditWorkstation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold border border-indigo-500/50 shadow-sm transition-all"
                  title="تأكيد ومراجعة في خدمة مدقق الفواتير والتجهيز بالمسح الفعلي"
                >
                  <Truck className="w-4 h-4 text-indigo-200" />
                  <span>{isRtl ? 'تأكيد بالمسح في مدقق الفواتير' : 'Verify in Dispatch Audit'}</span>
                </button>

                {/* Internal Discrepancies report trigger */}
                <button
                  type="button"
                  onClick={() => setIsInternalDiscrepancyOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-700/60 shadow-sm transition-all"
                  title="عرض تقرير النواقص والأخطاء (داخلي)"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>{isRtl ? 'تقرير الأخطاء والنواقص' : 'Discrepancies'}</span>
                  {(discrepancies.length > 0 || wrongPickings.length > 0) && (
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                      {discrepancies.length + wrongPickings.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {isRtl ? 'رقم إذن استلام المرتجع' : 'Return Receipt Ref #'}
                </label>
                <input
                  type="text"
                  value={returnReceiptNo}
                  onChange={(e) => setReturnReceiptNo(e.target.value)}
                  placeholder="new200xxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500 font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {isRtl ? 'new + رقم الطلب تلقائياً' : 'Auto: new + Order #'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {isRtl ? 'رقم الفاتورة الأصلية للعميل *' : 'Original Invoice # *'}
                </label>
                <input
                  type="text"
                  value={originalInvoiceNo}
                  onChange={(e) => setOriginalInvoiceNo(e.target.value)}
                  placeholder="204xxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 font-bold"
                />
                <span className="text-[10px] text-blue-400/80 mt-1 block">
                  {isRtl ? 'تبدأ بـ 204 من اليسار' : 'Starts with 204'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {isRtl ? 'رقم الطلب / الأوردر' : 'Order #'}
                </label>
                <input
                  type="text"
                  value={orderNo}
                  onChange={(e) => handleOrderNoChange(e.target.value)}
                  placeholder="200xxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 font-bold"
                />
                <span className="text-[10px] text-amber-400/80 mt-1 block">
                  {isRtl ? 'يبدأ بـ 200 من اليسار' : 'Starts with 200'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {isRtl ? 'اسم العميل' : 'Customer Name'}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم المتجر أو العميل"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-purple-400">
                    {isRtl ? 'طريقة الدفع الأصلية *' : 'Payment Method *'}
                  </label>
                  {paymentMethod && (
                    <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/80 px-1.5 py-0.2 rounded font-bold">
                      {isRtl ? 'مستخلصة من الفاتورة' : 'Extracted from PDF'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  list="payment-methods-suggestions"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="تمارا / تابي / مدى / بطاقة / نقدي / تحويل..."
                  className="w-full bg-slate-950 border border-purple-900/60 rounded-lg px-3 py-2 text-xs text-purple-200 font-bold focus:outline-none focus:border-purple-500"
                />
                <datalist id="payment-methods-suggestions">
                  <option value="تمارا (Tamara)" />
                  <option value="تابي (Tabby)" />
                  <option value="بطاقة مدى / ائتمان (Mada / Credit Card)" />
                  <option value="Apple Pay" />
                  <option value="تحويل بنكي (Bank Transfer)" />
                  <option value="نقدي (Cash)" />
                  <option value="دفع عند الاستلام (COD)" />
                  <option value="رصيد محفظة / آجل (Credit Balance)" />
                </datalist>
              </div>
            </div>

            {/* Smart Import Buttons & Multi-PDF Batch Support */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                {/* Primary Button: Open interactive Batch PDF Upload Modal with step-by-step progress */}
                <button
                  type="button"
                  onClick={() => setIsPdfBatchModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  <FileUp className="w-4 h-4 text-white" />
                  <span>رفع واستخلاص ملفات PDF (استيراد مجمّع مع متابعة التقدم)</span>
                  <span className="bg-slate-950/80 text-[10px] px-1.5 py-0.5 rounded text-amber-300 font-mono">
                    AI Auto
                  </span>
                </button>

                {/* Quick Direct PDF Batch Upload (Replaces session or starts fresh) */}
                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm">
                  <Files className="w-4 h-4 text-amber-400" />
                  <span>{isLoadingPdf ? 'جاري قراءة الملفات...' : 'استيراد سريع PDF'}</span>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handlePdfUpload(e, false)}
                    disabled={isLoadingPdf}
                    className="hidden"
                  />
                </label>

                {/* Append Additional PDFs to Current Session */}
                {returnItems.length > 0 && (
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm">
                    <FolderPlus className="w-4 h-4 text-emerald-400" />
                    <span>إضافة ملفات PDF أخرى (+ دمج)</span>
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={(e) => handlePdfUpload(e, true)}
                      disabled={isLoadingPdf}
                      className="hidden"
                    />
                  </label>
                )}

                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>استيراد Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-400">
                المراجع المسؤول: <span className="text-white font-bold">{settings.auditorName || 'أحمد حمادة'}</span> ({settings.auditorId || 'AUD-101'})
              </div>
            </div>

            {/* Batch Progress Bar during extraction */}
            {pdfBatchProgress && (
              <div className="mt-3 p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl">
                <div className="flex items-center justify-between text-xs text-amber-300 mb-1.5 font-bold">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>جاري استخلاص ملفات PDF المجمعة: {pdfBatchProgress.filename}</span>
                  </div>
                  <span>{pdfBatchProgress.current} من {pdfBatchProgress.total} ملف</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(pdfBatchProgress.current / pdfBatchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded Batch Files Summary Chips */}
            {uploadedBatchFiles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Files className="w-4 h-4 text-amber-400" />
                    <span>الملفات المستخلصة في هذه الجلسة ({uploadedBatchFiles.length} ملفات - إجمالي {returnItems.length} صنف):</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('هل تريد مسح الأصناف الحالية والبدء من جديد؟')) {
                        setReturnItems([]);
                        setUploadedBatchFiles([]);
                        setOriginalInvoiceNo('');
                        setOrderNo('');
                        setReturnReceiptNo('');
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 hover:underline"
                  >
                    تفريغ الكل
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uploadedBatchFiles.map((bf, idx) => (
                    <div 
                      key={idx} 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-700/80 rounded-lg text-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-200 font-mono font-medium truncate max-w-[160px]" title={bf.name}>{bf.name}</span>
                      {bf.invoiceNo && (
                        <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800/60 px-1 rounded font-mono">
                          #{bf.invoiceNo}
                        </span>
                      )}
                      <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1 rounded font-bold">
                        {bf.count} صنف ({bf.totalQty} حبة)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Real-time KPIs & Report Outcome Status */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold">{isRtl ? 'إجمالي المرتجع الفعلي' : 'Actual Returned'}</div>
              <div className="text-lg font-black text-white mt-1">{totalActualReturnedPieces} <span className="text-xs font-normal text-slate-400">حبة</span></div>
            </div>

            <div className="bg-slate-900 border border-emerald-900/50 bg-emerald-950/20 p-3.5 rounded-xl">
              <div className="text-[11px] text-emerald-400 font-semibold">{isRtl ? 'صالح للارتجاع للمستودع' : 'Valid for Restock'}</div>
              <div className="text-lg font-black text-emerald-300 mt-1">{totalValidForRestockPieces} <span className="text-xs font-normal text-emerald-400/70">حبة</span></div>
            </div>

            <div className="bg-slate-900 border border-amber-900/50 bg-amber-950/20 p-3.5 rounded-xl">
              <div className="text-[11px] text-amber-400 font-semibold">{isRtl ? 'محول للمعمل (تحت الفحص)' : 'Transferred to Lab'}</div>
              <div className="text-lg font-black text-amber-300 mt-1">{totalTransferredToLabPieces} <span className="text-xs font-normal text-amber-400/70">حبة</span></div>
            </div>

            <div className="bg-slate-900 border border-purple-900/50 bg-purple-950/20 p-3.5 rounded-xl">
              <div className="text-[11px] text-purple-400 font-semibold">{isRtl ? 'قيمة الاسترداد المالي' : 'Refund Value'}</div>
              <div className="text-lg font-black text-purple-300 mt-1">{totalRefundValue.toFixed(2)} <span className="text-xs font-normal text-slate-400">ر.س/ج.م</span></div>
            </div>

            <div className={`p-3.5 rounded-xl border col-span-2 sm:col-span-1 flex flex-col justify-center ${
              computedSessionStatus === 'COMPLETED'
                ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                : 'bg-amber-950/60 border-amber-600 text-amber-300'
            }`}>
              <div className="text-[11px] font-bold">
                {computedSessionStatus === 'COMPLETED' ? '✅ جاهز للإنهاء كمرتجع للمستودع' : '⚠️ سيتم تعليق التقرير للمعمل'}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {computedSessionStatus === 'COMPLETED' ? '100% صالحة للمستودع' : `${totalTransferredToLabPieces} حبة تحتاج فحص معمل`}
              </div>
            </div>
          </div>

          {/* Barcode Quick Scan Bar */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center gap-2">
            <div className="relative flex-1">
              <ScanLine className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 rtl:left-auto rtl:right-3" />
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddManualItem()}
                placeholder={isRtl ? 'امسح أو اكتب باركود الصنف لزيادة الكمية أو الإضافة الفورية...' : 'Scan barcode to verify/add item...'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              onClick={handleAddManualItem}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? 'إضافة' : 'Add'}</span>
            </button>
          </div>

          {/* Items Table with Post-Scan Filter Pills & Item Condition Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {/* Filter Pills & Search Header */}
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2 rtl:left-auto rtl:right-2.5" />
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder={isRtl ? 'بحث بكود، اسم صنف، رقم فاتورة، أو اسم ملف...' : 'Search code, item name, invoice #, file...'}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 rtl:pl-2.5 rtl:pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    {filterQuery && (
                      <button
                        onClick={() => setFilterQuery('')}
                        className="absolute right-2 top-2 rtl:right-auto rtl:left-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={selectedConditionFilter}
                    onChange={(e) => setSelectedConditionFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ALL">كافة القرارات ({returnItems.length})</option>
                    <option value="VALID_FOR_RESTOCK">صالحة للمستودع ({scanFilterStats.validRestock})</option>
                    <option value="TRANSFERRED_TO_LAB">محولة للمعمل ({scanFilterStats.toLab})</option>
                  </select>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  عرض <span className="text-amber-400 font-bold font-mono">{filteredItems.length}</span> من <span className="font-mono">{returnItems.length}</span> صنف
                </div>
              </div>

              {/* Real-time Post-Scan Filter Pills (فلترة الأصناف بعد وعبر المسح بالسكانر) */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-bold ml-1 rtl:ml-0 rtl:mr-1">فلترة بعد المسح:</span>
                
                {/* 1. All Items */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'ALL'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>الكل</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-950/80 font-mono">
                    {scanFilterStats.all}
                  </span>
                </button>

                {/* 2. Scanned Fully (تم مسحه بالكامل) */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('SCANNED_FULL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'SCANNED_FULL'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-emerald-300 hover:bg-slate-800 border border-emerald-900/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم مسحه بالكامل (100%)</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-950 font-mono text-emerald-300 border border-emerald-800">
                    {scanFilterStats.scannedFull}
                  </span>
                </button>

                {/* 3. Scanned Partially (مسح جزئي) */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('SCANNED_PARTIAL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'SCANNED_PARTIAL'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-blue-300 hover:bg-slate-800 border border-blue-900/60'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>مسح جزئي</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-950 font-mono text-blue-300 border border-blue-800">
                    {scanFilterStats.scannedPartial}
                  </span>
                </button>

                {/* 4. Not Scanned (لم يتم مسحه) */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('NOT_SCANNED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'NOT_SCANNED'
                      ? 'bg-rose-700 text-white shadow-md'
                      : 'bg-slate-800/80 text-rose-300 hover:bg-slate-800 border border-rose-900/60'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>لم يتم مسحه</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-rose-950 font-mono text-rose-300 border border-rose-800">
                    {scanFilterStats.notScanned}
                  </span>
                </button>

                {/* 5. Valid for Restock */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('VALID_FOR_RESTOCK')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'VALID_FOR_RESTOCK'
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-teal-300 hover:bg-slate-800 border border-teal-900/60'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>صالح للمستودع</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-teal-950 font-mono text-teal-300 border border-teal-800">
                    {scanFilterStats.validRestock}
                  </span>
                </button>

                {/* 6. Transferred to Lab */}
                <button
                  type="button"
                  onClick={() => setScanStatusFilter('TRANSFERRED_TO_LAB')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    scanStatusFilter === 'TRANSFERRED_TO_LAB'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-slate-800/80 text-amber-300 hover:bg-slate-800 border border-amber-900/60'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>محول للمعمل</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-950 font-mono text-amber-300 border border-amber-800">
                    {scanFilterStats.toLab}
                  </span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-8">#</th>
                    <th className="p-2.5">الباركود واسم الصنف ومصدر الملف</th>
                    <th className="p-2.5 text-center">المقاس / اللون</th>
                    <th className="p-2.5 text-center">كمية الفاتورة</th>
                    <th className="p-2.5 text-center bg-blue-950/30 text-blue-300">المجموع الفرعي (PDF)</th>
                    <th className="p-2.5 text-center">المرتجع الفعلي</th>
                    <th className="p-2.5 text-center">المسح بالسكانر</th>
                    <th className="p-2.5 text-center">سعر الوحدة</th>
                    <th className="p-2.5 text-center bg-purple-950/30 text-purple-300">مبلغ الاسترداد</th>
                    <th className="p-2.5 text-center">الحالة / التوجيه</th>
                    <th className="p-2.5 text-center">حالة التغليف والسبب</th>
                    <th className="p-2.5">ملاحظات الفحص</th>
                    <th className="p-2.5 text-center w-10">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-500">
                        {returnItems.length === 0 
                          ? 'لا توجد أصناف حالياً. ارفع ملف/ملفات PDF الفاتورة أو امسح الباركود للبدء.'
                          : 'لا توجد أصناف تطابق معايير الفلترة المحددة.'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white font-mono">{item.itemCode}</span>
                            {item.invoiceNo && (
                              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800/60 px-1 py-0.2 rounded font-mono">
                                #{item.invoiceNo}
                              </span>
                            )}
                            {item.sourceFile && (
                              <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]" title={item.sourceFile}>
                                📄 {item.sourceFile}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.itemName}</div>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={item.size || ''}
                              placeholder="المقاس (L)"
                              onChange={(e) => handleUpdateItem(item.id, { size: e.target.value })}
                              className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-center font-bold text-slate-200"
                            />
                            <input
                              type="text"
                              value={item.color || ''}
                              placeholder="اللون"
                              onChange={(e) => handleUpdateItem(item.id, { color: e.target.value })}
                              className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-center text-slate-300"
                            />
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {item.invoicedQty} {item.unit}
                        </td>
                        {/* Subtotal column from Invoice PDF */}
                        <td className="p-2.5 text-center bg-blue-950/20">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.subtotal ?? (item.invoicedQty * (item.unitPrice || 0))}
                            onChange={(e) => handleUpdateItem(item.id, { subtotal: Number(e.target.value) || 0 })}
                            className="w-20 bg-slate-950 border border-blue-900/60 rounded px-1.5 py-1 text-center font-mono font-bold text-blue-300 focus:outline-none focus:border-blue-500"
                            title="المجموع الفرعي الإجمالي للصنف بالفاتورة"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.invoicedQty}
                            value={item.actualReturnedQty}
                            onChange={(e) => handleUpdateItem(item.id, { actualReturnedQty: Number(e.target.value) || 0 })}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono inline-flex items-center gap-1 ${
                              (item.scannedQty || 0) >= item.invoicedQty && item.invoicedQty > 0
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : (item.scannedQty || 0) > 0
                                ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {(item.scannedQty || 0) >= item.invoicedQty && item.invoicedQty > 0 && (
                                <Check className="w-3 h-3 text-emerald-400" />
                              )}
                              <span>{item.scannedQty || 0} / {item.invoicedQty}</span>
                            </span>
                            <span className="text-[9px] font-sans font-medium text-slate-400">
                              {(item.scannedQty || 0) >= item.invoicedQty && item.invoicedQty > 0
                                ? 'مكتمل المسح'
                                : (item.scannedQty || 0) > 0
                                ? 'مسح جزئي'
                                : 'بانتظار المسح'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                            title="سعر الوحدة = المجموع الفرعي ÷ كمية الفاتورة"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-purple-300 bg-purple-950/20">
                          <div>{item.refundTotal.toFixed(2)}</div>
                          {item.actualReturnedQty < item.invoicedQty && item.actualReturnedQty > 0 && (
                            <div className="text-[9px] text-purple-400 font-normal">
                              ({item.actualReturnedQty} × {((item.subtotal || 0) / (item.invoicedQty || 1)).toFixed(2)})
                            </div>
                          )}
                        </td>
                        
                        {/* Status / Destination Routing Column (إلى المستودع أو إلى المعمل) */}
                        <td className="p-2.5 text-center">
                          <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-950 shadow-inner">
                            <button
                              type="button"
                              onClick={() => handleSetDestination(item.id, 'WAREHOUSE')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                                item.condition === 'VALID_FOR_RESTOCK'
                                  ? 'bg-emerald-600 text-white shadow'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title="توجيه الصنف إلى المستودع (إعادة للمخزن الصالح)"
                            >
                              <Check className="w-3 h-3" />
                              <span>إلى المستودع</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetDestination(item.id, 'LAB')}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                                item.condition === 'TRANSFERRED_TO_LAB'
                                  ? 'bg-amber-600 text-white shadow'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title="توجيه الصنف إلى المعمل (تحويل للمعمل الفني للفحص)"
                            >
                              <FlaskConical className="w-3 h-3" />
                              <span>إلى المعمل</span>
                            </button>
                          </div>
                        </td>

                        {/* Packaging condition & Return reason */}
                        <td className="p-2.5 text-center">
                          <div className="space-y-1">
                            <select
                              value={item.packagingCondition || 'مغلق بتغليف المصنع'}
                              onChange={(e) => handleUpdateItem(item.id, { packagingCondition: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              <option value="مغلق بتغليف المصنع">مغلق بتغليف المصنع</option>
                              <option value="مفتوح العبوة">مفتوح العبوة</option>
                              <option value="غير مغلف / تالف التغليف">غير مغلف / تالف التغليف</option>
                            </select>
                            <select
                              value={item.reasonText || 'رفض العميل الاستلام'}
                              onChange={(e) => handleUpdateItem(item.id, { reasonText: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              <option value="رفض العميل الاستلام">رفض العميل الاستلام</option>
                              <option value="عيب صناعة">عيب صناعة</option>
                              <option value="مقاس غير مناسب">مقاس غير مناسب</option>
                              <option value="مرتجع عادي">مرتجع عادي</option>
                            </select>
                          </div>
                        </td>

                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                            placeholder="ملاحظات فحص العبوة / المعمل..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer: Save & Dispatch */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">ملاحظات عامة على إذن المرتجع:</span>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="أسباب الارتجاع، حالة التغليف، ملاحظات السائق أو المندوب..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-72 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveReport}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all ${
                  computedSessionStatus === 'COMPLETED'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {computedSessionStatus === 'COMPLETED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>إنهاء التقرير كارتجاع للمستودع</span>
                  </>
                ) : (
                  <>
                    <FlaskConical className="w-4 h-4" />
                    <span>حفظ وتعليق التقرير لمراجعة المعمل</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB: PENDING LAB REVIEWS & 24H OVERDUE ALERT LIST */}
      {activeSubTab === 'pending_lab' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FlaskConical className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {isRtl ? 'قائمة المرتجعات المعلقة بمراجعة معمل الجودة' : 'Pending Quality Lab Suspensions'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    تقارير المرتجعات التي تحتوي حبات محولة للمعمل — يتم التنبيه باللون الأحمر عند تجاوز يوم عمل (24 ساعة)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportSaturdayWeeklyLabReportToExcel(savedReports, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير تقرير فحص المعمل الأسبوعي (Excel)</span>
                </button>
                <button
                  onClick={() => exportPendingLabReportsToExcel(savedReports)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 border border-slate-700"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير كشف المعلقات</span>
                </button>
              </div>
            </div>

            {pendingLabReports.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div>لا توجد تقارير مرتجعات معلقة بالمعمل حالياً. كافة المرتجعات مكتملة بالمستودع.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingLabReports.map(rep => {
                  const createdTime = new Date(rep.createdAt).getTime();
                  const elapsedHours = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60));
                  const isOverdue = elapsedHours >= 24;

                  return (
                    <div 
                      key={rep.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        isOverdue 
                          ? 'bg-red-950/30 border-red-500/80 shadow-lg ring-1 ring-red-500/50' 
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-amber-400 text-sm">
                              {rep.returnReceiptNo}
                            </span>
                            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                              فاتورة: {rep.originalInvoiceNo}
                            </span>
                            {rep.orderNo && (
                              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                                طلب: {rep.orderNo}
                              </span>
                            )}
                            <span className="text-xs text-slate-300">العميل: {rep.customerName}</span>
                            <span className="text-xs bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                              الدفع: {rep.paymentMethod}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="text-amber-300 font-bold">
                              حبات محولة للمعمل: {rep.totalTransferredToLabQty} حبة
                            </span>
                            <span className="text-slate-400">
                              صالح للمستودع: {rep.totalValidForRestockQty} حبة
                            </span>
                            <span className="text-slate-400">
                              تاريخ الإدخال: {new Date(rep.createdAt).toLocaleString('ar-EG')}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              isOverdue 
                                ? 'bg-red-900 text-red-100 border border-red-600 animate-pulse' 
                                : 'bg-slate-800 text-amber-300'
                            }`}>
                              <Clock className="w-3 h-3" />
                              <span>{elapsedHours} ساعة مضت {isOverdue ? '(⚠️ متأخر عن يوم عمل)' : ''}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenLabReview(rep)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                          >
                            <FlaskConical className="w-4 h-4" />
                            <span>مراجعة المعمل وإعادة الاستلام</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4.5 SUB-TAB: WEEKLY SATURDAY LAB REPORT (تقرير المعمل الأسبوعي كل سبت) */}
      {activeSubTab === 'weekly_lab_report' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-blue-900/50 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FlaskConical className="w-5 h-5 text-blue-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {isRtl ? 'تقرير إجمالي الحبات المحولة للمعمل للفحص (أسبوعي كل سبت)' : 'Weekly Saturday Quality Lab Transfer Report'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    كشف معتمد يطابق تنسيق أوراكل ومجينتو متضمناً رقم تقرير الفحص، المقاس، اللون، التغليف، سبب الإرجاع وبيانات معمل النسيج وفحص الجودة
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportSaturdayWeeklyLabReportToExcel(savedReports, true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير تقرير السبت للمعمل (Excel مطابق للمرفق)</span>
                </button>

                <button
                  onClick={() => exportSaturdayWeeklyLabReportToExcel(savedReports, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير كافة الحبات (شامل)</span>
                </button>
              </div>
            </div>

            {/* Lab Transfer KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-950/30 border border-blue-900/50 p-3.5 rounded-xl">
                <div className="text-[11px] text-blue-400 font-semibold">إجمالي الحبات المحولة للمعمل</div>
                <div className="text-2xl font-black text-blue-300 mt-1">
                  {savedReports.reduce((s, r) => s + (r.totalTransferredToLabQty || (r.items || []).filter(i => i.condition === 'TRANSFERRED_TO_LAB').reduce((sum, item) => sum + (item.actualReturnedQty || 1), 0)), 0)} <span className="text-xs font-normal text-blue-400/70">حبة</span>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-slate-400 font-semibold">عدد طلبات الإرجاع بالمعمل</div>
                <div className="text-2xl font-black text-white mt-1">
                  {savedReports.filter(r => (r.items || []).some(i => i.condition === 'TRANSFERRED_TO_LAB')).length}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-slate-400 font-semibold">معمل الاستلام المحدد</div>
                <div className="text-xs font-bold text-amber-300 mt-2 truncate">
                  معمل النسيج وفحص الجودة المركزي
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                <div className="text-[11px] text-slate-400 font-semibold">دورة التقرير الرسمية</div>
                <div className="text-xs font-bold text-emerald-400 mt-2">
                  أسبوعي (كل سبت) 08:00 ص
                </div>
              </div>
            </div>

            {/* Lab Items Table Preview */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-12">تقرير #</th>
                    <th className="p-2.5">تاريخ الفحص</th>
                    <th className="p-2.5">طلب مجينتو</th>
                    <th className="p-2.5">أوراكل RMA</th>
                    <th className="p-2.5">رمز المنتج SKU</th>
                    <th className="p-2.5">اسم المنتج</th>
                    <th className="p-2.5 text-center">المقاس</th>
                    <th className="p-2.5 text-center">اللون</th>
                    <th className="p-2.5">حالة التغليف</th>
                    <th className="p-2.5">سبب الإرجاع</th>
                    <th className="p-2.5 text-center">القرار المبدئي</th>
                    <th className="p-2.5">فاحص الجودة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {savedReports.filter(r => (r.items || []).some(i => i.condition === 'TRANSFERRED_TO_LAB')).length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-500">
                        لا توجد حبات محولة للمعمل في السجلات حتى الآن. عند توجيه أي صنف للمعمل سيظهر هنا فوراً.
                      </td>
                    </tr>
                  ) : (
                    savedReports.flatMap((rep, rIdx) => 
                      (rep.items || [])
                        .filter(i => i.condition === 'TRANSFERRED_TO_LAB')
                        .map((item, iIdx) => {
                          const inspectionNo = String(rIdx * 10 + iIdx + 1).padStart(6, '0');
                          const cleanOrder = rep.orderNo ? rep.orderNo.replace(/^(?:return|new)/i, '') : '-';
                          const rmaNo = rep.returnReceiptNo || (rep.orderNo ? `return${cleanOrder}` : '-');

                          return (
                            <tr key={`${rep.id}-${item.id}`} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-2.5 text-center font-mono font-bold text-amber-400">{inspectionNo}</td>
                              <td className="p-2.5 font-mono text-slate-400">{new Date(rep.createdAt).toLocaleDateString('en-US')}</td>
                              <td className="p-2.5 font-mono font-bold text-white">{cleanOrder}</td>
                              <td className="p-2.5 font-mono text-blue-300">{rmaNo}</td>
                              <td className="p-2.5 font-mono font-bold text-purple-300">{item.itemCode}</td>
                              <td className="p-2.5 text-slate-200">{item.itemName}</td>
                              <td className="p-2.5 text-center font-bold text-slate-300">{item.size || 'L'}</td>
                              <td className="p-2.5 text-center text-slate-400">{item.color || 'أبيض'}</td>
                              <td className="p-2.5 text-slate-300">{item.packagingCondition || 'مغلق بتغليف المصنع'}</td>
                              <td className="p-2.5 text-slate-300">{item.reasonText || 'رفض العميل الاستلام'}</td>
                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                                  تحويل للمعمل الفني
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-300">{item.inspectorName || rep.auditorName || 'أحمد عيد'}</td>
                            </tr>
                          );
                        })
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Lab Transfer Notice */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                <strong className="text-white">بيانات التحويل للمعمل الفني:</strong> معمل النسيج وفحص الجودة المركزي | طبيعة الاختبار: فحص عيوب التصنيع ومطابقة التغليف والقياسات
              </div>
              <div className="text-slate-500 font-mono">
                جاهز للتوقيع والختم عند التصدير
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB: COMPLETED REFUND REQUESTS (طلبات الاسترداد المالي المعتمدة) */}
      {activeSubTab === 'refunds' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {isRtl ? 'سجل طلبات الاسترداد المالي المعتمدة' : 'Completed Refund Requests & Credit Notes'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    لا يتم إنهاء واعتماد طلب الاسترداد إلا لتقارير الارتجاع المكتملة للمستودع — جاهز للتصدير والإرسال بالميل للموظف المختص
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => exportAllRefundRequestsExcelFormatted(savedReports)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md transition-all"
                  title="تصدير ملف إكسيل مخصص بنموذج Refund Request (مطابق للمرفق)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير نموذج Refund Request (إكسيل مطابق للمرفق)</span>
                </button>

                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-all"
                >
                  <Send className="w-4 h-4 text-indigo-200" />
                  <span>إرسال بريد للموظف المختص (Email)</span>
                </button>

                <button
                  onClick={() => exportCompletedRefundsToExcel(savedReports)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير إكسيل الاسترداد المالي (جدول كامل)</span>
                </button>
              </div>
            </div>

            {completedReports.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                لا توجد طلبات استرداد مكتملة بعد. يتم اعتماد الاسترداد فور اكتمال تقارير المرتجع.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-300 text-right">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 text-center w-8">#</th>
                      <th className="p-2.5">رقم الفاتورة والطلب</th>
                      <th className="p-2.5">اسم العميل</th>
                      <th className="p-2.5 text-center">طريقة الدفع</th>
                      <th className="p-2.5">أكواد الأصناف المرتجعة</th>
                      <th className="p-2.5 text-center">إجمالي الكمية</th>
                      <th className="p-2.5 text-center">إجمالي مبلغ الاسترداد</th>
                      <th className="p-2.5 text-center">حالة الاسترداد</th>
                      <th className="p-2.5 text-center">عرض وإعادة الفتح</th>
                      <th className="p-2.5">المراجع وتاريخ الاعتماد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {completedReports.map((rep, idx) => (
                      <tr key={rep.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2.5">
                          <button
                            onClick={() => setViewingReportModal(rep)}
                            className="font-bold text-amber-400 hover:text-amber-300 font-mono text-right hover:underline"
                            title="فتح المستند للعرض"
                          >
                            {rep.originalInvoiceNo}
                          </button>
                          {rep.orderNo && <div className="text-[11px] text-slate-400 font-mono">طلب: {rep.orderNo}</div>}
                          <div className="text-[10px] text-slate-400 font-mono">إذن: {rep.returnReceiptNo}</div>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-200">
                          {rep.customerName}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            {rep.paymentMethod}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="text-[11px] text-slate-300 font-mono max-w-xs truncate">
                            {(rep.items || []).map(i => `${i.itemCode} (${i.actualReturnedQty})`).join(' ، ')}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-bold font-mono text-white">
                          {rep.totalReturnedQty}
                        </td>
                        <td className="p-2.5 text-center font-black font-mono text-emerald-400 text-sm">
                          {(Number(rep.totalRefundAmount) || 0).toFixed(2)} ر.س/ج.م
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>معتمد ومكتمل</span>
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingReportModal(rep)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              title="عرض تفاصيل الطلب"
                            >
                              <Eye className="w-3 h-3" />
                              <span>فتح</span>
                            </button>
                            <button
                              onClick={() => setReopenPrompt({
                                isOpen: true,
                                report: rep,
                                type: 'REFUND'
                              })}
                              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                              title="طلب إعادة فتح المستند المكتمل"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>إعادة الفتح</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-400">
                          <div>{rep.auditorName} ({rep.auditorId})</div>
                          <div>{new Date(rep.createdAt).toLocaleDateString('ar-EG')}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. SUB-TAB: COMPLETED RESTOCK ARCHIVE (سجل المرتجعات المكتملة للمستودع) */}
      {activeSubTab === 'completed_archive' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isRtl ? 'سجل المرتجعات المكتملة كارتجاع للمستودع 100%' : 'Completed Warehouse Restock Archive'}
                </h2>
                <p className="text-xs text-slate-400">
                  كافة الحبات المسجلة صالحة للارتجاع وتم إدخالها المستودع
                </p>
              </div>
            </div>

            <button
              onClick={() => exportCompletedReturnsToExcel(savedReports)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير إكسيل المرتجعات المكتملة</span>
            </button>
          </div>

          {completedReports.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              لا توجد تقارير مرتجعات مكتملة محفوظة بعد.
            </div>
          ) : (
            <div className="space-y-3">
              {completedReports.map(rep => (
                <div key={rep.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setViewingReportModal(rep)}
                        className="font-mono font-bold text-emerald-400 hover:text-emerald-300 text-sm underline flex items-center gap-1"
                        title="فتح رابط المستند للعرض"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{rep.returnReceiptNo}</span>
                      </button>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        فاتورة: {rep.originalInvoiceNo}
                      </span>
                      {rep.orderNo && (
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          طلب: {rep.orderNo}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">العميل: {rep.customerName}</span>
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                      <span>الأصناف: {rep.items?.length || 0}</span>
                      <span className="text-white font-bold">القطع المستلمة بالمستودع: {rep.totalReturnedQty}</span>
                      <span className="text-emerald-400 font-bold">قيمة الاسترداد: {rep.totalRefundAmount?.toFixed(2)} ر.س/ج.م</span>
                      <span>المراجع: {rep.auditorName}</span>
                      <span>{new Date(rep.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Details Link */}
                    <button
                      onClick={() => setViewingReportModal(rep)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                      title="فتح المستند"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>فتح</span>
                    </button>

                    {/* Reopen Button */}
                    <button
                      onClick={() => setReopenPrompt({
                        isOpen: true,
                        report: rep,
                        type: 'RETURN'
                      })}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      title="طلب إعادة فتح المستند المكتمل للتعديل"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>إعادة الفتح</span>
                    </button>

                    <button
                      onClick={() => exportReturnReportToExcel(rep)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-semibold"
                      title="تصدير Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => exportReturnReportToPdf(rep)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg text-xs font-semibold"
                      title="تصدير PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`هل أنت متأكد من حذف تقرير المرتجع ${rep.returnReceiptNo}؟`)) {
                          await deleteReturnReport(rep.id);
                          await loadSavedReports();
                        }
                      }}
                      className="p-2 bg-slate-800 hover:bg-red-950 text-red-400 rounded-lg text-xs"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. MODAL: LAB QUALITY REVIEW & RE-RECEIPT (مراجعة المعمل وإعادة الاستلام للمستودع) */}
      {selectedReportForLabReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    مراجعة معمل الجودة وإعادة الاستلام للمستودع
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    إذن المرتجع: <span className="text-amber-400 font-bold">{selectedReportForLabReview.returnReceiptNo}</span> | فاتورة: {selectedReportForLabReview.originalInvoiceNo}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedReportForLabReview(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lab Items Decision Grid */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300">
                الأصناف المحولة للمعمل للفحص والبت:
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedReportForLabReview.items
                  .filter(i => i.condition === 'TRANSFERRED_TO_LAB')
                  .map(item => (
                    <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-white font-mono text-xs">{item.itemCode}</div>
                        <div className="text-xs text-slate-300">{item.itemName}</div>
                        <div className="text-[11px] text-amber-400 font-mono">
                          الكمية المحولة: {item.actualReturnedQty} {item.unit} | السعر: {item.unitPrice}
                        </div>
                      </div>

                      {/* Lab Decision Radio / Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportForLabReview({
                              ...selectedReportForLabReview,
                              items: selectedReportForLabReview.items.map(i => 
                                i.id === item.id ? { ...i, labDecision: 'APPROVED_FOR_RESTOCK' } : i
                              )
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.labDecision === 'APPROVED_FOR_RESTOCK'
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>صالح للمستودع (مقبول)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportForLabReview({
                              ...selectedReportForLabReview,
                              items: selectedReportForLabReview.items.map(i => 
                                i.id === item.id ? { ...i, labDecision: 'REJECTED_SCRAP' } : i
                              )
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                            item.labDecision === 'REJECTED_SCRAP'
                              ? 'bg-red-600 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>مرفوض (هالك/إتلاف)</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Quality Auditor & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  أخصائي / مراجع المعمل المسؤول:
                </label>
                <input
                  type="text"
                  value={labAuditorName}
                  onChange={(e) => setLabAuditorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  تقرير وملاحظات فحص المعمل:
                </label>
                <input
                  type="text"
                  value={labReviewNotes}
                  onChange={(e) => setLabReviewNotes(e.target.value)}
                  placeholder="تم الفحص الكيميائي/الظاهري، سلامة التغليف والصلاحية..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedReportForLabReview(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveLabDecision}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد قرار المعمل وإنهاء الاستلام للمستودع</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. EMAIL DISPATCH TO FINANCE/RETURNS OFFICER MODAL */}
      {isEmailModalOpen && (() => {
        const totalRefundVal = completedReports.reduce((acc, r) => acc + (r.totalRefundAmount || 0), 0);
        const totalRestockedUnits = completedReports.reduce((acc, r) => acc + (r.totalReturnedQty || 0), 0);
        
        const methodTotals: Record<string, { count: number; total: number }> = {};
        completedReports.forEach(r => {
          const m = r.paymentMethod || 'OTHER';
          if (!methodTotals[m]) methodTotals[m] = { count: 0, total: 0 };
          methodTotals[m].count += 1;
          methodTotals[m].total += (r.totalRefundAmount || 0);
        });

        const subjectText = `[تقرير استرداد مالي معتمد] كشف المرتجعات المكتملة للمستودع - ${new Date().toLocaleDateString('ar-EG')}`;
        
        const methodLines = Object.entries(methodTotals).map(([m, data]) => {
          const label = m === 'CASH' ? 'نقدي (Cash)' : m === 'CARD' ? 'بطاقة بنكية (Card)' : m === 'BANK_TRANSFER' ? 'تحويل بنكي' : m === 'WALLET' ? 'محفظة إلكترونية' : m === 'CREDIT_NOTE' ? 'إشعار دائن' : m;
          return `• ${label}: عدد ${data.count} طلبات بمبلغ إجمالي (${data.total.toFixed(2)})`;
        }).join('\n');

        const emailBodyText = `عناية الزميل المحترم / مسؤول الاسترداد المالي والحسابات،

تحية طيبة وبعد،،

مرفق لسيادتكم كشف وتقارير طلبات الاسترداد المالي المعتمدة بعد إتمام مطابقة واستلام المرتجعات فعلياً بالمستودع 100% وإجراء الفحص المخبري والفني اللازم:

📊 ملخص التسوية المالية:
------------------------------------------
• عدد فواتير وطلبات الاسترداد المكتملة: ${completedReports.length} طلب
• إجمالي قيمة مبالغ الاسترداد المستحقة: ${totalRefundVal.toFixed(2)}
• إجمالي عدد الوحدات والقطع المستلمة بالمستودع: ${totalRestockedUnits} وحدة
• تاريخ الاعتماد: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}

💳 تفصيل طرق الدفع ومطابقة الاسترداد:
------------------------------------------
${methodLines || 'لا توجد طلبات مسجلة'}

📎 الملفات المرفقة:
• تم تصدير ملف إكسيل مالي شامل يتضمن 3 صفحات (كشف الطلبات الرئيسي، التفصيل بالباركود والأصناف، ومطابقة طرق الدفع).

يرجى التكرم باتخاذ اللازم نحو صرف/تحويل مبالغ الاسترداد للعملاء وفقاً لبيانات الكشف المرفق.

شاكرين ومقدرين حسن تعاونكم،
قسم إدارة ومراجعة المرتجعات والمستودع
المراجع: ${settings.auditorName || 'أحمد حمادة'} (${settings.auditorId || 'AUD-101'})`;

        const handleCopyEmail = () => {
          navigator.clipboard.writeText(emailBodyText);
          setEmailCopiedNotice(true);
          setTimeout(() => setEmailCopiedNotice(false), 3000);
        };

        const handleMailto = () => {
          const mailtoUrl = `mailto:${encodeURIComponent(officerEmail)}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(emailBodyText)}`;
          window.open(mailtoUrl, '_blank');
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">إرسال تقرير الاسترداد المالي للموظف المختص</h2>
                    <p className="text-xs text-slate-400">تجهيز الرسالة الإلكترونية وملف الإكسيل المرفق لإرساله فوراً للمحاسب أو مشرف المرتجعات</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Recipient Setup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    البريد الإلكتروني للموظف المختص:
                  </label>
                  <input
                    type="email"
                    value={officerEmail}
                    onChange={(e) => setOfficerEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="finance@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اختيار سريع لجهة الموظف:
                  </label>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setOfficerRole('FINANCE'); setOfficerEmail('finance-returns@company.com'); }}
                      className={`flex-1 py-1.5 px-2 rounded text-[11px] font-bold border transition-all ${
                        officerRole === 'FINANCE' ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      الحسابات والمالية
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOfficerRole('RETURNS_MGR'); setOfficerEmail('returns-supervisor@company.com'); }}
                      className={`flex-1 py-1.5 px-2 rounded text-[11px] font-bold border transition-all ${
                        officerRole === 'RETURNS_MGR' ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      مشرف المرتجعات
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOfficerRole('STORE_MGR'); setOfficerEmail('store-ops@company.com'); }}
                      className={`flex-1 py-1.5 px-2 rounded text-[11px] font-bold border transition-all ${
                        officerRole === 'STORE_MGR' ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      إدارة المتجر
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Cards */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 font-semibold">طلبات الاسترداد</div>
                  <div className="text-base font-black text-purple-400 font-mono">{completedReports.length}</div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 font-semibold">إجمالي المبالغ المستحقة</div>
                  <div className="text-base font-black text-emerald-400 font-mono">{totalRefundVal.toFixed(2)}</div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 font-semibold">القطع المستلمة بالمستودع</div>
                  <div className="text-base font-black text-blue-400 font-mono">{totalRestockedUnits}</div>
                </div>
              </div>

              {/* Email Content Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">معاينة نص البريد الإلكتروني الجاهز للإرسال:</label>
                  {emailCopiedNotice && (
                    <span className="text-[11px] font-bold text-emerald-400 animate-pulse">✓ تم نسخ النص إلى الحافظة!</span>
                  )}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-56 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {emailBodyText}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportCompletedRefundsToExcel(savedReports)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md transition-all"
                    title="تحميل ملف الإكسيل لرفعه كمرفق مع البريد"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تنزيل ملف الإكسيل المرفق</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-purple-300 border border-purple-500/30 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>نسخ نص البريد</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                  >
                    إغلاق
                  </button>

                  <button
                    type="button"
                    onClick={handleMailto}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>فتح تطبيق البريد (mailto)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 9. REOPEN CONFIRMATION MODAL (شرط الموافقة عند فتح مستند تم إنهاؤه: نعم - لا - إلغاء) */}
      <ReopenConfirmationModal
        isOpen={reopenPrompt.isOpen}
        onClose={() => setReopenPrompt({ isOpen: false, report: null, type: 'RETURN' })}
        onDeny={() => {
          setReopenPrompt({ isOpen: false, report: null, type: 'RETURN' });
        }}
        onConfirm={handleConfirmReopen}
        documentTitle={reopenPrompt.report ? `${reopenPrompt.report.returnReceiptNo} (فاتورة ${reopenPrompt.report.originalInvoiceNo})` : ''}
        documentTypeLabel={reopenPrompt.type === 'REFUND' ? 'طلب استرداد مالي' : 'تقرير مرتجع مستودع'}
        isRtl={isRtl}
      />

      {/* 10. READ-ONLY DOCUMENT DETAILS VIEW MODAL (عرض تفاصيل المستند) */}
      {viewingReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-6 text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    تفاصيل مستند المرتجع: <span className="font-mono text-emerald-400">{viewingReportModal.returnReceiptNo}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    فاتورة: {viewingReportModal.originalInvoiceNo} | العميل: {viewingReportModal.customerName} | الدفع: {viewingReportModal.paymentMethod}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingReportModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto max-h-72 border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 text-center w-8">#</th>
                    <th className="p-2.5">كود الصنف والاسم</th>
                    <th className="p-2.5 text-center">الكمية بالفاتورة</th>
                    <th className="p-2.5 text-center">المرتجع الفعلي</th>
                    <th className="p-2.5 text-center">سعر الوحدة</th>
                    <th className="p-2.5 text-center">إجمالي الاسترداد</th>
                    <th className="p-2.5 text-center">حالة الفحص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(viewingReportModal.items || []).map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-800/30">
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-white font-mono">{item.itemCode}</div>
                        <div className="text-[11px] text-slate-400">{item.itemName}</div>
                      </td>
                      <td className="p-2.5 text-center font-mono">{item.invoicedQty} {item.unit}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-emerald-400">{item.actualReturnedQty} {item.unit}</td>
                      <td className="p-2.5 text-center font-mono">{item.unitPrice}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-white">{(item.refundTotal || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.condition === 'VALID_FOR_RESTOCK' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {item.condition === 'VALID_FOR_RESTOCK' ? 'صالح للمستودع' : 'محول للمعمل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <div>
                <span className="text-slate-400 block">إجمالي القطع المرتجعة</span>
                <strong className="text-white text-sm font-mono">{viewingReportModal.totalReturnedQty}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">إجمالي الاسترداد المالي</span>
                <strong className="text-emerald-400 text-sm font-mono">{(viewingReportModal.totalRefundAmount || 0).toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">المراجع المسؤول</span>
                <strong className="text-slate-200">{viewingReportModal.auditorName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">تاريخ الاعتماد</span>
                <strong className="text-slate-300">{new Date(viewingReportModal.createdAt).toLocaleDateString('ar-EG')}</strong>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const rep = viewingReportModal;
                  setViewingReportModal(null);
                  setReopenPrompt({ isOpen: true, report: rep, type: 'RETURN' });
                }}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>طلب إعادة الفتح للتعديل</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportRefundRequestExcelFormatted(viewingReportModal)}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                  title="تصدير نموذج Refund Request المعتمد"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>نموذج Refund Request (Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportReturnReportToExcel(viewingReportModal)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportReturnReportToPdf(viewingReportModal)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReportModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Internal Discrepancy Modal (خدمة داخلية مكررة في الواجهة) */}
      <InternalDiscrepancyModal
        isOpen={isInternalDiscrepancyOpen}
        onClose={() => setIsInternalDiscrepancyOpen(false)}
        discrepancies={discrepancies}
        wrongPickings={wrongPickings}
        onRefresh={onRefreshDiscrepancies}
        settings={settings}
      />

      {/* Interactive Multi-PDF Batch Upload & Progress Extraction Modal */}
      <PdfBatchUploadModal
        isOpen={isPdfBatchModalOpen}
        onClose={() => setIsPdfBatchModalOpen(false)}
        onExtractionComplete={handleBatchExtractionComplete}
        currentItemsCount={returnItems.length}
        settings={settings}
        isRtl={isRtl}
      />
    </div>
  );
};
