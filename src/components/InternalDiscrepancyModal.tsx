import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Trash2, 
  Search, 
  CheckCircle2, 
  X, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Filter,
  RefreshCw,
  Info
} from 'lucide-react';
import type { AuditDiscrepancy, WrongPickingRecord, AppSettings } from '../types';
import { exportErrorReportToExcel, exportErrorReportToPdf } from '../services/excelService';
import { clearAllAuditDiscrepancies, deleteAuditDiscrepancy, deleteWrongPicking, clearAllWrongPickings } from '../services/db';

interface InternalDiscrepancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  discrepancies: AuditDiscrepancy[];
  wrongPickings?: WrongPickingRecord[];
  onRefreshDiscrepancies: () => void;
  settings: AppSettings;
  activeInvoiceNo?: string | null;
  serviceContextName?: string;
}

export const InternalDiscrepancyModal: React.FC<InternalDiscrepancyModalProps> = ({
  isOpen,
  onClose,
  discrepancies,
  wrongPickings = [],
  onRefreshDiscrepancies,
  settings,
  activeInvoiceNo,
  serviceContextName
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<string>(activeInvoiceNo || 'ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'MISMATCH' | 'SHORTAGE' | 'SURPLUS' | 'WRONG_PICKING'>('ALL');
  const [viewScope, setViewScope] = useState<'ALL' | 'CURRENT'>(activeInvoiceNo ? 'CURRENT' : 'ALL');

  const isRtl = settings.language === 'ar';

  if (!isOpen) return null;

  // Unique Invoices in Error log
  const uniqueInvoices = Array.from(new Set(discrepancies.map(d => d.invoiceNo))).sort();

  // Counts
  const totalAuditErrors = discrepancies.length;
  const mismatchCount = discrepancies.filter(d => d.codeStatus === 'MISMATCH').length;
  const shortageCount = discrepancies.filter(d => d.qtyStatus === 'SHORTAGE').length;
  const surplusCount = discrepancies.filter(d => d.qtyStatus === 'SURPLUS').length;
  const wrongPickingCount = wrongPickings.length;
  const totalCombinedErrors = totalAuditErrors + wrongPickingCount;

  // Filtered list
  const filteredDiscrepancies = discrepancies.filter((d) => {
    // Current invoice scope
    if (viewScope === 'CURRENT' && activeInvoiceNo && d.invoiceNo.toLowerCase() !== activeInvoiceNo.toLowerCase()) {
      return false;
    }
    // Specific invoice dropdown
    if (selectedInvoice !== 'ALL' && d.invoiceNo !== selectedInvoice) {
      return false;
    }
    // Type filter
    if (selectedType === 'MISMATCH' && d.codeStatus !== 'MISMATCH') return false;
    if (selectedType === 'SHORTAGE' && (d.qtyStatus !== 'SHORTAGE' || d.codeStatus === 'MISMATCH')) return false;
    if (selectedType === 'SURPLUS' && (d.qtyStatus !== 'SURPLUS' || d.codeStatus === 'MISMATCH')) return false;
    if (selectedType === 'WRONG_PICKING') return false;

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

  const filteredWrongPickings = wrongPickings.filter((w) => {
    if (selectedType !== 'ALL' && selectedType !== 'WRONG_PICKING') return false;
    if (viewScope === 'CURRENT' && activeInvoiceNo && w.activeInvoiceNo.toLowerCase() !== activeInvoiceNo.toLowerCase()) {
      return false;
    }
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      return (
        w.activeInvoiceNo.toLowerCase().includes(query) ||
        w.itemCode.toLowerCase().includes(query) ||
        w.itemName.toLowerCase().includes(query) ||
        (w.actualBelongingInvoiceNo && w.actualBelongingInvoiceNo.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleClearAll = async () => {
    const confirmMsg = isRtl 
      ? 'هل أنت متأكد من مسح جميع سجلات تقرير الأخطاء والفروقات نهائياً من قاعدة البيانات؟'
      : 'Are you sure you want to permanently clear all discrepancy records?';
    if (window.confirm(confirmMsg)) {
      await clearAllAuditDiscrepancies();
      await clearAllWrongPickings();
      onRefreshDiscrepancies();
    }
  };

  const handleDeleteAuditItem = async (id?: number) => {
    if (!id) return;
    await deleteAuditDiscrepancy(id);
    onRefreshDiscrepancies();
  };

  const handleDeleteWrongItem = async (id?: number) => {
    if (!id) return;
    await deleteWrongPicking(id);
    onRefreshDiscrepancies();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950/30 p-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600/20 text-red-400 border border-red-500/40 rounded-xl shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isRtl ? 'خدمة تقرير النواقص والأخطاء والفروقات (داخلي)' : 'Internal Discrepancies & Errors Inspector'}
                </h2>
                {serviceContextName && (
                  <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                    {serviceContextName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'رصد فوري لنواقص الكميات، الزيادات، الأصناف الغريبة، وأخطاء التحضير مع التصدير' 
                  : 'Real-time auditing logs, quantity shortages/surpluses, foreign items & wrong pickings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Mini Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-950/70 border-b border-slate-800">
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block">{isRtl ? 'إجمالي السجلات' : 'Total Logs'}</span>
            <span className="text-base font-black text-white">{totalCombinedErrors}</span>
          </div>
          <div className="bg-red-950/40 border border-red-900/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-red-400 block">{isRtl ? 'عجز ونواقص' : 'Shortages'}</span>
            <span className="text-base font-black text-red-300">{shortageCount}</span>
          </div>
          <div className="bg-amber-950/40 border border-amber-900/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-amber-400 block">{isRtl ? 'زيادات' : 'Surpluses'}</span>
            <span className="text-base font-black text-amber-300">{surplusCount}</span>
          </div>
          <div className="bg-purple-950/40 border border-purple-900/50 p-2 rounded-xl text-center">
            <span className="text-[10px] text-purple-400 block">{isRtl ? 'أصناف غير مطابقة' : 'Mismatches'}</span>
            <span className="text-base font-black text-purple-300">{mismatchCount}</span>
          </div>
          <div className="bg-cyan-950/40 border border-cyan-900/50 p-2 rounded-xl text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-cyan-400 block">{isRtl ? 'أخطاء تحضير وانتقاء' : 'Wrong Pickings'}</span>
            <span className="text-base font-black text-cyan-300">{wrongPickingCount}</span>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {activeInvoiceNo && (
              <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs font-bold">
                <button
                  onClick={() => setViewScope('CURRENT')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    viewScope === 'CURRENT' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isRtl ? `الفاتورة الحالية (${activeInvoiceNo})` : `Current (${activeInvoiceNo})`}
                </button>
                <button
                  onClick={() => setViewScope('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    viewScope === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isRtl ? 'كافة الفواتير' : 'All Invoices'}
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 rtl:left-auto rtl:right-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'بحث بكود أو اسم أو فاتورة...' : 'Search logs...'}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 rtl:pl-2.5 rtl:pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 w-44 sm:w-56"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">كافة أنواع الفروقات</option>
              <option value="SHORTAGE">عجز ونواقص فقط</option>
              <option value="SURPLUS">زيادات فقط</option>
              <option value="MISMATCH">أصناف غريبة غير مطابقة</option>
              <option value="WRONG_PICKING">أخطاء تحضير وانتقاء</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm transition-all"
              title="تصدير إكسيل"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>إكسيل</span>
            </button>

            <button
              onClick={handlePdfExport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-bold shadow-sm transition-all"
              title="تصدير PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF معتمد</span>
            </button>

            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-semibold transition-all"
              title="مسح السجلات"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredDiscrepancies.length === 0 && filteredWrongPickings.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 my-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-white">لا توجد أخطاء أو فروقات مسجلة حالياً!</h3>
              <p className="text-xs text-slate-400 mt-1">كافة الفواتير التي تمت مراجعتها مطابقة بنسبة 100%.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Discrepancies Table */}
              {filteredDiscrepancies.length > 0 && (
                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                  <div className="p-2.5 bg-slate-950 font-bold text-xs text-slate-300 border-b border-slate-800 flex items-center justify-between">
                    <span>سجلات مراجعة الفواتير ({filteredDiscrepancies.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-slate-300 text-right">
                      <thead className="bg-slate-950/90 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-2">رقم الفاتورة / الطلب</th>
                          <th className="p-2">كود واسم الصنف</th>
                          <th className="p-2 text-center">المطلوب</th>
                          <th className="p-2 text-center">الممسوح</th>
                          <th className="p-2 text-center">الفارق</th>
                          <th className="p-2 text-center">نوع الفرق</th>
                          <th className="p-2 text-center">التوقيت</th>
                          <th className="p-2 text-center w-8">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {filteredDiscrepancies.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-2">
                              <div className="font-bold text-white font-mono">{item.invoiceNo}</div>
                              {item.orderNo && <div className="text-[10px] text-amber-400 font-mono">{item.orderNo}</div>}
                            </td>
                            <td className="p-2">
                              <div className="font-bold text-slate-200 font-mono">{item.itemCode}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.itemName}</div>
                            </td>
                            <td className="p-2 text-center font-mono">{item.requiredQty} {item.unit}</td>
                            <td className="p-2 text-center font-mono font-bold">{item.actualQty}</td>
                            <td className="p-2 text-center font-mono font-bold">
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </td>
                            <td className="p-2 text-center">
                              {item.codeStatus === 'MISMATCH' ? (
                                <span className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                  صنف غريب
                                </span>
                              ) : item.qtyStatus === 'SHORTAGE' ? (
                                <span className="bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                  عجز ({Math.abs(item.difference)})
                                </span>
                              ) : (
                                <span className="bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                  زيادة (+{item.difference})
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center text-[10px] text-slate-500 font-mono">
                              {new Date(item.auditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleDeleteAuditItem(item.id)}
                                className="text-slate-500 hover:text-red-400 p-1"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Wrong Pickings Table */}
              {filteredWrongPickings.length > 0 && (
                <div className="border border-cyan-900/50 rounded-xl overflow-hidden shadow-inner">
                  <div className="p-2.5 bg-cyan-950/60 font-bold text-xs text-cyan-300 border-b border-cyan-800/60 flex items-center justify-between">
                    <span>سجلات الأصناف المسحوبة بالخطأ من فواتير أخرى (Wrong Pickings) ({filteredWrongPickings.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-slate-300 text-right">
                      <thead className="bg-slate-950/90 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-2">الفاتورة النشطة</th>
                          <th className="p-2">الصنف المسحوب بالخطأ</th>
                          <th className="p-2">الفاتورة الأصلية المستحقة للصنف</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-center">المسؤول</th>
                          <th className="p-2 text-center w-8">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {filteredWrongPickings.map((wp) => (
                          <tr key={wp.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 font-mono font-bold text-white">{wp.activeInvoiceNo}</td>
                            <td className="p-2">
                              <div className="font-bold text-cyan-300 font-mono">{wp.itemCode}</div>
                              <div className="text-[11px] text-slate-400">{wp.itemName}</div>
                            </td>
                            <td className="p-2 font-mono text-amber-300 font-bold">
                              {wp.actualBelongingInvoiceNo || 'غير مسجل بقاعدة البيانات'}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-white">{wp.quantity}</td>
                            <td className="p-2 text-center text-[10px] text-slate-400">{wp.auditorName}</td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleDeleteWrongItem(wp.id)}
                                className="text-slate-500 hover:text-red-400 p-1"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>توثيق رسمي باسم المراجع: <strong className="text-white">{settings.auditorName || 'أحمد حمادة'}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
