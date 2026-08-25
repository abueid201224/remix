import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Files, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  Database,
  ArrowRight,
  Check,
  Package,
  FileUp,
  FolderPlus,
  Play,
  RotateCcw,
  Eye,
  Search,
  DollarSign
} from 'lucide-react';
import { parsePdfInvoice, type ExtractedPdfDocument, type ExtractedPdfItem } from '../services/pdfService';
import type { ReturnSessionItem, AppSettings } from '../types';
import { SoundEffects } from '../services/audio';

export interface BatchExtractionResult {
  items: ReturnSessionItem[];
  originalInvoiceNos: string[];
  orderNos: string[];
  customerNames: string[];
  paymentMethods: string[];
  fileSummaries: { name: string; invoiceNo?: string; count: number; totalQty: number; subtotal: number }[];
  appendMode: boolean;
  isFullReturnDefault: boolean;
}

interface PdfBatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExtractionComplete: (result: BatchExtractionResult) => void;
  currentItemsCount: number;
  settings: AppSettings;
  isRtl?: boolean;
}

export interface FileQueueItem {
  id: string;
  file: File;
  name: string;
  sizeFormatted: string;
  status: 'PENDING' | 'READING_PDF' | 'EXTRACTING_HEADER' | 'PARSING_ITEMS' | 'SUCCESS' | 'ERROR';
  progressPercent: number;
  extractedDoc?: ExtractedPdfDocument;
  itemsCount?: number;
  totalQty?: number;
  subtotalSum?: number;
  errorMessage?: string;
}

