import React from 'react';
import { 
  ScanLine, 
  Truck, 
  RotateCcw, 
  Boxes, 
  ListFilter, 
  AlertTriangle, 
  Database, 
  Sliders, 
  BookOpen, 
  ShieldCheck, 
  ArrowRight, 
  FileSpreadsheet, 
  Smartphone, 
  Sparkles,
  WifiOff,
  UserCheck,
  CheckCircle2,
  Lock,
  Layers,
  Zap,
  HelpCircle
} from 'lucide-react';
import type { SyncMetadata, AppSettings, ActiveInvoiceSession } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFINITIONS, type UserRole } from '../types';
import type { ActiveNavTab } from './Navbar';
import type { LogicGuideTab } from './LogicGuideModal';

interface WelcomeDashboardScreenProps {
  onSelectTab?: (tab: ActiveNavTab) => void;
  onSelectService?: (tab: ActiveNavTab) => void;
  syncMeta: SyncMetadata;
  onOpenSyncModal: () => void;
  onOpenLogicGuide: (tab?: LogicGuideTab) => void;
  onOpenUserModal: () => void;
  onOpenApkGuide?: () => void;
  discrepanciesCount?: number;
  wrongPickingsCount?: number;
  errorCount?: number;
  pendingLabCount?: number;
  overdueLabCount?: number;
  activeSession: ActiveInvoiceSession | null;
  settings?: AppSettings;
  isRtl?: boolean;
}

