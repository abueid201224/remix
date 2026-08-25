import React, { useState, useEffect } from 'react';
import {
  Truck,
  FileSpreadsheet,
  Upload,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  Search,
  Download,
  Calendar,
  Layers,
  FileText,
  Sparkles,
  ArrowDownToLine,
  FileCheck,
  Boxes,
  Sliders,
  Pin,
  Lock,
  Unlock,
  Eye,
  X,
  BookOpen
} from 'lucide-react';
import type { 
  AppSettings, 
  ReceivingReport, 
  ReceivingSessionItem, 
  PackagingGroupRule, 
  ActiveTargetColumn,
  DocumentReopenPrompt 
} from '../types';
import {
  parseExcelReceivingFile,
  downloadReceivingExcelTemplate,
  exportReceivingReportToExcel,
  exportAllReceivingReportsToExcel
} from '../services/excelService';
import { parsePdfInvoice } from '../services/pdfService';
import { 
  getAllReceivingReports, 
  saveReceivingReport, 
  deleteReceivingReport,
  getPackagingGroupRules,
  matchBarcodeToPackagingRule
} from '../services/db';
import { SoundEffects } from '../services/audio';
import { PackagingRulesModal } from './PackagingRulesModal';
import { ReopenConfirmationModal } from './ReopenConfirmationModal';

interface ReceivingScreenProps {
  settings: AppSettings;
  lastScannedCode?: string | null;
  onOpenLogicGuide?: (tab?: string) => void;
}

