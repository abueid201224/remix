import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  Calculator, 
  Workflow, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  X, 
  ChevronRight, 
  Sparkles, 
  Boxes, 
  Truck, 
  ScanLine, 
  RotateCcw, 
  ListFilter, 
  FileText, 
  ShieldCheck, 
  Copy, 
  Check, 
  Sliders, 
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Database,
  Archive,
  Eye,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export type LogicGuideTab = 'all' | 'audit' | 'returns' | 'receiving' | 'inventory' | 'picking' | 'discrepancy' | 'packaging' | 'calculator';

interface LogicGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LogicGuideTab;
  isRtl?: boolean;
}

export const LogicGuideModal: React.FC<LogicGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'audit',
  isRtl = true,
}) => {
  const [activeTab, setActiveTab] = useState<LogicGuideTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  // Live Interactive Calculator States
  const [calcCartons, setCalcCartons] = useState<number>(5);
  const [calcPacks, setCalcPacks] = useState<number>(3);
  const [calcLoose, setCalcLoose] = useState<number>(4);
  const [calcPackRatio, setCalcPackRatio] = useState<number>(12);
  const [calcCartonRatio, setCalcCartonRatio] = useState<number>(72);

  const [calcPrice, setCalcPrice] = useState<number>(150);
  const [calcQty, setCalcQty] = useState<number>(4);
  const [calcVatPercent, setCalcVatPercent] = useState<number>(15);
  const [calcDeduction, setCalcDeduction] = useState<number>(0);

  const [calcScannedCode, setCalcScannedCode] = useState<string>('00062810045231');

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormula(id);
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  // Interactive packaging calculation
  const totalCalculatedPieces = useMemo(() => {
    const fromCartons = (calcCartons || 0) * (calcCartonRatio || 1);
    const fromPacks = (calcPacks || 0) * (calcPackRatio || 1);
    const fromLoose = calcLoose || 0;
    return fromCartons + fromPacks + fromLoose;
  }, [calcCartons, calcPacks, calcLoose, calcPackRatio, calcCartonRatio]);

  // Interactive refund calculation
  const totalCalculatedRefund = useMemo(() => {
    const subtotal = (calcPrice || 0) * (calcQty || 0);
    const afterDeduction = Math.max(0, subtotal - (calcDeduction || 0));
    const vat = afterDeduction * ((calcVatPercent || 0) / 100);
    return {
      subtotal,
      vat,
      total: afterDeduction + vat
    };
  }, [calcPrice, calcQty, calcVatPercent, calcDeduction]);

  // Barcode normalizer simulation
  const normalizedBarcodeResult = useMemo(() => {
    const trimmed = calcScannedCode.trim();
    const withoutLeadingZeros = trimmed.replace(/^0+/, '');
    const isEan13 = trimmed.length === 13;
    const isEan14 = trimmed.length === 14;
    return {
      raw: calcScannedCode,
      trimmed,
      withoutLeadingZeros: withoutLeadingZeros || '0',
      formatGuess: isEan13 ? 'EAN-13 Consumer Unit' : isEan14 ? 'ITF-14 / EAN-14 Trade Case' : 'Code-128 / Custom SKU',
    };
  }, [calcScannedCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-950/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية' : 'WMS Logic, Math Formulas & Problem-Solving Guide'}
                </h2>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                  SOP v4.2 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'مرجع الشفافية الرقابية: شرح المعادلات الرياضية، نماذج بناء الفرضيات، وحل المشكلات التشغيلية' 
                  : 'Algorithmic transparency: mathematical models, hypothesis formulation & operational troubleshooting'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-all"
              title={isRtl ? 'إغلاق الدليل' : 'Close Guide'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Navigation & Search Bar */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Quick Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs font-semibold">
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'audit' 
                  ? 'bg-emerald-600 text-white font-bold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تدقيق الفواتير والباركود' : 'Dispatch Audit'}</span>
            </button>

            <button
              onClick={() => setActiveTab('returns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'returns' 
                  ? 'bg-amber-600 text-white font-bold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRtl ? 'المرتجعات واسترداد المبالغ' : 'Returns & RMA'}</span>
            </button>

            <button
              onClick={() => setActiveTab('receiving')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'receiving' 
                  ? 'bg-blue-600 text-white font-bold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{isRtl ? 'الاستلام والمطابقة PO' : 'Inbound Receiving'}</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'inventory' 
                  ? 'bg-indigo-600 text-white font-bold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{isRtl ? 'الجرد وتفكيك العبوات' : 'Cycle Count'}</span>
            </button>

            <button
              onClick={() => setActiveTab('picking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'picking' 
                  ? 'bg-cyan-600 text-white font-bold shadow-sm' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{isRtl ? 'موجات الانتقاء والتجهيز' : 'Wave Picking'}</span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'calculator' 
                  ? 'bg-purple-600 text-white font-bold shadow-sm ring-1 ring-purple-400' 
                  : 'text-purple-300 bg-purple-950/40 hover:bg-purple-900/60'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isRtl ? 'حاسبة المعادلات التفاعلية ⚡' : 'Live Math Sandbox'}</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isRtl ? 'بحث في القوانين والحلول...' : 'Search formulas & SOP...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-200">

          {/* TAB 1: Dispatch Audit Logic & Formulas */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Section Header */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                  <ScanLine className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-300">
                    {isRtl ? 'منطق تدقيق الفواتير ومطابقة الباركود السريع (Dispatch Audit Engine)' : 'Dispatch Audit Engine & Barcode Logic'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'تم تصميم محرك التدقيق ليعمل بأسلوب الفحص العشوائي الخالي من الترتيب المسبق (Random Unordered Scanning) مع استجابة فورية لأجهزة مسدس الليزر وأجهزة الباركود Wedge بدون الحاجة للنقر داخل حقول الإدخال.'
                      : 'Designed for non-blocking random scanning with automated hardware wedge listening and real-time discrepancy attributions.'}
                  </p>
                </div>
              </div>

              {/* Formulas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Formula 1: Progress Ratio */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      {isRtl ? 'معادلة نسبة اكتمال الفاتورة' : 'Invoice Fulfillment Ratio'}
                    </span>
                    <button 
                      onClick={() => handleCopy('Progress% = (Sum(min(Scanned_i, Required_i)) / Sum(Required_i)) * 100', 'f1')}
                      className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                      title="نسخ المعادلة"
                    >
                      {copiedFormula === 'f1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-emerald-300 rounded-lg border border-slate-800 overflow-x-auto text-left ltr">
                    {"Progress% = ( ∑ min(Scanned_i, Required_i) / ∑ Required_i ) × 100"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl 
                      ? 'الهدف: منع تجاوز النسبة 100% في حال قام المحضر بمسح كميات زائدة عن المطلوب في أحد الأصناف.' 
                      : 'Prevents completion distortion if surplus quantities are scanned for a single line item.'}
                  </p>
                </div>

                {/* Formula 2: Discrepancy Delta */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      {isRtl ? 'معادلة فروقات التجهيز والتحكيم' : 'Discrepancy Delta & Variance'}
                    </span>
                    <button 
                      onClick={() => handleCopy('Delta_i = ScannedQty_i - RequiredQty_i', 'f2')}
                      className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                    >
                      {copiedFormula === 'f2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-amber-300 rounded-lg border border-slate-800 overflow-x-auto text-left ltr whitespace-pre-wrap">
                    {"Δ_i = Scanned_i - Required_i  →  [Δ < 0 : Shortage/عجز] | [Δ > 0 : Surplus/زيادة] | [Item ∉ Invoice : Alien/خطأ تجهيز صنف]"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl 
                      ? 'يتم توثيق كل فرق تلقائياً وحفظه في سجل الملاحظات الرقابية مع هوية وتوقيع المراجع.' 
                      : 'Automatically classifies and logs shortage, surplus, and cross-invoice wrong picking items.'}
                  </p>
                </div>

              </div>

              {/* Barcode String Normalization Logic */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  {isRtl ? 'خوارزمية تنظيف ومطابقة الأصفار البادئة للباركود (Barcode Normalization)' : 'Barcode Key Sanitization Algorithm'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                    <p className="font-bold text-slate-200">{isRtl ? '1. إزالة الفراغات والرموز الخفية' : '1. Whitespace Stripping'}</p>
                    <p className="text-slate-400">تنظيف أحرف `\r\n` والمسافات الناتجة عن قارئ المسدس.</p>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                    <p className="font-bold text-slate-200">{isRtl ? '2. مطابقة الأصفار البادئة' : '2. Zero-Prefix Tolerance'}</p>
                    <p className="text-slate-400">مطابقة الكود سواء كان `001234` أو `1234` لمنع أخطاء اختلاف تنسيق الإكسيل.</p>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                    <p className="font-bold text-slate-200">{isRtl ? '3. فحص الصنف الدخيل' : '3. Cross-Invoice Lookup'}</p>
                    <p className="text-slate-400">إذا لم ينتمِ الكود للفاتورة الحالية، يتم البحث في قاعدة اليوم لتحديد فاتورته الأصلية فوراً.</p>
                  </div>
                </div>
              </div>

              {/* Problem Solving & Decision Matrix */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-amber-400" />
                  {isRtl ? 'شجرة حل المشكلات وطرق بناء الفرضيات التشغيلية (Hypothesis & Troubleshooting)' : 'Operational Hypothesis & Troubleshooting'}
                </h4>
                
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-3">
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold shrink-0">المشكلة 1</span>
                    <div>
                      <p className="font-bold text-slate-200">مسح كود صنف غريب غير موجود في الفاتورة (Alien Barcode Scan)</p>
                      <p className="text-slate-400 mt-0.5">
                        <strong>الفرضية:</strong> قام محضر الطلبات بسحب الصنف من رف مجاور أو خلط بين طلبيتين أثناء التجهيز.<br />
                        <strong>طريقة الحل:</strong> يقوم النظام بإصدار صوت تحذيري عالي، ويظهر نافذة تبيّن اسم الصنف ورقم الفاتورة الحقيقية التي ينتمي إليها مع تسجيل الواقعة كـ "صنف ملتقط بالخطأ".
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-3">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">المشكلة 2</span>
                    <div>
                      <p className="font-bold text-slate-200">الباركود تالف أو ملصق مشوه لا يقرؤه السكانر</p>
                      <p className="text-slate-400 mt-0.5">
                        <strong>الفرضية:</strong> تلف في الطباعة الحرارية للباركود أثناء النقل.<br />
                        <strong>طريقة الحل:</strong> يمكن كتابة جزء من كود الصنف أو اسمه في خانة البحث اليدوي، أو النقر على زر (+) في سطر الصنف لزيادة العدد يدوياً مع استمرار التدقيق.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Returns & RMA Refund Logic */}
          {activeTab === 'returns' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Header */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-300">
                    {isRtl ? 'منطق المرتجعات وفحص الجودة والاسترداد المالي (RMA & Refund Audit)' : 'Returns, RMA & Financial Refund Calculations'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'قواعد التحقق الصارم من سياسة الإرجاع، تفكيك فواتير الـ PDF المستوردة، وعزل الأصناف التي تتطلب فحصاً مخبرياً (Lab Inspection) مع حساب المبالغ المستحقة للعميل بدقة متناهية.'
                      : 'Strict refund calculation rules, multi-invoice PDF parsing, and laboratory quality assessment workflows.'}
                  </p>
                </div>
              </div>

              {/* Formulas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Formula: Net Refund */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-400" />
                      {isRtl ? 'معادلة صافي الاسترداد المالي للعميل' : 'Net Refund Calculation Formula'}
                    </span>
                    <button 
                      onClick={() => handleCopy('NetRefund = Sum(Price_j * ApprovedQty_j * (1 - Discount_j)) * (1 + TaxRate) - Fees', 'f3')}
                      className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                    >
                      {copiedFormula === 'f3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-amber-300 rounded-lg border border-slate-800 overflow-x-auto text-left ltr">
                    {"NetRefund = ∑ ( UnitPrice_j × ApprovedQty_j × (1 - Discount_j) ) × (1 + TaxRate) - Fees"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl 
                      ? 'تشمل ضريبة القيمة المضافة (15% VAT) بعد خصم العروض الترويجية وأي رسوم استرجاع معتمدة.' 
                      : 'Applies VAT (15%) and deducts promotional discounts or approved restocking charges.'}
                  </p>
                </div>

                {/* Formula: Quality Rejection Index */}
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />
                      {isRtl ? 'معادلة نسبة الرفض والتلف المخبري' : 'Quality Rejection Ratio'}
                    </span>
                    <button 
                      onClick={() => handleCopy('RejectionRate% = (RejectedQty / ReturnedQty) * 100', 'f4')}
                      className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                    >
                      {copiedFormula === 'f4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-rose-300 rounded-lg border border-slate-800 overflow-x-auto text-left ltr">
                    {"RejectionRate% = ( (RejectedQty + DamagedQty) / TotalReturnedQty ) × 100"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl 
                      ? 'مؤشر أداء لجودة المرتجعات؛ تنبيه فوري إذا تجاوزت نسبة التلف 10% لاتخاذ إجراءات التحقيق مع شركة الشحن.' 
                      : 'Triggers alert when supplier or courier damage exceeds predefined tolerance thresholds.'}
                  </p>
                </div>

              </div>

              {/* Hypotheses & Problem-Solving in Returns */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-amber-400" />
                  {isRtl ? 'فرضيات تقييم المرتجعات وسياسات التحكيم (RMA Decision Logic)' : 'RMA Evaluation Hypotheses'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                    <p className="font-bold text-emerald-300">✅ حالة: صنف سليم ومطابق 100%</p>
                    <p className="text-slate-400">
                      <strong>الإجراء:</strong> إرجاع فوري للرفوف والمخزون الحي (Restock) وإصدار سند استرداد نقدي/إلكتروني فوري للعميل.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                    <p className="font-bold text-amber-300">⏳ حالة: صنف يحتاج فحص جودة / مختبر</p>
                    <p className="text-slate-400">
                      <strong>الإجراء:</strong> تعليق الاسترداد جزئياً، وتحويل التقرير لحالة `PENDING_LAB` مع منح مهلة فحص 48 ساعة قبل اتخاذ القرار النهائي.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: Inbound Receiving & PO Reconciliation */}
          {activeTab === 'receiving' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-blue-300">
                    {isRtl ? 'منطق الاستلام ومطابقة أوامر الشراء (Inbound PO Reconciliation)' : 'Inbound Receiving & PO Match Logic'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'مطابقة الشحنات الواردة من الموردين ضد أوامر الشراء (Purchase Orders) مع تسجيل تواريخ الصلاحية ورقم التشغيلة (Batch/Lot) وكشف النقص أو التوريد الزائد.'
                      : 'Verifies supplier inbound shipments against purchase orders, batch numbers, and expiry thresholds.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    {isRtl ? 'معادلة نسبة إنجاز التوريد (Fulfillment Ratio)' : 'PO Fulfillment Ratio'}
                  </span>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-blue-300 rounded-lg border border-slate-800 text-left ltr">
                    {"Fulfillment% = ( ∑ ReceivedQty / ∑ OrderedQty ) × 100"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl ? 'إذا كانت النسبة أقل من 100%، يُسجل النظام استلاماً جزئياً (Partial Receiving) لإشعار قسم المشتريات.' : 'Flags partial deliveries automatically.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    {isRtl ? 'معادلة انحراف الشحنة الواردة' : 'Inbound Variance Tolerance'}
                  </span>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-amber-300 rounded-lg border border-slate-800 text-left ltr">
                    {"Variance = ReceivedQty - ( OrderedQty × (1 + Tolerance%) )"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl ? 'منع دخول كميات زائدة تتعدى نسبة السماحية المتفق عليها في عقد التوريد.' : 'Prevents accepting unauthorized over-shipments.'}
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: Inventory Count & Packaging Breakdown */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 flex items-start gap-3">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-indigo-300">
                    {isRtl ? 'منطق الجرد الدوري وتفكيك معاملات العبوات (Cycle Count & Packaging Multipliers)' : 'Packaging Conversion & Cycle Count Logic'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'التحويل الرياضي الدقيق بين الكراتين (Cartons)، والشدّات (Packs/Inners)، والقطع الفردية (Loose Pieces)، وحساب دقة المخزون الإجمالية.'
                      : 'Decomposes complex multi-level packaging hierarchies into baseline inventory atomic units.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-400" />
                    {isRtl ? 'معادلة تفكيك العبوات إلى حبات' : 'Packaging Decomposition Formula'}
                  </span>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-indigo-300 rounded-lg border border-slate-800 text-left ltr">
                    {"TotalUnits = (Cartons × Factor_Carton) + (Packs × Factor_Pack) + LoosePieces"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl ? 'مثال: 5 كراتين (كل كرتون 72 حبة) + 3 شدات (كل شدة 12) + 4 حبات = 400 قطعة.' : 'Converts multi-tier cases into base pieces.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    {isRtl ? 'معادلة دقة الجرد الشاملة (IRA %)' : 'Inventory Record Accuracy (IRA)'}
                  </span>
                  <div className="p-3 bg-slate-950 font-mono text-xs text-emerald-300 rounded-lg border border-slate-800 text-left ltr">
                    {"IRA% = 100 - ( ∑ |PhysicalCount_k - SystemStock_k| / ∑ SystemStock_k × 100 )"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {isRtl ? 'المعيار العالمي للمستودعات الذكية يستهدف دقة 99.5% وأعلى.' : 'Calculates overall warehouse inventory integrity.'}
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: Picking Wave List */}
          {activeTab === 'picking' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 flex items-start gap-3">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg shrink-0 mt-0.5">
                  <ListFilter className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-cyan-300">
                    {isRtl ? 'منطق موجات التجهيز المجمعة (Batch Wave Picking Optimization)' : 'Batch Wave Picking Logic'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'تجميع بنود عدة فواتير في مسار تجهيز واحد (Wave) لاختصار مسافة ووقت المشي للمحضر بنسبة تصل إلى 65%.'
                      : 'Consolidates identical SKU lines across dozens of invoices into a single optimized warehouse picking wave.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2.5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  {isRtl ? 'معادلة التجميع التراكمي وتوفير مسار التجهيز' : 'Wave Aggregation & Travel Distance Savings'}
                </span>
                <div className="p-3 bg-slate-950 font-mono text-xs text-cyan-300 rounded-lg border border-slate-800 text-left ltr">
                  {"WaveQty(item_i) = ∑ Qty(inv, item_i),   Savings% = ( 1 - Path_wave / ∑ Path_individual ) × 100"}
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: Interactive Live Calculator Sandbox */}
          {activeTab === 'calculator' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 flex items-start gap-3">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg shrink-0 mt-0.5">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-purple-300">
                    {isRtl ? 'حاسبة ومختبر المعادلات التفاعلي الحي (Live Math Sandbox)' : 'Interactive Math & Formula Sandbox'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {isRtl 
                      ? 'جرّب بنفسك: أدخل قيماً حقيقية لاختبار معادلات تفكيك العبوات، حساب الاسترداد المالي مع الضريبة، وفحص تنظيف الباركود فورياً.'
                      : 'Test real values against WMS formulas in real-time with visual calculations and breakdown steps.'}
                  </p>
                </div>
              </div>

              {/* Calculator 1: Packaging Breakdown */}
              <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-slate-200">
                      {isRtl ? '1. حاسبة تفكيك العبوات والكراتين' : '1. Packaging Multiplier Sandbox'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-indigo-300 bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-700/40">
                    {totalCalculatedPieces} {isRtl ? 'حبة إجمالية' : 'Total Pieces'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">الكراتين (Cartons)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcCartons}
                      onChange={(e) => setCalcCartons(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono font-bold text-center focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">معامل الكرتون (حبة/كرتون)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={calcCartonRatio}
                      onChange={(e) => setCalcCartonRatio(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-indigo-300 font-mono font-bold text-center focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الشدّات (Packs)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcPacks}
                      onChange={(e) => setCalcPacks(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono font-bold text-center focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">معامل الشدة (حبة/شدة)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={calcPackRatio}
                      onChange={(e) => setCalcPackRatio(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-indigo-300 font-mono font-bold text-center focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-slate-400 mb-1">حبات فردية (Loose)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcLoose}
                      onChange={(e) => setCalcLoose(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono font-bold text-center focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    خطوات الحل: ({calcCartons} × {calcCartonRatio}) + ({calcPacks} × {calcPackRatio}) + {calcLoose} = <strong>{totalCalculatedPieces} قطعة</strong>
                  </span>
                  <span className="text-emerald-400 font-bold">جاهز للمطابقة الرقابية ✅</span>
                </div>
              </div>

              {/* Calculator 2: Refund & VAT */}
              <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-slate-200">
                      {isRtl ? '2. حاسبة الاسترداد المالي للمرتجع مع الضريبة' : '2. RMA Refund & VAT Sandbox'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2.5 py-1 rounded-full border border-amber-700/40">
                    {totalCalculatedRefund.total.toFixed(2)} ر.س
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">سعر الحبة (ريال)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcPrice}
                      onChange={(e) => setCalcPrice(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الكمية المقبولة</label>
                    <input 
                      type="number" 
                      min="1"
                      value={calcQty}
                      onChange={(e) => setCalcQty(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">نسبة الضريبة (VAT %)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcVatPercent}
                      onChange={(e) => setCalcVatPercent(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-300 font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رسوم استرجاع/خصم (ريال)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={calcDeduction}
                      onChange={(e) => setCalcDeduction(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-rose-300 font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>المجموع قبل الضريبة: <strong>{totalCalculatedRefund.subtotal.toFixed(2)} ر.س</strong></div>
                  <div>قيمة الضريبة المضافة: <strong>{totalCalculatedRefund.vat.toFixed(2)} ر.س</strong></div>
                  <div className="text-amber-300 font-bold">الصافي المستحق: <strong>{totalCalculatedRefund.total.toFixed(2)} ر.س</strong></div>
                </div>
              </div>

              {/* Calculator 3: Barcode Sanitizer Tester */}
              <div className="p-5 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-slate-200">
                      {isRtl ? '3. اختبار ومحاكاة معالج تنظيف الباركود' : '3. Barcode Sanitizer & Zero Stripper'}
                    </h4>
                  </div>
                  <span className="text-xs font-mono text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-700/40">
                    {normalizedBarcodeResult.formatGuess}
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">الكود المدخل أو الممسوح (Raw Barcode):</label>
                  <input 
                    type="text" 
                    value={calcScannedCode}
                    onChange={(e) => setCalcScannedCode(e.target.value)}
                    placeholder="جرّب إدخال باركود به أصفار بادئة أو مسافات..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400">الكود بعد إزالة الأصفار والمسافات (Normalized Key):</span>
                    <p className="font-mono text-sm font-bold text-emerald-300 mt-1">{normalizedBarcodeResult.withoutLeadingZeros}</p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-400">تنسيق الرمز المقترح:</span>
                    <p className="font-mono text-sm font-bold text-indigo-300 mt-1">{normalizedBarcodeResult.formatGuess}</p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? 'جميع المعادلات متوافقة مع معايير WMS الرقابية والتدقيق الداخلي' : 'Compliant with International Warehouse Management SOP & Audit Standards'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('calculator')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-700/40 transition-all flex items-center gap-1"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تجربة الحاسبة' : 'Open Sandbox'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors"
            >
              {isRtl ? 'إغلاق الدليل' : 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