export const PdfBatchUploadModal: React.FC<PdfBatchUploadModalProps> = ({
  isOpen,
  onClose,
  onExtractionComplete,
  currentItemsCount,
  settings,
  isRtl = true,
}) => {
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appendMode, setAppendMode] = useState(currentItemsCount > 0);
  const [isFullReturnDefault, setIsFullReturnDefault] = useState(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [activeStep, setActiveStep] = useState<'SELECT' | 'EXTRACTING' | 'PREVIEW'>('SELECT');
  const [searchPreviewQuery, setSearchPreviewQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    const validPdfs: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        validPdfs.push(f);
      }
    }

    if (validPdfs.length === 0) {
      alert(isRtl ? 'يرجى اختيار ملفات بصيغة PDF صالحة.' : 'Please select valid PDF files.');
      return;
    }

    const newQueueItems: FileQueueItem[] = validPdfs.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      name: file.name,
      sizeFormatted: formatFileSize(file.size),
      status: 'PENDING',
      progressPercent: 0,
    }));

    setFileQueue(prev => [...prev, ...newQueueItems]);
    if (activeStep === 'SELECT') {
      // stay on select or show ready
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const handleClearAll = () => {
    setFileQueue([]);
    setActiveStep('SELECT');
    setCurrentProcessingIndex(-1);
  };

  // Run the step-by-step extraction across the batch
  const startExtractionProcess = async () => {
    if (fileQueue.length === 0) return;
    setIsProcessing(true);
    setActiveStep('EXTRACTING');

    for (let i = 0; i < fileQueue.length; i++) {
      setCurrentProcessingIndex(i);
      const queueItem = fileQueue[i];

      // Step 1: Reading PDF
      setFileQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'READING_PDF', progressPercent: 25 } : item
      ));
      await new Promise(r => setTimeout(r, 60));

      try {
        // Step 2: Extracting Header & text
        setFileQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'EXTRACTING_HEADER', progressPercent: 55 } : item
        ));

        const extracted = await parsePdfInvoice(queueItem.file, false);

        // Step 3: Parsing items
        setFileQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'PARSING_ITEMS', progressPercent: 85 } : item
        ));
        await new Promise(r => setTimeout(r, 50));

        let totalQty = 0;
        let subtotalSum = 0;
        extracted.items.forEach(it => {
          totalQty += (it.quantity || 1);
          subtotalSum += (it.subtotal || it.totalPrice || ((it.unitPrice || 0) * (it.quantity || 1)));
        });

        // Step 4: Success
        setFileQueue(prev => prev.map((item, idx) => 
          idx === i ? { 
            ...item, 
            status: 'SUCCESS', 
            progressPercent: 100,
            extractedDoc: extracted,
            itemsCount: extracted.items.length,
            totalQty,
            subtotalSum
          } : item
        ));
      } catch (err) {
        setFileQueue(prev => prev.map((item, idx) => 
          idx === i ? { 
            ...item, 
            status: 'ERROR', 
            progressPercent: 100,
            errorMessage: (err as Error).message || 'فشل استخلاص البيانات من ملف الـ PDF'
          } : item
        ));
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
    setActiveStep('PREVIEW');
    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
  };

  // Compute aggregated stats
  const successfulDocs = fileQueue.filter(f => f.status === 'SUCCESS' && f.extractedDoc);
  const totalItemsCount = successfulDocs.reduce((acc, curr) => acc + (curr.itemsCount || 0), 0);
  const totalPiecesCount = successfulDocs.reduce((acc, curr) => acc + (curr.totalQty || 0), 0);
  const totalSubtotalSum = successfulDocs.reduce((acc, curr) => acc + (curr.subtotalSum || 0), 0);

  const overallCompletedCount = fileQueue.filter(f => f.status === 'SUCCESS' || f.status === 'ERROR').length;
  const overallProgressPercentage = fileQueue.length > 0 
    ? Math.round((overallCompletedCount / fileQueue.length) * 100) 
    : 0;

  // Final Confirmation & Submission to ReturnsScreen
  const handleConfirmAndImport = () => {
    if (successfulDocs.length === 0) {
      alert(isRtl ? 'لا توجد مستندات تم استخلاصها بنجاح للاستيراد.' : 'No successfully extracted documents to import.');
      return;
    }

    const compiledItems: ReturnSessionItem[] = [];
    const docNumbers: string[] = [];
    const orderNumbers: string[] = [];
    const customerNames: string[] = [];
    const paymentMethods: string[] = [];
    const fileSummaries: { name: string; invoiceNo?: string; count: number; totalQty: number; subtotal: number }[] = [];

    successfulDocs.forEach((docItem, fIndex) => {
      const extracted = docItem.extractedDoc!;
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
      let fileSubtotal = 0;

      const itemsFromFile: ReturnSessionItem[] = extracted.items.map((item, itemIdx) => {
        const itemSubtotal = item.subtotal || item.totalPrice || (item.unitPrice ? item.quantity * item.unitPrice : 0);
        const invoicedQuantity = item.quantity || 1;
        fileTotalQty += invoicedQuantity;
        fileSubtotal += itemSubtotal;

        const computedUnitPrice = (invoicedQuantity > 0 && itemSubtotal > 0)
          ? Number((itemSubtotal / invoicedQuantity).toFixed(2))
          : (item.unitPrice || 0);

        const initialQty = isFullReturnDefault ? invoicedQuantity : 0;
        const computedRefund = (initialQty === invoicedQuantity && itemSubtotal > 0)
          ? itemSubtotal
          : Number((initialQty * (itemSubtotal > 0 ? itemSubtotal / invoicedQuantity : computedUnitPrice)).toFixed(2));

        return {
          id: item.id || `ret-pdf-${Date.now()}-${fIndex}-${itemIdx}-${Math.random().toString(36).substring(2, 7)}`,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit || 'PCS',
          invoiceNo: extracted.documentNo || undefined,
          sourceFile: docItem.name,
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

      compiledItems.push(...itemsFromFile);
      fileSummaries.push({
        name: docItem.name,
        invoiceNo: extracted.documentNo,
        count: itemsFromFile.length,
        totalQty: fileTotalQty,
        subtotal: fileSubtotal,
      });
    });

    onExtractionComplete({
      items: compiledItems,
      originalInvoiceNos: docNumbers,
      orderNos: orderNumbers,
      customerNames,
      paymentMethods,
      fileSummaries,
      appendMode,
      isFullReturnDefault,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shadow-inner">
              <Files className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>رفع واستخلاص ملفات PDF المرتجعات المجمعة</span>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono">
                  Smart PDF Batch AI
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                استيراد تلقائي لبيانات الفواتير المرتجعة، تفكيك جدول الأصناف، وحساب المجموع والمبالغ بضغطة زر واحدة.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Step 1: Dropzone & File Selection */}
          {activeStep === 'SELECT' && (
            <div className="space-y-4">
              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-400 bg-amber-950/30 scale-[1.01]'
                    : 'border-slate-700 hover:border-amber-500/70 bg-slate-950/60 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files) handleFilesAdded(e.target.files);
                    e.target.value = '';
                  }}
                  accept=".pdf"
                  multiple
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                    <FileUp className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white">
                      اسحب وأفلت ملفات PDF هنا، أو <span className="text-amber-400 underline">تصفح لاختيار ملفات</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      يدعم رفع ملف واحد أو عشرات الفواتير دفعة واحدة (استخلاص فوري لرقم الفاتورة، جدول الأصناف، والأسعار)
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Options (Append / Replace & Default Quantities) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">طريقة الإدراج في طاولة الفحص:</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAppendMode(false)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                        !appendMode 
                          ? 'bg-amber-600 border-amber-500 text-white shadow-md' 
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      جلسة جديدة (تفريغ واستبدال)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppendMode(true)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                        appendMode 
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' 
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <FolderPlus className="w-3.5 h-3.5 inline ml-1" />
                      دمج (+ إضافة للحالية)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">كمية المرتجع المبدئية عند الاستيراد:</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFullReturnDefault(false)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                        !isFullReturnDefault 
                          ? 'bg-amber-600 border-amber-500 text-white shadow-md' 
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      البدء من 0 (المسح بالسكانر)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullReturnDefault(true)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                        isFullReturnDefault 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      ارتجاع كامل (100% تلقائي)
                    </button>
                  </div>
                </div>
              </div>

              {/* Selected Files Queue Preview */}
              {fileQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Files className="w-4 h-4 text-amber-400" />
                      <span>الملفات المحددة للاستيراد ({fileQueue.length} ملفات):</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                    >
                      مسح القائمة
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {fileQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-slate-500 text-[11px] w-5 text-center">{idx + 1}</span>
                          <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span className="text-white font-medium truncate font-mono" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded font-mono">
                            {item.sizeFormatted}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 & 3: Extraction In-Progress & Preview Mode */}
          {(activeStep === 'EXTRACTING' || activeStep === 'PREVIEW') && (
            <div className="space-y-4">
              
              {/* Overall Progress Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-950/50 via-slate-950 to-slate-950 border border-amber-500/40 rounded-2xl shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    {isProcessing ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {isProcessing 
                          ? `جاري استخلاص ملفات الـ PDF (${overallCompletedCount} من ${fileQueue.length} ملف)`
                          : `اكتمل استخلاص كافة الملفات بنجاح (${successfulDocs.length} من ${fileQueue.length} ملف جاهز)`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isProcessing 
                          ? `الملف الحالي: ${fileQueue[currentProcessingIndex]?.name || '...'}`
                          : 'تم استخراج كافة جداول الأصناف ورؤوس الفواتير ومبالغ الاسترداد.'}
                      </p>
                    </div>
                  </div>
                  <div className="text-left font-mono text-lg font-bold text-amber-400">
                    {overallProgressPercentage}%
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      isProcessing 
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400' 
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                    style={{ width: `${overallProgressPercentage}%` }}
                  />
                </div>

                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">الملفات الناجحة</span>
                    <span className="text-sm font-bold font-mono text-white">{successfulDocs.length} / {fileQueue.length}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">إجمالي بنود الأصناف</span>
                    <span className="text-sm font-bold font-mono text-amber-400">{totalItemsCount} صنف</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">إجمالي كمية القطع</span>
                    <span className="text-sm font-bold font-mono text-blue-400">{totalPiecesCount} قطعة</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">إجمالي القيمة التقديرية</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">{totalSubtotalSum.toLocaleString()} ر.س</span>
                  </div>
                </div>
              </div>

              {/* Per-File Progress & Details List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>سجل المعالجة التفصيلي للملفات:</span>
                  {activeStep === 'PREVIEW' && (
                    <button
                      onClick={() => setActiveStep('SELECT')}
                      className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إضافة أو تعديل الملفات</span>
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {fileQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all text-xs ${
                        item.status === 'SUCCESS'
                          ? 'bg-slate-950 border-emerald-500/40'
                          : item.status === 'ERROR'
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : item.status !== 'PENDING'
                          ? 'bg-amber-950/20 border-amber-500/60'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-500 text-[11px]">{idx + 1}.</span>
                          <FileText className={`w-4 h-4 flex-shrink-0 ${
                            item.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
                          }`} />
                          <span className="font-bold text-white font-mono truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">({item.sizeFormatted})</span>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-2">
                          {item.status === 'PENDING' && (
                            <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded text-[11px]">
                              ⏳ بانتظار البدء
                            </span>
                          )}
                          {item.status === 'READING_PDF' && (
                            <span className="text-amber-400 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>1. قراءة الملف...</span>
                            </span>
                          )}
                          {item.status === 'EXTRACTING_HEADER' && (
                            <span className="text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>2. استخراج الفاتورة والعميل...</span>
                            </span>
                          )}
                          {item.status === 'PARSING_ITEMS' && (
                            <span className="text-purple-400 bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>3. تفكيك جدول الأصناف...</span>
                            </span>
                          )}
                          {item.status === 'SUCCESS' && (
                            <span className="text-emerald-300 bg-emerald-950 border border-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>تم الاستخلاص: {item.itemsCount} صنف ({item.totalQty} قطعة)</span>
                            </span>
                          )}
                          {item.status === 'ERROR' && (
                            <span className="text-rose-300 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                              <span>فشل: {item.errorMessage}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail row if success */}
                      {item.status === 'SUCCESS' && item.extractedDoc && (
                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                          {item.extractedDoc.documentNo && (
                            <span className="bg-slate-900 text-blue-300 border border-blue-800/40 px-2 py-0.5 rounded font-mono">
                              فاتورة: #{item.extractedDoc.documentNo}
                            </span>
                          )}
                          {item.extractedDoc.orderNo && (
                            <span className="bg-slate-900 text-slate-300 px-2 py-0.5 rounded font-mono">
                              طلب: {item.extractedDoc.orderNo}
                            </span>
                          )}
                          {item.extractedDoc.customerName && (
                            <span className="bg-slate-900 text-slate-300 px-2 py-0.5 rounded">
                              العميل: {item.extractedDoc.customerName}
                            </span>
                          )}
                          {item.extractedDoc.paymentMethod && (
                            <span className="bg-slate-900 text-amber-300 px-2 py-0.5 rounded">
                              الدفع: {item.extractedDoc.paymentMethod}
                            </span>
                          )}
                          <span className="mr-auto font-mono text-emerald-400 font-bold">
                            {(item.subtotalSum || 0).toLocaleString()} ر.س
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {fileQueue.length > 0 ? (
              <span>
                إجمالي الملفات: <strong className="text-white font-mono">{fileQueue.length}</strong> | 
                طريقة الدمج: <strong className="text-amber-400">{appendMode ? 'إضافة (+ دمج)' : 'تفريغ وجديد'}</strong>
              </span>
            ) : (
              <span>اختر ملفات PDF للبدء في الاستخلاص التلقائي</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>

            {activeStep === 'SELECT' && (
              <button
                type="button"
                onClick={startExtractionProcess}
                disabled={fileQueue.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>بدء رفع واستخلاص البيانات ({fileQueue.length} ملفات)</span>
              </button>
            )}

            {activeStep === 'EXTRACTING' && (
              <button
                type="button"
                disabled
                className="px-5 py-2 bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 opacity-80 cursor-wait"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري استخلاص الداتا... ({overallProgressPercentage}%)</span>
              </button>
            )}

            {activeStep === 'PREVIEW' && (
              <button
                type="button"
                onClick={handleConfirmAndImport}
                disabled={successfulDocs.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد الاستيراد لطاولة الفحص ({totalItemsCount} صنف)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
