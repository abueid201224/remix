import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Archive, 
  ArrowRight, 
  X, 
  FileCheck2, 
  Package, 
  Layers, 
  Sparkles, 
  Clock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import type { AuditDiscrepancy } from '../types';

interface InvoiceSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo: string;
  orderNo?: string;
  discardedCount: number;
  archivedDiscrepancies: AuditDiscrepancy[];
  totalRequiredQty?: number;
  totalScannedQty?: number;
  totalLineItems?: number;
  auditorName?: string;
  auditorId?: string;
  auditorSignature?: string;
  onViewErrorReport: () => void;
  onContinueScanning: () => void;
  language?: 'ar' | 'en';
}

export const InvoiceSummaryModal: React.FC<InvoiceSummaryModalProps> = ({
  isOpen,
  onClose,
  invoiceNo,
  orderNo,
  discardedCount,
  archivedDiscrepancies,
  totalRequiredQty = 0,
  totalScannedQty = 0,
  totalLineItems = 0,
  auditorName,
  auditorId,
  auditorSignature,
  onViewErrorReport,
  onContinueScanning,
  language = 'ar',
}) => {
  if (!isOpen) return null;

  const isRtl = language === 'ar';
  const isAllClean = archivedDiscrepancies.length === 0;

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl text-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isAllClean 
            ? 'bg-gradient-to-r from-emerald-950/90 to-slate-900 border-emerald-700/60' 
            : 'bg-gradient-to-r from-amber-950/90 to-slate-900 border-amber-700/60'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shadow-inner ${
              isAllClean ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              {isAllClean ? <FileCheck2 className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {isRtl ? 'تم إنهاء وتدقيق الفاتورة' : 'Invoice Audited & Closed'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  isAllClean ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isAllClean ? (isRtl ? 'مكتملة 100%' : '100% Complete') : (isRtl ? 'يوجد ملاحظات' : 'Has Discrepancies')}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                {isRtl ? 'رقم الفاتورة:' : 'Invoice No:'} <strong className="text-white">{invoiceNo}</strong> {orderNo ? `(${isRtl ? 'أوردر:' : 'Order:'} ${orderNo})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prominent High-Contrast Metrics (Total Quantity & Items Count) */}
        <div className="p-6 space-y-4">
          {/* Main KPI Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-inner">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{isRtl ? 'إجماليات الفاتورة المدققة:' : 'Invoice Audit Summary Totals:'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total Qty Required */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-center">
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">{isRtl ? 'إجمالي الكمية المطلوبة' : 'Total Required Qty'}</span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {totalRequiredQty > 0 ? totalRequiredQty : totalScannedQty} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'قطعة' : 'units'}</span>
                </div>
              </div>

              {/* Total Scanned Qty */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-center">
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">{isRtl ? 'الكمية الممسوحة فعلياً' : 'Total Scanned Qty'}</span>
                <div className={`text-2xl font-black font-mono ${
                  totalScannedQty === totalRequiredQty 
                    ? 'text-emerald-300' 
                    : totalScannedQty < totalRequiredQty 
                      ? 'text-amber-400' 
                      : 'text-purple-400'
                }`}>
                  {totalScannedQty} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'قطعة' : 'units'}</span>
                </div>
              </div>

              {/* Total Line Items */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">{isRtl ? 'عدد الأصناف (السطور)' : 'Line Items Count'}</span>
                <div className="text-2xl font-black font-mono text-cyan-400">
                  {totalLineItems > 0 ? totalLineItems : discardedCount + archivedDiscrepancies.length} <span className="text-xs text-slate-400 font-normal">{isRtl ? 'صنف' : 'items'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clean vs Discrepancy Breakdown Badges */}
          <div className="grid grid-cols-2 gap-3">
            {/* Clean Items Box */}
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                <Trash2 className="w-4 h-4" />
                <span>{isRtl ? 'أصناف مطابقة 100%' : 'EXACT MATCHES'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-300">
                {discardedCount} <span className="text-xs font-normal text-emerald-400/80">{isRtl ? 'صنف مطابق' : 'items'}</span>
              </div>
              <p className="text-[11px] text-emerald-400/70 mt-1">
                {isRtl ? 'تمت مطابقتها بالكامل بدون أي انحراف.' : 'Exact matches cleared from memory (no errors).'}
              </p>
            </div>

            {/* Discrepancy Box */}
            <div className={`rounded-xl p-3.5 border ${
              archivedDiscrepancies.length > 0 
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' 
                : 'bg-slate-800/40 border-slate-700 text-slate-400'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold mb-1 text-amber-400">
                <Archive className="w-4 h-4" />
                <span>{isRtl ? 'انحرافات ونواقص' : 'DISCREPANCIES'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-300">
                {archivedDiscrepancies.length} <span className="text-xs font-normal text-amber-400/80">{isRtl ? 'سجل' : 'records'}</span>
              </div>
              <p className="text-[11px] text-amber-400/70 mt-1">
                {isRtl ? 'تم حفظها في تقرير الأخطاء العام.' : 'Saved permanently into Error Audit Report.'}
              </p>
            </div>
          </div>

          {/* Auditor Sign-off Seal Badge */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  {isRtl ? 'المراجع المعتمد:' : 'Certified Auditor:'} <strong className="text-emerald-300">{auditorName || 'أحمد حمادة'}</strong> ({auditorId || 'AUD-101'})
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date().toLocaleString(isRtl ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>

            {auditorSignature && auditorSignature.startsWith('data:image/') && (
              <img 
                src={auditorSignature} 
                alt="Auditor Stamp" 
                className="h-8 max-w-[100px] object-contain rounded border border-slate-800 bg-slate-900 px-1"
              />
            )}
          </div>

          {/* Breakdown List if errors exist */}
          {archivedDiscrepancies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRtl ? 'تفاصيل الانحرافات المسجلة:' : 'Archived Error Details:'}</span>
              </h3>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {archivedDiscrepancies.map((disc, idx) => (
                  <div 
                    key={idx} 
                    className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{disc.itemCode} - {disc.itemName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{isRtl ? 'مطلوب:' : 'Req:'} <strong>{disc.requiredQty}</strong></span>
                        <span>&bull;</span>
                        <span>{isRtl ? 'فعلي:' : 'Act:'} <strong>{disc.actualQty}</strong></span>
                        <span>&bull;</span>
                        <span>{isRtl ? 'الفارق:' : 'Diff:'} <strong className={disc.difference < 0 ? 'text-amber-400' : 'text-red-400'}>{disc.difference > 0 ? `+${disc.difference}` : disc.difference}</strong></span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {disc.codeStatus === 'MISMATCH' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                          {isRtl ? 'غير مدرج' : 'MISMATCH'}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          disc.qtyStatus === 'SHORTAGE' 
                            ? 'bg-amber-950 text-amber-400 border border-amber-800' 
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}>
                          {disc.qtyStatus === 'SHORTAGE' ? (isRtl ? 'نقص' : 'SHORTAGE') : (isRtl ? 'زيادة' : 'SURPLUS')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {archivedDiscrepancies.length > 0 ? (
            <button
              onClick={() => {
                onClose();
                onViewErrorReport();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs text-amber-400 hover:text-amber-300 font-bold py-2 px-3 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Archive className="w-4 h-4" />
              <span>{isRtl ? 'فتح تقرير الأخطاء وتصدير PDF/Excel' : 'View Error Report & Export'}</span>
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isRtl ? 'الفاتورة مطابقة بالكامل ومقفلة' : 'Invoice 100% Matched & Locked'}</span>
            </span>
          )}

          <button
            onClick={() => {
              onClose();
              onContinueScanning();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md transition-all border border-emerald-500/50"
          >
            <span>{isRtl ? 'مسح الفاتورة التالية' : 'Scan Next Invoice'}</span>
            <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
