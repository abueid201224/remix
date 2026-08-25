import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Trash2, 
  Search, 
  CheckCircle2,
  Hash,
  UserCheck,
  FileSignature,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type { AuditDiscrepancy, AppSettings } from '../types';
import { exportErrorReportToExcel, exportErrorReportToPdf } from '../services/excelService';
import { clearAllAuditDiscrepancies, deleteAuditDiscrepancy } from '../services/db';

interface ErrorReportScreenProps {
  discrepancies: AuditDiscrepancy[];
  onRefreshDiscrepancies: () => void;
  settings: AppSettings;
  onOpenAuditorModal?: () => void;
}

export const ErrorReportScreen: React.FC<ErrorReportScreenProps> = ({
  discrepancies,
  onRefreshDiscrepancies,
  settings,
  onOpenAuditorModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'MISMATCH' | 'SHORTAGE' | 'SURPLUS'>('ALL');

  const isRtl = settings.language === 'ar';

  // Unique Invoices in Error log
  const uniqueInvoices = useMemo(() => {
    const set = new Set<string>();
    discrepancies.forEach(d => set.add(d.invoiceNo));
    return Array.from(set).sort();
  }, [discrepancies]);

  // Counts
  const totalErrors = discrepancies.length;
  const mismatchCount = discrepancies.filter(d => d.codeStatus === 'MISMATCH').length;
  const shortageCount = discrepancies.filter(d => d.qtyStatus === 'SHORTAGE').length;
  const surplusCount = discrepancies.filter(d => d.qtyStatus === 'SURPLUS').length;

  const hasAnyOrderNo = useMemo(() => {
    return discrepancies.some(d => Boolean(d.orderNo));
  }, [discrepancies]);

  // Filtered list
  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter((d) => {
      // Invoice filter
      if (selectedInvoice !== 'ALL' && d.invoiceNo !== selectedInvoice) return false;
      
      // Type filter
      if (selectedType === 'MISMATCH' && d.codeStatus !== 'MISMATCH') return false;
      if (selectedType === 'SHORTAGE' && (d.qtyStatus !== 'SHORTAGE' || d.codeStatus === 'MISMATCH')) return false;
      if (selectedType === 'SURPLUS' && (d.qtyStatus !== 'SURPLUS' || d.codeStatus === 'MISMATCH')) return false;

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          d.invoiceNo.toLowerCase().includes(query) ||
          (d.orderNo && d.orderNo.toLowerCase().includes(query)) ||
          d.itemCode.toLowerCase().includes(query) ||
          d.itemName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [discrepancies, selectedInvoice, selectedType, searchTerm]);

  const handleClearAll = async () => {
    if (window.confirm(isRtl ? 'هل أنت متأكد من مسح جميع سجلات تقرير الأخطاء والفروقات نهائياً؟' : 'Are you sure you want to permanently clear the Error Audit Report logs?')) {
      await clearAllAuditDiscrepancies();
      onRefreshDiscrepancies();
    }
  };

  const handleDeleteItem = async (id?: number) => {
    if (!id) return;
    await deleteAuditDiscrepancy(id);
    onRefreshDiscrepancies();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExcelExport = () => {
    exportErrorReportToExcel(discrepancies, {
      name: settings.auditorName || 'أحمد حمادة',
      id: settings.auditorId || 'AUD-101',
      title: settings.auditorTitle || 'مراجع ومراقب مخزون معتمد',
    });
  };

  const handlePdfExport = () => {
    exportErrorReportToPdf(discrepancies, {
      name: settings.auditorName || 'أحمد حمادة',
      id: settings.auditorId || 'AUD-101',
      title: settings.auditorTitle || 'مراجع ومراقب مخزون معتمد',
      signature: settings.auditorSignature,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Export Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-600/20 text-amber-400 rounded-lg border border-amber-500/30">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span>{isRtl ? 'تقرير الأخطاء والفروقات الدائم (Audit Discrepancies)' : 'Permanent Error & Discrepancy Audit Report'}</span>
                  <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700 font-mono font-bold">
                    ISA 500
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {isRtl 
                    ? 'سجل التوثيق الرقابي للأصناف غير المدرجة والعجز والزيادات مع التوقيع الرقمي للمراجع' 
                    : 'Archived discrepancies, item mismatches, shortages & surpluses with verified auditor sign-off'}
                </p>
              </div>
            </div>
          </div>

          {/* Export Action Buttons & Auditor Badge */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Auditor Quick Badge */}
            {onOpenAuditorModal && (
              <button
                onClick={onOpenAuditorModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-emerald-700/60 rounded-lg text-xs font-bold text-emerald-300 transition-colors shadow-sm"
                title={isRtl ? 'تعديل أو اعتماد توقيع المراجع' : 'Edit auditor credentials and signature'}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{settings.auditorName || 'أحمد حمادة'} ({settings.auditorId || 'AUD-101'})</span>
                <FileSignature className="w-3 h-3 text-emerald-400 ml-1" />
              </button>
            )}

            <button
              id="export-error-excel-btn"
              onClick={handleExcelExport}
              disabled={discrepancies.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors shadow"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              id="export-error-pdf-btn"
              onClick={handlePdfExport}
              disabled={discrepancies.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors shadow"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF (Signed)</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={discrepancies.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {discrepancies.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-red-950 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold border border-slate-700 hover:border-red-800 transition-colors ml-auto"
                title="Clear all archived discrepancies"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg">
            <span className="text-slate-400 block text-[11px]">{isRtl ? 'إجمالي الفروقات' : 'Total Discrepancies'}</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">{totalErrors}</span>
          </div>
          <div className="bg-red-950/40 border border-red-800/50 p-3 rounded-lg">
            <span className="text-red-400 block text-[11px]">{isRtl ? 'أصناف غير مدرجة' : 'Item Mismatches'}</span>
            <span className="text-xl font-bold font-mono text-red-300 mt-0.5 block">{mismatchCount}</span>
          </div>
          <div className="bg-amber-950/40 border border-amber-800/50 p-3 rounded-lg">
            <span className="text-amber-400 block text-[11px]">{isRtl ? 'عجز بالنواقص' : 'Quantity Shortages'}</span>
            <span className="text-xl font-bold font-mono text-amber-300 mt-0.5 block">{shortageCount}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-800/50 p-3 rounded-lg">
            <span className="text-purple-400 block text-[11px]">{isRtl ? 'زيادة بالكميات' : 'Quantity Surpluses'}</span>
            <span className="text-xl font-bold font-mono text-purple-300 mt-0.5 block">{surplusCount}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRtl ? 'بحث برقم الأوردر، الفاتورة، كود الصنف، أو الاسم...' : 'Search by Order #, Invoice #, Item Code, or Name...'}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          <select
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-mono"
          >
            <option value="ALL">{isRtl ? `كل الفواتير (${uniqueInvoices.length})` : `All Invoices (${uniqueInvoices.length})`}</option>
            {uniqueInvoices.map((inv) => (
              <option key={inv} value={inv}>{inv}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as unknown as 'ALL')}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-semibold"
          >
            <option value="ALL">{isRtl ? 'جميع أنواع الأخطاء' : 'All Error Types'}</option>
            <option value="MISMATCH">{isRtl ? 'أصناف غير مدرجة فقط' : 'Mismatches Only'}</option>
            <option value="SHORTAGE">{isRtl ? 'نواقص فقط' : 'Shortages Only'}</option>
            <option value="SURPLUS">{isRtl ? 'زيادات فقط' : 'Surpluses Only'}</option>
          </select>
        </div>
      </div>

      {/* Discrepancy Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
          <span>{isRtl ? `عرض ${filteredDiscrepancies.length} من أصل ${discrepancies.length} سجل انحراف` : `Showing ${filteredDiscrepancies.length} of ${discrepancies.length} Discrepancy Records`}</span>
          <span className="font-mono text-[11px] text-emerald-400">{isRtl ? 'محفوظ 100% في قاعدة البيانات المحلية' : '100% Persisted in Offline IndexedDB'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase tracking-wider">
              <tr>
                {hasAnyOrderNo && <th className="p-3 pl-4">Order No</th>}
                <th className={`p-3 ${!hasAnyOrderNo ? 'pl-4' : ''}`}>Invoice No</th>
                <th className="p-3">Item Code & Name</th>
                <th className="p-3 text-center">Unit</th>
                <th className="p-3 text-center">Req</th>
                <th className="p-3 text-center">Scanned</th>
                <th className="p-3 text-center">Variance</th>
                <th className="p-3 text-center">Discrepancy Type</th>
                <th className="p-3 text-center">Auditor ID</th>
                <th className="p-3 text-center">Audited Time</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200 font-mono">
              {filteredDiscrepancies.length === 0 ? (
                <tr>
                  <td colSpan={hasAnyOrderNo ? 11 : 10} className="p-8 text-center text-slate-500 font-sans">
                    {discrepancies.length === 0 ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                        <p className="font-semibold text-slate-300">{isRtl ? 'لا توجد أي فروقات مسجلة حالياً' : 'No Discrepancies Recorded'}</p>
                        <p className="text-xs text-slate-500">
                          {isRtl ? 'عند قفل أي فاتورة تحتوي على عجز أو زيادة أو أصناف غير مدرجة، يتم حفظها هنا تلقائياً.' : 'When an audited invoice contains shortages, surpluses, or mismatches, they are automatically saved here.'}
                        </p>
                      </div>
                    ) : (
                      isRtl ? 'لا توجد سجلات تطابق شروط البحث والفلترة الحالية.' : 'No errors match the current filter criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredDiscrepancies.map((d, index) => {
                  const isMismatch = d.codeStatus === 'MISMATCH';
                  const isShortage = d.qtyStatus === 'SHORTAGE';
                  const isSurplus = d.qtyStatus === 'SURPLUS';

                  return (
                    <tr 
                      key={d.id || index}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Order No */}
                      {hasAnyOrderNo && (
                        <td className="p-3 pl-4">
                          <span className="text-xs font-mono font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-700/40">
                            {d.orderNo || '-'}
                          </span>
                        </td>
                      )}

                      {/* Invoice No */}
                      <td className={`p-3 ${!hasAnyOrderNo ? 'pl-4' : ''} font-bold text-amber-400`}>
                        {d.invoiceNo}
                      </td>

                      {/* Item Code & Name */}
                      <td className="p-3">
                        <div className="font-bold text-white">{d.itemCode}</div>
                        <div className="text-xs text-slate-400 font-sans truncate max-w-xs">{d.itemName}</div>
                      </td>

                      {/* Unit */}
                      <td className="p-3 text-center text-slate-400">
                        {d.unit}
                      </td>

                      {/* Req Qty */}
                      <td className="p-3 text-center font-semibold text-slate-300">
                        {d.requiredQty}
                      </td>

                      {/* Actual Scanned Qty */}
                      <td className="p-3 text-center font-bold text-white">
                        {d.actualQty}
                      </td>

                      {/* Variance Diff */}
                      <td className="p-3 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          d.difference < 0 ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {d.difference > 0 ? `+${d.difference}` : d.difference}
                        </span>
                      </td>

                      {/* Discrepancy Classification */}
                      <td className="p-3 text-center">
                        {isMismatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-950 text-red-400 border border-red-700">
                            MISMATCH
                          </span>
                        ) : isShortage ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                            SHORTAGE
                          </span>
                        ) : isSurplus ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-950 text-purple-400 border border-purple-800">
                            SURPLUS
                          </span>
                        ) : null}
                      </td>

                      {/* Auditor ID */}
                      <td className="p-3 text-center">
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          {d.auditorId || settings.auditorId || 'AUD-101'}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="p-3 text-center text-slate-400 text-xs font-mono">
                        {new Date(d.auditedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      {/* Delete item action */}
                      <td className="p-3 pr-4 text-right">
                        <button
                          onClick={() => handleDeleteItem(d.id)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Auditor Certification & Sign-off Card (Printable & Verification) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isRtl ? 'اعتماد وتوثيق المراجع المسؤول (ISA 500 Compliance):' : 'Official Auditor Certification (ISA 500 Compliance):'}
                </h3>
                <span className="text-[11px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-700">
                  {settings.auditorId || 'AUD-101'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl ? 'المراجع المعين:' : 'Lead Auditor:'} <strong className="text-emerald-300">{settings.auditorName || 'أحمد حمادة'}</strong> &bull; {settings.auditorTitle || (isRtl ? 'مراجع ومراقب مخزون معتمد' : 'Senior Inventory Auditor')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
            {settings.auditorSignature && settings.auditorSignature.startsWith('data:image/') ? (
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">{isRtl ? 'الختم والتوقيع الرقمي:' : 'Digital Stamp:'}</span>
                <img 
                  src={settings.auditorSignature} 
                  alt="Auditor Signature" 
                  className="h-9 max-w-[130px] object-contain rounded"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                {isRtl ? 'ختم المراجعة المعتمد نشط' : 'Certified Digital Stamp Active'}
              </div>
            )}

            {onOpenAuditorModal && (
              <button
                type="button"
                onClick={onOpenAuditorModal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
              >
                {isRtl ? 'تعديل التوقيع' : 'Edit Signature'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