export const WelcomeDashboardScreen: React.FC<WelcomeDashboardScreenProps> = ({
  onSelectTab,
  onSelectService,
  syncMeta,
  onOpenSyncModal,
  onOpenLogicGuide,
  onOpenUserModal,
  onOpenApkGuide,
  discrepanciesCount = 0,
  wrongPickingsCount = 0,
  errorCount,
  pendingLabCount = 0,
  overdueLabCount = 0,
  activeSession,
  settings,
  isRtl: isRtlProp,
}) => {
  const { currentAppUser, activeRole, roleConfig } = useAuth();
  const isRtl = isRtlProp !== undefined ? isRtlProp : (settings?.language === 'ar' || true);
  const handleSelectTab = (tab: ActiveNavTab) => {
    if (onSelectTab) onSelectTab(tab);
    else if (onSelectService) onSelectService(tab);
  };

  const totalErrors = errorCount !== undefined ? errorCount : (discrepanciesCount + wrongPickingsCount);

  const userName = currentAppUser?.name || settings?.auditorName || (isRtl ? 'المستخدم' : 'User');
  const userJobId = currentAppUser?.jobId || settings?.auditorId || 'AUD-101';

  // Services Catalog
  const serviceCards: {
    id: ActiveNavTab;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    icon: React.ElementType;
    badge?: string;
    badgeColor?: string;
    color: string;
    allowedRoles: UserRole[];
    guideTab?: LogicGuideTab;
  }[] = [
    {
      id: 'audit',
      titleAr: 'المراجعة والتدقيق والباركود',
      titleEn: 'Dispatch Barcode Audit',
      descAr: 'مطابقة فواتير الإرسال حبة بحبة مع كشف العجز، الزيادة، والأصناف التائهة وتوثيق الاعتماد',
      descEn: 'Scan-by-scan invoice dispatch verification with automated shortage & surplus detection',
      icon: ScanLine,
      badge: activeSession ? (isRtl ? `جلسة نشطة: ${activeSession.invoiceNo}` : `Active: ${activeSession.invoiceNo}`) : undefined,
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
      color: 'from-emerald-600/20 to-emerald-950/40 border-emerald-700/50 text-emerald-400 group-hover:border-emerald-500',
      allowedRoles: ['AUDITOR', 'SUPERVISOR', 'WAREHOUSE_KEEPER', 'GUEST'],
      guideTab: 'audit',
    },
    {
      id: 'receiving',
      titleAr: 'الاستلام ومطابقة التوريدات',
      titleEn: 'Inbound Receiving & POs',
      descAr: 'فحص شحنات الموردين وسندات التوريد، تسجيل التوالف والمطابقة مع أوامر الشراء',
      descEn: 'Inspect inbound supplier shipments, track damaged goods and match against Purchase Orders',
      icon: Truck,
      color: 'from-blue-600/20 to-blue-950/40 border-blue-700/50 text-blue-400 group-hover:border-blue-500',
      allowedRoles: ['WAREHOUSE_KEEPER', 'SUPERVISOR', 'AUDITOR', 'GUEST'],
      guideTab: 'receiving',
    },
    {
      id: 'returns',
      titleAr: 'المرتجعات وفحص الجودة (RMA)',
      titleEn: 'Returns & Quality Inspection',
      descAr: 'معالجة المرتجعات واسترداد المبالغ (RMA)، وتوجيه العينات للمعمل الفني المعتمد',
      descEn: 'Process customer returns, calculate net refunds, and transfer items for lab arbitration',
      icon: RotateCcw,
      color: 'from-amber-600/20 to-amber-950/40 border-amber-700/50 text-amber-400 group-hover:border-amber-500',
      allowedRoles: ['AUDITOR', 'SUPERVISOR', 'WAREHOUSE_KEEPER', 'GUEST'],
      guideTab: 'returns',
    },
    {
      id: 'inventory',
      titleAr: 'الجرد وتفكيك العبوات',
      titleEn: 'Cycle Count & Packaging',
      descAr: 'جرد مستودعي دوري وتفكيك الكراتين والشدات والحبات مع احتساب دقة الجرد IRA%',
      descEn: 'Physical cycle count decomposing cases, packs & pieces with IRA% integrity formulas',
      icon: Boxes,
      color: 'from-indigo-600/20 to-indigo-950/40 border-indigo-700/50 text-indigo-400 group-hover:border-indigo-500',
      allowedRoles: ['WAREHOUSE_KEEPER', 'SUPERVISOR', 'AUDITOR', 'GUEST'],
      guideTab: 'inventory',
    },
    {
      id: 'picking',
      titleAr: 'موجات وتجميع الانتقاء',
      titleEn: 'Batch Wave Picking',
      descAr: 'تجميع طلبات الفواتير المتعددة في موجة سحب واحدة وتوزيعها حسب مستويات خبرة العمال',
      descEn: 'Aggregate multi-order picking waves and optimize picking paths by worker experience',
      icon: ListFilter,
      color: 'from-cyan-600/20 to-cyan-950/40 border-cyan-700/50 text-cyan-400 group-hover:border-cyan-500',
      allowedRoles: ['WAREHOUSE_KEEPER', 'SUPERVISOR', 'AUDITOR', 'GUEST'],
      guideTab: 'picking',
    },
    {
      id: 'errors',
      titleAr: 'سجل الفروقات والأصناف التائهة',
      titleEn: 'Discrepancy & Discard Logs',
      descAr: 'سجل الفروقات المكتشفة والأصناف الخاطئة مع إمكانية التصدير والتحليل الرقابي',
      descEn: 'Audit discrepancies, alien scan records, and ISO/ISA 500 evidentiary documentation',
      icon: AlertTriangle,
      badge: (totalErrors > 0) ? `${totalErrors} ${isRtl ? 'فروقات' : 'Issues'}` : undefined,
      badgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
      color: 'from-rose-600/20 to-rose-950/40 border-rose-700/50 text-rose-400 group-hover:border-rose-500',
      allowedRoles: ['AUDITOR', 'SUPERVISOR', 'WAREHOUSE_KEEPER', 'GUEST'],
      guideTab: 'discrepancy',
    },
    {
      id: 'master',
      titleAr: 'قاعدة فواتير اليوم المرفوعة',
      titleEn: 'Master Invoices Database',
      descAr: 'استعراض بيانات الفواتير المحملة محلياً والبحث في الأصناف والأوامر المفتوحة',
      descEn: 'Browse loaded master invoices, search items, and examine offline data records',
      icon: Database,
      badge: syncMeta.totalInvoices > 0 ? `${syncMeta.totalInvoices} ${isRtl ? 'فاتورة' : 'Invoices'}` : undefined,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      color: 'from-slate-700/20 to-slate-900/40 border-slate-700 text-slate-300 group-hover:border-slate-500',
      allowedRoles: ['AUDITOR', 'SUPERVISOR', 'WAREHOUSE_KEEPER', 'GUEST'],
    },
    {
      id: 'settings',
      titleAr: 'أدوات المسح والمحاكي والتهيئة',
      titleEn: 'Scanner Tools & Config',
      descAr: 'محاكي أجهزة الباركود، ضبط حساسية القارئ، وتفضيلات الصوت والاهتزاز',
      descEn: 'Barcode scanner hardware tester, sensitivity threshold, sound and UI preferences',
      icon: Sliders,
      color: 'from-purple-600/20 to-purple-950/40 border-purple-700/50 text-purple-400 group-hover:border-purple-500',
      allowedRoles: ['AUDITOR', 'SUPERVISOR', 'WAREHOUSE_KEEPER', 'GUEST'],
    },
  ];

  return (
    <div className={`space-y-6 max-w-6xl mx-auto py-2 sm:py-4 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Main Welcome Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 end-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 start-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 shadow-sm">
                <WifiOff className="w-3.5 h-3.5" />
                {isRtl ? 'نظام المستودعات الذكي Offline-First' : 'Offline-First Smart WMS'}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleConfig.color} ${roleConfig.bgLight}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {isRtl ? roleConfig.labelAr : roleConfig.labelEn}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              {isRtl ? `مرحباً بك، ${userName} 👋` : `Welcome, ${userName} 👋`}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
              {isRtl 
                ? 'كيف تريد أن تبدأ اليوم؟ اختر الخدمة المستودعية المطلوبة للانطلاق الفوري، أو استعرض الدليل المنطقي والرقابي.'
                : 'How would you like to start today? Select any warehouse operation below for instant execution, or explore the Logic Guide.'}
            </p>
          </div>

          {/* Quick Action Profile & Guide Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onOpenUserModal}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>{isRtl ? 'تبديل المستخدم / الحساب' : 'Switch User / Account'}</span>
            </button>

            <button
              onClick={() => onOpenLogicGuide('all')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-700/60 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>{isRtl ? 'دليل المنطق والمعادلات 💡' : 'Logic & Math Guide 💡'}</span>
            </button>
          </div>
        </div>

        {/* Live Quick Status Strip */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">{isRtl ? 'الفواتير المحملة' : 'Master Invoices'}</span>
            <span className="font-bold text-base text-white font-mono">
              {syncMeta.totalInvoices.toLocaleString()} {isRtl ? 'فاتورة' : 'Inv'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">{isRtl ? 'الأصناف بالقاعدة' : 'Total Items'}</span>
            <span className="font-bold text-base text-white font-mono">
              {syncMeta.totalItems.toLocaleString()} {isRtl ? 'صنف' : 'Items'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">{isRtl ? 'فروقات التدقيق' : 'Discrepancies'}</span>
            <span className={`font-bold text-base font-mono ${totalErrors > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {totalErrors} {isRtl ? 'عجز/زيادة' : 'Diffs'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-slate-400 block mb-1">{isRtl ? 'حالة التخزين' : 'Persistence'}</span>
            <span className="font-bold text-base text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>100% Offline IndexedDB</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Fast Launch Action Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>{isRtl ? 'اختر الخدمة المستودعية للبدء الفوري:' : 'Select Operation to Start:'}</span>
          </h2>

          <button
            onClick={onOpenSyncModal}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-700/40 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isRtl ? 'رفع / مزامنة إكسيل فواتير اليوم' : 'Import / Sync Invoices'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceCards.map((service) => {
            const Icon = service.icon;
            const isAllowed = service.allowedRoles.includes(activeRole);

            return (
              <div
                key={service.id}
                onClick={() => handleSelectTab(service.id)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br bg-slate-900/90 border p-5 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between ${service.color}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-700 flex items-center justify-center shadow-inner">
                      <Icon className="w-6 h-6" />
                    </div>

                    {service.badge && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${service.badgeColor}`}>
                        {service.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-1.5">
                    {isRtl ? service.titleAr : service.titleEn}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {isRtl ? service.descAr : service.descEn}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300 group-hover:text-white flex items-center gap-1.5">
                    <span>{isRtl ? 'فتح الخدمة وتفعيل الشاشة' : 'Launch Service'}</span>
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                  </span>

                  {service.guideTab && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLogicGuide(service.guideTab);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/50 transition-colors"
                      title={isRtl ? 'دليل وشرح هذه الخدمة' : 'Service Logic Guide'}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Knowledge & Companion Resources Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Android APK Companion */}
        <div 
          onClick={onOpenApkGuide}
          className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-800/50 hover:border-indigo-500/80 cursor-pointer transition-all shadow-md flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-600/50 flex items-center justify-center text-indigo-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isRtl ? 'بناء تطبيق أندرويد APK وتحميل دليل PDF 📱' : 'Android APK Build Guide & PDF Export'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl ? 'تحويل النظام لملف APK لأجهزة الجرد وقوارئ الباركود اليدوية مع ملف PDF شامل' : 'Export and run on industrial handheld Android barcode terminals'}
              </p>
            </div>
          </div>
          <ArrowRight className={`w-4 h-4 text-indigo-400 flex-shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
        </div>

        {/* Logic Guide Hub */}
        <div 
          onClick={() => onOpenLogicGuide('all')}
          className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-800/50 hover:border-purple-500/80 cursor-pointer transition-all shadow-md flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-600/50 flex items-center justify-center text-purple-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isRtl ? 'الفهرس الشامل للمعادلات وخوارزميات العمل 💡' : 'Comprehensive Logic & WMS Math Formulas'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl ? 'توثيق شجرة الفرضيات، معادلات العبوات، والتحكيم الرقابي ISA 500 مع حاسبة مباشرة' : 'Explore formulas, packaging math, troubleshooting & interactive sandbox'}
              </p>
            </div>
          </div>
          <ArrowRight className={`w-4 h-4 text-purple-400 flex-shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
        </div>
      </div>
    </div>
  );
};
