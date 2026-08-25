import React from 'react';
import {
  Boxes,
  Printer,
  X,
  QrCode,
  Tag,
  Layers,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import type { PackagingGroupRule } from '../types';

interface GroupBarcodeTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: PackagingGroupRule[];
  onSelectGroup?: (rule: PackagingGroupRule) => void;
  language?: 'ar' | 'en';
}

export const GroupBarcodeTagsModal: React.FC<GroupBarcodeTagsModalProps> = ({
  isOpen,
  onClose,
  rules,
  onSelectGroup,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-6 print:bg-white print:border-none print:shadow-none print:p-0 print:my-0">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isRtl ? 'بطاقات باركود مجموعات المنتجات للرفوف' : 'Shelf Packaging Group Barcode Tags'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'اطبع هذه البطاقات وثبتها على أرفف المستودع للتبديل الفوري بين المجموعات بمسح الباركود في وضع الجرد السريع' 
                  : 'Print & attach to warehouse shelves for instant group switching via barcode scanner'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{isRtl ? 'طباعة البطاقات' : 'Print Tags'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tags Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-4">
          {rules.map((rule) => {
            const groupScanCode = `GRP-${rule.id}`;
            return (
              <div
                key={rule.id}
                className="bg-slate-950/90 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-4 transition-all print:border-black print:bg-white print:text-black flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5 print:border-black">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white print:text-black">{rule.name}</span>
                        {rule.category && (
                          <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-semibold border border-indigo-800 print:border-black print:text-black print:bg-slate-100">
                            {rule.category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 print:text-slate-700 mt-0.5">
                        نطاق الباركود: <span className="font-mono font-bold text-slate-300 print:text-black">{rule.startBarcode} ➔ {rule.endBarcode}</span>
                      </div>
                    </div>

                    <div className="p-1.5 bg-slate-900 print:bg-slate-100 rounded-lg text-indigo-400 print:text-black">
                      <Boxes className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Packaging breakdown badges */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-900/90 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 print:text-slate-600 font-semibold">معامل الكرتون</div>
                      <div className="text-sm font-black text-amber-300 print:text-black font-mono">
                        {rule.cartonFactor} <span className="text-[10px] font-normal">{rule.unitName}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/90 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 print:text-slate-600 font-semibold">معامل الباكت</div>
                      <div className="text-sm font-black text-indigo-300 print:text-black font-mono">
                        {rule.packFactor} <span className="text-[10px] font-normal">{rule.unitName}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/90 print:bg-slate-100 border border-slate-800 print:border-slate-300 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 print:text-slate-600 font-semibold">الوحدة الأساسية</div>
                      <div className="text-sm font-black text-emerald-300 print:text-black">
                        {rule.unitName}
                      </div>
                    </div>
                  </div>

                  {/* Barcode Display Box */}
                  <div className="bg-white text-black p-3 rounded-xl flex flex-col items-center justify-center space-y-1 shadow-inner border border-slate-300">
                    <div className="text-[10px] font-bold text-slate-600 tracking-wider">
                      امسح بالباركود للتبديل الفوري للجرد السريع:
                    </div>
                    {/* Visual Barcode Pattern Representation */}
                    <div className="font-mono text-xl tracking-[0.25em] font-black text-slate-950 py-1 select-all">
                      ||| | |||| | ||| ||||
                    </div>
                    <div className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-3 py-0.5 rounded border border-slate-300">
                      {groupScanCode}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      (أو امسح نطاق البداية: {rule.startBarcode})
                    </div>
                  </div>
                </div>

                {onSelectGroup && (
                  <div className="pt-3 mt-3 border-t border-slate-800 print:hidden flex justify-end">
                    <button
                      onClick={() => {
                        onSelectGroup(rule);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-xs font-bold transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تفعيل هذه المجموعة في الجرد السريع</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400 print:hidden">
          <span>عدد المجموعات المتاحة للطباعة: {rules.length} مجموعة</span>
          <span>وضع الجرد السريع مدعوم بالكامل مع القوارئ الليزرية والهواتف</span>
        </div>
      </div>
    </div>
  );
};