export const ReceivingScreen: React.FC<ReceivingScreenProps> = ({
  settings,
  lastScannedCode,
  onOpenLogicGuide,
}) => {
  const isRtl = settings.language === 'ar';

  const [poNumber, setPoNumber] = useState(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [supplierName, setSupplierName] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [items, setItems] = useState<ReceivingSessionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [savedReports, setSavedReports] = useState<ReceivingReport[]>([]);
  const [activeTab, setActiveTab] = useState<'receiving' | 'history'>('receiving');
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [packagingRules, setPackagingRules] = useState<PackagingGroupRule[]>([]);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Touch column header locking state
  const [activeTargetColumn, setActiveTargetColumn] = useState<ActiveTargetColumn>('pieces');

  // Re-open security prompt and read-only preview modal states
  const [reopenPrompt, setReopenPrompt] = useState<DocumentReopenPrompt | null>(null);
  const [viewingReport, setViewingReport] = useState<ReceivingReport | null>(null);

  useEffect(() => {
    loadSavedReports();
    loadPackagingRules();
  }, []);

  const loadSavedReports = async () => {
    const list = await getAllReceivingReports();
    setSavedReports(list);
  };

  const loadPackagingRules = async () => {
    const rules = await getPackagingGroupRules();
    setPackagingRules(rules);
  };

  // Helper to get packaging factors
  const resolveFactors = (barcode: string, currentRules: PackagingGroupRule[]) => {
    const matchedRule = matchBarcodeToPackagingRule(barcode, currentRules);
    return {
      cartonFactor: matchedRule?.cartonFactor || 24,
      packFactor: matchedRule?.packFactor || 6,
    };
  };

  // Calculate total received from packaging columns
  const computeTotalReceived = (cartons: number, cartonFactor: number, packs: number, packFactor: number, pieces: number) => {
    return (cartons * (cartonFactor || 1)) + (packs * (packFactor || 1)) + pieces;
  };

  // Hardware Scanner Integration with activeTargetColumn routing
  useEffect(() => {
    if (!lastScannedCode || activeTab !== 'receiving') return;
    const clean = lastScannedCode.trim();
    if (!clean) return;

    setItems(prev => {
      const idx = prev.findIndex(i => i.itemCode.toLowerCase() === clean.toLowerCase());
      if (idx !== -1) {
        const updated = [...prev];
        const cur = updated[idx];
        const cFactor = cur.cartonFactor || 24;
        const pFactor = cur.packFactor || 6;

        let nextCartons = cur.cartonsCount || 0;
        let nextPacks = cur.packsCount || 0;
        let nextPieces = cur.piecesCount || 0;

        if (activeTargetColumn === 'cartons') {
          nextCartons += 1;
        } else if (activeTargetColumn === 'packs') {
          nextPacks += 1;
        } else {
          nextPieces += 1;
        }

        const nextRec = computeTotalReceived(nextCartons, cFactor, nextPacks, pFactor, nextPieces);

        updated[idx] = {
          ...cur,
          cartonsCount: nextCartons,
          packsCount: nextPacks,
          piecesCount: nextPieces,
          receivedQty: nextRec,
          status: nextRec === cur.expectedQty ? 'EXACT' : nextRec < cur.expectedQty ? 'SHORTAGE' : 'SURPLUS',
        };

        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
        return updated;
      } else {
        const factors = resolveFactors(clean, packagingRules);
        let initCartons = 0;
        let initPacks = 0;
        let initPieces = 0;

        if (activeTargetColumn === 'cartons') initCartons = 1;
        else if (activeTargetColumn === 'packs') initPacks = 1;
        else initPieces = 1;

        const nextRec = computeTotalReceived(initCartons, factors.cartonFactor, initPacks, factors.packFactor, initPieces);

        const newItem: ReceivingSessionItem = {
          id: `rec-item-${Date.now()}`,
          itemCode: clean,
          itemName: `صنف وارد جديد ${clean}`,
          unit: 'PCS',
          expectedQty: 1,
          receivedQty: nextRec,
          damagedQty: 0,
          cartonFactor: factors.cartonFactor,
          packFactor: factors.packFactor,
          cartonsCount: initCartons,
          packsCount: initPacks,
          piecesCount: initPieces,
          status: nextRec === 1 ? 'EXACT' : nextRec < 1 ? 'SHORTAGE' : 'SURPLUS',
          notes: 'صنف وارد إضافي تم مسحه بالباركود',
        };

        if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
        return [newItem, ...prev];
      }
    });
  }, [lastScannedCode, activeTargetColumn, packagingRules, activeTab, settings.soundEnabled, settings.soundVolume]);

  // Import Excel PO (Primary & Default)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelReceivingFile(file);
      if (parsed.items.length > 0) {
        if (parsed.poNumber) setPoNumber(parsed.poNumber);
        if (parsed.supplierName) setSupplierName(parsed.supplierName);
        if (parsed.deliveryNoteNo) setDeliveryNoteNo(parsed.deliveryNoteNo);

        const mapped: ReceivingSessionItem[] = parsed.items.map((item, idx) => {
          const factors = resolveFactors(item.itemCode, packagingRules);
          return {
            id: `rec-${idx}-${Date.now()}`,
            itemCode: item.itemCode,
            itemName: item.itemName,
            unit: item.unit,
            expectedQty: item.expectedQty,
            receivedQty: 0,
            damagedQty: 0,
            cartonFactor: factors.cartonFactor,
            packFactor: factors.packFactor,
            cartonsCount: 0,
            packsCount: 0,
            piecesCount: 0,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            status: 'SHORTAGE',
          };
        });

        setItems(mapped);
        setImportNotice(`تم استيراد ${mapped.length} صنف بنجاح من ملف الإكسيل (${file.name})`);
        if (settings.soundEnabled) SoundEffects.playExactComplete(settings.soundVolume);
        setTimeout(() => setImportNotice(null), 4000);
      } else {
        alert('لم يتم العثور على أصناف صالحة في ملف الإكسيل.');
      }
    } catch (err) {
      alert(`خطأ في استيراد إكسيل: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Import PDF PO (Secondary option)
  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const extracted = await parsePdfInvoice(file);
      if (extracted.documentNo) setPoNumber(extracted.documentNo);
      if (extracted.customerName) setSupplierName(extracted.customerName);

      const mapped: ReceivingSessionItem[] = extracted.items.map((item, idx) => {
        const factors = resolveFactors(item.itemCode, packagingRules);
        return {
          id: `rec-pdf-${idx}-${Date.now()}`,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
          expectedQty: item.quantity,
          receivedQty: 0,
          damagedQty: 0,
          cartonFactor: factors.cartonFactor,
          packFactor: factors.packFactor,
          cartonsCount: 0,
          packsCount: 0,
          piecesCount: 0,
          status: 'SHORTAGE',
        };
      });

      setItems(mapped);
      setImportNotice(`تم استيراد ${mapped.length} صنف بنجاح من مستند PDF (${file.name})`);
      if (settings.soundEnabled) SoundEffects.playExactComplete(settings.soundVolume);
      setTimeout(() => setImportNotice(null), 4000);
    } catch (err) {
      alert(`خطأ في قراءة ملف PDF: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Direct manual update of item packaging or fields
  const handleUpdateItem = (id: string, updates: Partial<ReceivingSessionItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const merged = { ...item, ...updates };
        const cFactor = merged.cartonFactor || 24;
        const pFactor = merged.packFactor || 6;
        const cCount = merged.cartonsCount || 0;
        const pCount = merged.packsCount || 0;
        const loose = merged.piecesCount || 0;

        // If packaging columns updated, recompute receivedQty
        if (updates.cartonsCount !== undefined || updates.packsCount !== undefined || updates.piecesCount !== undefined || updates.cartonFactor !== undefined || updates.packFactor !== undefined) {
          merged.receivedQty = computeTotalReceived(cCount, cFactor, pCount, pFactor, loose);
        }

        merged.status = merged.receivedQty === merged.expectedQty ? 'EXACT' : merged.receivedQty < merged.expectedQty ? 'SHORTAGE' : 'SURPLUS';
        return merged;
      }
      return item;
    }));
  };

  // Add Manual Item
  const handleAddManual = () => {
    const clean = manualBarcode.trim();
    if (!clean) return;

    const factors = resolveFactors(clean, packagingRules);
    let initCartons = 0;
    let initPacks = 0;
    let initPieces = 0;

    if (activeTargetColumn === 'cartons') initCartons = 1;
    else if (activeTargetColumn === 'packs') initPacks = 1;
    else initPieces = 1;

    const recQty = computeTotalReceived(initCartons, factors.cartonFactor, initPacks, factors.packFactor, initPieces);

    const newItem: ReceivingSessionItem = {
      id: `manual-rec-${Date.now()}`,
      itemCode: clean,
      itemName: `صنف استلام ${clean}`,
      unit: 'PCS',
      expectedQty: 1,
      receivedQty: recQty,
      damagedQty: 0,
      cartonFactor: factors.cartonFactor,
      packFactor: factors.packFactor,
      cartonsCount: initCartons,
      packsCount: initPacks,
      piecesCount: initPieces,
      status: recQty === 1 ? 'EXACT' : recQty < 1 ? 'SHORTAGE' : 'SURPLUS',
    };

    setItems(prev => [newItem, ...prev]);
    setManualBarcode('');
    if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
  };

  // Save Receiving Report (Locks document)
  const handleSaveReport = async () => {
    if (items.length === 0) {
      alert('لا توجد أصناف في بيان الاستلام لحفظه.');
      return;
    }

    const totalExp = items.reduce((acc, i) => acc + i.expectedQty, 0);
    const totalRec = items.reduce((acc, i) => acc + i.receivedQty, 0);
    const totalDam = items.reduce((acc, i) => acc + i.damagedQty, 0);

    const report: ReceivingReport = {
      id: `rec-rep-${Date.now()}`,
      poNumber,
      supplierName: supplierName || 'مورد عام',
      deliveryNoteNo,
      createdAt: new Date().toISOString(),
      auditorName: settings.auditorName || 'أحمد حمادة',
      auditorId: settings.auditorId || 'AUD-101',
      auditorSignature: settings.auditorSignature,
      status: totalRec === totalExp ? 'ACCEPTED_FULL' : 'ACCEPTED_WITH_VARIANCE',
      items,
      totalExpectedQty: totalExp,
      totalReceivedQty: totalRec,
      totalDamagedQty: totalDam,
    };

    await saveReceivingReport(report);
    await loadSavedReports();
    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
    alert(`تم اعتماد وقفل إذن الاستلام بنجاح (${poNumber})`);
  };

  // Re-open Request Handler
  const handleRequestReopen = (report: ReceivingReport) => {
    setReopenPrompt({
      isOpen: true,
      documentType: 'RECEIVING',
      documentId: report.id,
      documentNo: report.poNumber,
      title: `إذن استلام وارد رقم ${report.poNumber} (${report.supplierName})`,
      onConfirm: () => handleConfirmReopen(report),
    });
  };

  // Confirm Re-open
  const handleConfirmReopen = (report: ReceivingReport) => {
    setPoNumber(report.poNumber);
    setSupplierName(report.supplierName);
    setDeliveryNoteNo(report.deliveryNoteNo || '');
    setItems(report.items || []);
    setActiveTab('receiving');
    setReopenPrompt(null);
    if (settings.soundEnabled) SoundEffects.playInvoiceUnlock(settings.soundVolume);
    setImportNotice(`تمت إعادة فتح إذن الاستلام (${report.poNumber}) للتعديل اليدوي والمسح الإضافي`);
  };

  const totalExpected = items.reduce((acc, i) => acc + i.expectedQty, 0);
  const totalReceived = items.reduce((acc, i) => acc + i.receivedQty, 0);
  const totalDamaged = items.reduce((acc, i) => acc + i.damagedQty, 0);
  const totalCartons = items.reduce((acc, i) => acc + (i.cartonsCount || 0), 0);
  const totalPacks = items.reduce((acc, i) => acc + (i.packsCount || 0), 0);
  const totalPieces = items.reduce((acc, i) => acc + (i.piecesCount || 0), 0);

  const filteredItems = items.filter(item => 
    !searchQuery || 
    item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">
                  {isRtl ? 'استلام ومطابقة البضائع الواردة (Inbound Receiving)' : 'Inbound Receiving & PO Match'}
                </h1>
                <span className="text-[11px] bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-700 font-mono font-bold">
                  {poNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'مطابقة بوالص الشحن، تجميع العبوات (كراتين + باكتات + حبات)، وتثبيت الأعمدة باللمس مع خيار إعادة الفتح الآمن' 
                  : 'Inbound PO matching, packaging multiplier & touch column header locking with secure re-open policy'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenLogicGuide && (
              <button
                type="button"
                onClick={() => onOpenLogicGuide('receiving')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-xs font-bold text-purple-300 border border-purple-700/60 shadow-sm transition-all"
                title={isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية للاستلام' : 'Inbound Receiving Logic & Equations'}
              >
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>{isRtl ? 'المنطق والمعادلات 💡' : 'Logic Guide'}</span>
              </button>
            )}

            <button
              onClick={() => exportAllReceivingReportsToExcel(savedReports)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-xs font-bold text-white border border-emerald-500/50 shadow-sm"
              title="تصدير كافة تقارير وأذون الاستلام المعتمدة إلى ملف إكسيل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>{isRtl ? 'تصدير كافة تقارير الاستلام (Excel)' : 'Export All Inbound Reports'}</span>
            </button>

            <button
              onClick={() => setActiveTab(activeTab === 'receiving' ? 'history' : 'receiving')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{activeTab === 'receiving' ? `السجلات المقفلة (${savedReports.length})` : 'العودة لجلسة الاستلام'}</span>
            </button>

            {activeTab === 'receiving' && (
              <>
                <button
                  onClick={handleSaveReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRtl ? 'اعتماد وقفل إذن الاستلام' : 'Approve & Lock Receipt'}</span>
                </button>

                <button
                  onClick={() => exportReceivingReportToExcel({
                    poNumber, supplierName, deliveryNoteNo, items,
                    totalExpectedQty: totalExpected, totalReceivedQty: totalReceived,
                    auditorName: settings.auditorName, auditorId: settings.auditorId, createdAt: new Date().toISOString()
                  })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700"
                  title="تصدير تقرير الاستلام الحالي إلى إكسيل"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير الجلسة الحالية</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {importNotice && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-600/60 rounded-xl text-xs text-emerald-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{importNotice}</span>
          </div>
          <button onClick={() => setImportNotice(null)} className="text-emerald-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HISTORY TAB WITH LOCKED DOCUMENTS, LINKS, AND RE-OPEN LOGIC               */}
      {/* ========================================================================= */}
      {activeTab === 'history' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>سجل أذون الاستلام المعتمدة والمقفلة ({savedReports.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                المستندات المنتهية محفوظة بروابط للقراءة، ولا يمكن فتحها للتعديل إلا بعد تأكيد الموافقة.
              </p>
            </div>
            {savedReports.length > 0 && (
              <button
                onClick={() => exportAllReceivingReportsToExcel(savedReports)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير كافة أذون الاستلام (Excel)</span>
              </button>
            )}
          </div>

          {savedReports.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              لا توجد أذون استلام محفوظة بعد.
            </div>
          ) : (
            <div className="space-y-3">
              {savedReports.map(rep => (
                <div key={rep.id} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 text-sm">{rep.poNumber}</span>
                      <span className="text-xs text-slate-300">المورد: <strong>{rep.supplierName}</strong></span>
                      {rep.deliveryNoteNo && (
                        <span className="text-[11px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                          بوليصة: {rep.deliveryNoteNo}
                        </span>
                      )}
                      <span className="text-[10px] bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-bold">
                        <Lock className="w-3 h-3" />
                        <span>مكتمل ومقفل</span>
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                      <span>الأصناف: {rep.items?.length || 0}</span>
                      <span>المتوقع: {rep.totalExpectedQty}</span>
                      <span className="text-emerald-400 font-bold">المستلم: {rep.totalReceivedQty}</span>
                      {rep.totalDamagedQty > 0 && <span className="text-red-400">التالف: {rep.totalDamagedQty}</span>}
                      <span>المدقق: {rep.auditorName}</span>
                      <span>{new Date(rep.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Read-Only View Button */}
                    <button
                      onClick={() => setViewingReport(rep)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-900/40 transition-all"
                      title="عرض تفاصيل إذن الاستلام للقراءة فقط"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض المستند</span>
                    </button>

                    {/* Re-open Button with Strict Confirmation */}
                    <button
                      onClick={() => handleRequestReopen(rep)}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-amber-500/40 transition-all"
                      title="طلب إعادة فتح المستند المكتمل للتعديل"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>إعادة فتح</span>
                    </button>

                    <button
                      onClick={() => exportReceivingReportToExcel(rep)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs"
                      title="تصدير Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm(`حذف إذن الاستلام ${rep.poNumber}؟`)) {
                          await deleteReceivingReport(rep.id);
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
      ) : (
        <>
          {/* Header Info & File Import Controls (Excel as Default) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">رقم أمر الشراء (PO #)</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المورد</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="شركة التوريد أو المصنع"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">رقم بوليصة الشحن / الإذن</label>
                <input
                  type="text"
                  value={deliveryNoteNo}
                  onChange={(e) => setDeliveryNoteNo(e.target.value)}
                  placeholder="DN-12345"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons: Excel as Primary/Default + PDF as Alternative + Template Download */}
              <div className="flex items-end gap-2">
                {/* 1. Primary & Default Excel Import */}
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md hover:shadow-emerald-600/20 border border-emerald-500/50 relative group" title="استيراد أمر الشراء عبر ملف إكسيل (الخيار الافتراضي)">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>استيراد Excel</span>
                  <span className="text-[9px] bg-emerald-950 text-emerald-200 px-1.5 py-0.2 rounded font-normal">افتراضي</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                </label>

                {/* 2. PDF Import Option */}
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all" title="استيراد مستند PDF">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>PDF</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleImportPdf}
                    className="hidden"
                  />
                </label>

                {/* 3. Packaging Rules Modal Button */}
                <button
                  onClick={() => setIsRulesModalOpen(true)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-800/60 rounded-lg text-xs font-bold flex items-center gap-1"
                  title="إدارة شروط ضم وتجميع العبوات"
                >
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span className="hidden md:inline">ضم العبوات</span>
                </button>

                {/* 4. Download Excel Template */}
                <button
                  onClick={downloadReceivingExcelTemplate}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs"
                  title="تنزيل قالب إكسيل استلام جاهز (Excel Template)"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>

          {/* KPIs & Packaging Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold">أصناف أمر الشراء</div>
              <div className="text-lg font-black text-white mt-1">{items.length} <span className="text-xs font-normal text-slate-400">صنف</span></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-blue-400 font-semibold">المطلوب دفترياً</div>
              <div className="text-lg font-black text-blue-300 mt-1">{totalExpected} <span className="text-xs font-normal text-slate-400">قطعة</span></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-emerald-400 font-semibold">إجمالي المستلم الفعلي</div>
              <div className="text-lg font-black text-emerald-300 mt-1">{totalReceived} <span className="text-xs font-normal text-slate-400">قطعة</span></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-amber-400 font-semibold">إجمالي الكراتين</div>
              <div className="text-lg font-black text-amber-300 mt-1">{totalCartons} <span className="text-xs font-normal text-slate-400">كرتونة</span></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-indigo-400 font-semibold">إجمالي الباكتات</div>
              <div className="text-lg font-black text-indigo-300 mt-1">{totalPacks} <span className="text-xs font-normal text-slate-400">باكت</span></div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-red-400 font-semibold">التالف للشحن</div>
              <div className="text-lg font-black text-red-300 mt-1">{totalDamaged} <span className="text-xs font-normal text-slate-400">قطعة</span></div>
            </div>
          </div>

          {/* Empty State with clear choice cards */}
          {items.length === 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-lg">
              <div className="text-center max-w-xl mx-auto space-y-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">بدء جلسة استلام بضائع واردة (Inbound Receiving)</h3>
                <p className="text-xs text-slate-400">
                  يمكنك استيراد أمر الشراء عبر الإكسيل كخيار افتراضي وسريع، أو رفع مستند PDF، أو مسح الباركود مباشرة
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {/* 1. Excel Import Card (Default/Recommended) */}
                <div className="p-4 bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                  <div className="absolute top-2 left-2 rtl:left-auto rtl:right-2">
                    <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      الخيار الافتراضي
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <FileSpreadsheet className="w-5 h-5" />
                      <span>استيراد ملف Excel / CSV</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      استيراد فوري للأصناف، الأكواد، الكميات المطلوبة، أرقام التشغيلات وتواريخ الصلاحية.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md">
                      <Upload className="w-4 h-4" />
                      <span>اختيار ملف إكسيل</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportExcel}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={downloadReceivingExcelTemplate}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تنزيل قالب إكسيل جاهز</span>
                    </button>
                  </div>
                </div>

                {/* 2. PDF Import Card */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                      <FileText className="w-5 h-5" />
                      <span>استيراد مستند PDF (PO)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      قراءة واستخراج أوامر الشراء وبوالص التوريد المطبوعة أو الإلكترونية بصيغة PDF.
                    </p>
                  </div>

                  <div className="pt-2">
                    <label className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all">
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span>اختيار ملف PDF</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleImportPdf}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 3. Direct Scanner Scan */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                      <ScanLine className="w-5 h-5" />
                      <span>المسح المباشر بالباركود</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      وجّه قارئ الباركود على كراتين البضاعة لتسجيل الكمية مباشرة في العمود المثبت باللمس.
                    </p>
                  </div>

                  <div className="pt-2">
                    <div className="text-[11px] text-slate-500 bg-slate-900 border border-slate-800 rounded-lg p-2 text-center font-mono">
                      القارئ جاهز للتسجيل في: {activeTargetColumn === 'cartons' ? 'الكراتين' : activeTargetColumn === 'packs' ? 'الباكتات' : 'الحبات'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barcode Quick Scan & Column Header Lock Selector */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span>تثبيت عمود التسجيل باللمس:</span>
                </span>

                <div className="inline-flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTargetColumn('cartons');
                      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                      activeTargetColumn === 'cartons'
                        ? 'bg-amber-500 text-black shadow font-black'
                        : 'text-amber-300/70 hover:text-amber-300 hover:bg-slate-800'
                    }`}
                  >
                    {activeTargetColumn === 'cartons' && <Pin className="w-3 h-3" />}
                    <span>الكراتين (Cartons)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTargetColumn('packs');
                      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                      activeTargetColumn === 'packs'
                        ? 'bg-indigo-600 text-white shadow font-black'
                        : 'text-indigo-300/70 hover:text-indigo-300 hover:bg-slate-800'
                    }`}
                  >
                    {activeTargetColumn === 'packs' && <Pin className="w-3 h-3" />}
                    <span>الباكتات (Packs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTargetColumn('pieces');
                      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                      activeTargetColumn === 'pieces'
                        ? 'bg-emerald-600 text-white shadow font-black'
                        : 'text-emerald-300/70 hover:text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    {activeTargetColumn === 'pieces' && <Pin className="w-3 h-3" />}
                    <span>حبات فردية (Pieces)</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                المس رأس أي عمود في الجدول أدناه لتثبيته للمسح المباشر ⚡
              </div>
            </div>

            {/* Quick scan input form */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5 rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  placeholder={`امسح باركود البضاعة للتسجيل الفوري في عمود [${
                    activeTargetColumn === 'cartons' ? 'الكراتين' : activeTargetColumn === 'packs' ? 'الباكتات' : 'الحبات'
                  }]...`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleAddManual}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف</span>
              </button>
            </div>
          </div>

          {/* Table of Receiving Items with Touch Column Header Locking & Manual Controls */}
          {items.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث بكود أو اسم الصنف..."
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-xs text-slate-400">عرض {filteredItems.length} صنف</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-300 text-right">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">الباركود والصنف</th>
                      <th className="p-2.5 text-center">المطلوب دفترياً</th>
                      
                      {/* TOUCH CLICKABLE HEADER: Cartons */}
                      <th 
                        onClick={() => {
                          setActiveTargetColumn('cartons');
                          if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                        }}
                        className={`p-2.5 text-center cursor-pointer transition-all ${
                          activeTargetColumn === 'cartons'
                            ? 'bg-amber-500/30 text-amber-300 border-b-2 border-amber-400 font-black'
                            : 'text-amber-300/80 hover:bg-slate-850 hover:text-amber-300'
                        }`}
                        title="المس لتثبيت تسجيل المسح في عمود الكراتين"
                      >
                        <div className="flex items-center justify-center gap-1">
                          {activeTargetColumn === 'cartons' && <Pin className="w-3 h-3 text-amber-400 animate-bounce" />}
                          <span>الكراتين</span>
                        </div>
                      </th>

                      {/* TOUCH CLICKABLE HEADER: Packs */}
                      <th 
                        onClick={() => {
                          setActiveTargetColumn('packs');
                          if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                        }}
                        className={`p-2.5 text-center cursor-pointer transition-all ${
                          activeTargetColumn === 'packs'
                            ? 'bg-indigo-500/30 text-indigo-200 border-b-2 border-indigo-400 font-black'
                            : 'text-indigo-300/80 hover:bg-slate-850 hover:text-indigo-300'
                        }`}
                        title="المس لتثبيت تسجيل المسح في عمود الباكتات"
                      >
                        <div className="flex items-center justify-center gap-1">
                          {activeTargetColumn === 'packs' && <Pin className="w-3 h-3 text-indigo-400 animate-bounce" />}
                          <span>الباكتات</span>
                        </div>
                      </th>

                      {/* TOUCH CLICKABLE HEADER: Loose Pieces */}
                      <th 
                        onClick={() => {
                          setActiveTargetColumn('pieces');
                          if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                        }}
                        className={`p-2.5 text-center cursor-pointer transition-all ${
                          activeTargetColumn === 'pieces'
                            ? 'bg-emerald-500/30 text-emerald-200 border-b-2 border-emerald-400 font-black'
                            : 'text-emerald-300/80 hover:bg-slate-850 hover:text-emerald-300'
                        }`}
                        title="المس لتثبيت تسجيل المسح في عمود الحبات"
                      >
                        <div className="flex items-center justify-center gap-1">
                          {activeTargetColumn === 'pieces' && <Pin className="w-3 h-3 text-emerald-400 animate-bounce" />}
                          <span>حبات فردية</span>
                        </div>
                      </th>

                      <th className="p-2.5 text-center font-bold text-white bg-slate-900">إجمالي المستلم</th>
                      <th className="p-2.5 text-center">التالف</th>
                      <th className="p-2.5 text-center">رقم التشغيلة (Batch)</th>
                      <th className="p-2.5 text-center">تاريخ الصلاحية</th>
                      <th className="p-2.5 text-center">الحالة</th>
                      <th className="p-2.5 text-center w-10">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5">
                          <div className="font-bold text-white font-mono">{item.itemCode}</div>
                          <div className="text-[11px] text-slate-400">{item.itemName}</div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            معامل الكرتونة: ×{item.cartonFactor || 24} | باكت: ×{item.packFactor || 6}
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-300">
                          {item.expectedQty} {item.unit}
                        </td>

                        {/* Cartons Input with +/- */}
                        <td className="p-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { cartonsCount: Math.max(0, (item.cartonsCount || 0) - 1) })}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.cartonsCount || 0}
                              onChange={(e) => handleUpdateItem(item.id, { cartonsCount: Number(e.target.value) || 0 })}
                              className="w-10 bg-transparent text-center font-mono font-bold text-amber-300 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { cartonsCount: (item.cartonsCount || 0) + 1 })}
                              className="p-1 hover:bg-slate-800 rounded text-amber-400 hover:text-amber-300 text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Packs Input with +/- */}
                        <td className="p-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { packsCount: Math.max(0, (item.packsCount || 0) - 1) })}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.packsCount || 0}
                              onChange={(e) => handleUpdateItem(item.id, { packsCount: Number(e.target.value) || 0 })}
                              className="w-10 bg-transparent text-center font-mono font-bold text-indigo-300 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { packsCount: (item.packsCount || 0) + 1 })}
                              className="p-1 hover:bg-slate-800 rounded text-indigo-400 hover:text-indigo-300 text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Pieces Input with +/- */}
                        <td className="p-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { piecesCount: Math.max(0, (item.piecesCount || 0) - 1) })}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.piecesCount || 0}
                              onChange={(e) => handleUpdateItem(item.id, { piecesCount: Number(e.target.value) || 0 })}
                              className="w-10 bg-transparent text-center font-mono font-bold text-emerald-300 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(item.id, { piecesCount: (item.piecesCount || 0) + 1 })}
                              className="p-1 hover:bg-slate-800 rounded text-emerald-400 hover:text-emerald-300 text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Total Calculated Received Qty */}
                        <td className="p-2.5 text-center font-mono font-bold text-sm bg-slate-950/80 text-emerald-400">
                          {item.receivedQty}
                        </td>

                        {/* Damaged Qty */}
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.damagedQty}
                            onChange={(e) => handleUpdateItem(item.id, { damagedQty: Number(e.target.value) || 0 })}
                            className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-1 text-center font-mono text-red-300 focus:outline-none focus:border-red-500"
                          />
                        </td>

                        {/* Batch Number */}
                        <td className="p-2.5 text-center">
                          <input
                            type="text"
                            value={item.batchNumber || ''}
                            onChange={(e) => handleUpdateItem(item.id, { batchNumber: e.target.value })}
                            placeholder="LOT-#"
                            className="w-20 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center font-mono text-slate-300"
                          />
                        </td>

                        {/* Expiry Date */}
                        <td className="p-2.5 text-center">
                          <input
                            type="date"
                            value={item.expiryDate || ''}
                            onChange={(e) => handleUpdateItem(item.id, { expiryDate: e.target.value })}
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center font-mono text-slate-300 text-[11px]"
                          />
                        </td>

                        {/* Status Badge */}
                        <td className="p-2.5 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.status === 'EXACT'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : item.status === 'SHORTAGE'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}>
                            {item.status === 'EXACT' ? 'مكتمل' : item.status === 'SHORTAGE' ? 'ناقص' : 'زيادة'}
                          </span>
                        </td>

                        {/* Delete Button */}
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                            className="p-1 text-slate-500 hover:text-red-400"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* READ-ONLY REPORT VIEW MODAL                                               */}
      {/* ========================================================================= */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">
                  عرض مستند إذن الاستلام المكتمل (للقراءة فقط)
                </h3>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400">رقم أمر الشراء</div>
                <div className="text-xs font-mono font-bold text-emerald-300">{viewingReport.poNumber}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">المورد</div>
                <div className="text-xs font-bold text-white">{viewingReport.supplierName}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">الكمية المستلمة / المتوقعة</div>
                <div className="text-xs font-mono font-bold text-blue-300">
                  {viewingReport.totalReceivedQty} / {viewingReport.totalExpectedQty}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">تاريخ الاعتماد</div>
                <div className="text-[11px] text-slate-300">{new Date(viewingReport.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2">الصنف</th>
                    <th className="p-2 text-center">المتوقع</th>
                    <th className="p-2 text-center">الكراتين</th>
                    <th className="p-2 text-center">الباكتات</th>
                    <th className="p-2 text-center">الحبات</th>
                    <th className="p-2 text-center">المستلم الفعلي</th>
                    <th className="p-2 text-center">التالف</th>
                    <th className="p-2 text-center">التشغيلة والصلاحية</th>
                    <th className="p-2 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {viewingReport.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-2">
                        <div className="font-mono font-bold text-white">{item.itemCode}</div>
                        <div className="text-[11px] text-slate-400">{item.itemName}</div>
                      </td>
                      <td className="p-2 text-center font-mono">{item.expectedQty}</td>
                      <td className="p-2 text-center font-mono text-amber-300">{item.cartonsCount || 0}</td>
                      <td className="p-2 text-center font-mono text-indigo-300">{item.packsCount || 0}</td>
                      <td className="p-2 text-center font-mono text-emerald-300">{item.piecesCount || 0}</td>
                      <td className="p-2 text-center font-mono font-bold text-emerald-400">{item.receivedQty}</td>
                      <td className="p-2 text-center font-mono text-red-300">{item.damagedQty}</td>
                      <td className="p-2 text-center text-[10px] text-slate-400">
                        {item.batchNumber ? `LOT: ${item.batchNumber}` : '-'} | {item.expiryDate || '-'}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                          item.status === 'EXACT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => handleRequestReopen(viewingReport)}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-500/40"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>طلب إعادة فتح للتعديل</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportReceivingReportToExcel(viewingReport)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير إكسيل</span>
                </button>

                <button
                  onClick={() => setViewingReport(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RE-OPEN CONFIRMATION SECURITY MODAL (نعم / لا / إلغاء)                      */}
      {/* ========================================================================= */}
      {reopenPrompt && (
        <ReopenConfirmationModal
          isOpen={reopenPrompt.isOpen}
          onClose={() => setReopenPrompt(null)}
          onDeny={() => setReopenPrompt(null)}
          onConfirm={reopenPrompt.onConfirm}
          documentTitle={reopenPrompt.title}
          documentTypeLabel="إذن استلام وارد مقفل"
          isRtl={isRtl}
        />
      )}

      {/* Packaging Rules Modal */}
      <PackagingRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        rules={packagingRules}
        onRulesUpdated={(updated) => setPackagingRules(updated)}
        isRtl={isRtl}
      />
    </div>
  );
};
