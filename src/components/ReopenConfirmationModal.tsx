import React from 'react';
import { AlertTriangle, Lock, Unlock, X, Check, ArrowRight } from 'lucide-react';

interface ReopenConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void; // "إلغاء" or close
  onConfirm: () => void; // "نعم"
  onDeny: () => void; // "لا"
  documentTitle: string; // e.g. "تقرير مرتجع رقم RET-2026-102"
  documentTypeLabel?: string; // "مرتجع مستودع" أو "طلب استرداد مالي"
  isRtl?: boolean;
}

export const ReopenConfirmationModal: React.FC<ReopenConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDeny,
  documentTitle,
  documentTypeLabel = 'مستند مكتمل',
  isRtl = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 text-right rtl:text-right ltr:text-left"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header with Security Badge */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60 mb-1">
                <Lock className="w-3 h-3" />
                <span>حماية المستندات المكتملة</span>
              </div>
              <h3 className="text-base font-black text-white">
                تأكيد إعادة فتح مستند مكتمل
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="إلغاء"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt Content */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="text-xs text-slate-400">
            {documentTypeLabel}: <span className="font-mono font-bold text-amber-400 text-sm">{documentTitle}</span>
          </div>
          
          <div className="text-sm font-bold text-amber-200 leading-relaxed">
            « أنت تحاول فتح مستند تم إنهاؤه واعتماده مسبقاً، هل تريد الاستمرار وإعادة فتحه للتعديل؟ »
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            إعادة الفتح ستتيح تعديل الكميات والبيانات المدخلة وتتطلب إعادة إغلاق واعتماد المستند مجدداً.
          </p>
        </div>

        {/* Action Buttons: نعم - لا - إلغاء */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all text-center"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={onDeny}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-all text-center flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5 text-red-400" />
            <span>لا (إبقاء المستند مقفلاً)</span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg transition-all text-center flex items-center justify-center gap-1.5"
          >
            <Unlock className="w-4 h-4 text-black" />
            <span>نعم (موافقة وإعادة الفتح للتعديل)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
