import React from 'react';
import { 
  Truck, 
  ListFilter, 
  ScanLine, 
  Boxes, 
  RotateCcw, 
  AlertTriangle, 
  Database, 
  Sliders, 
  Smartphone, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  X,
  Sparkles,
  Radio,
  FileSignature,
  BookOpen,
  Home,
  UserCheck,
  ShieldCheck,
  Zap,
  Lock
} from 'lucide-react';
import type { ActiveNavTab } from './Navbar';
import type { AppSettings, SyncMetadata, ActiveInvoiceSession } from '../types';
import type { LogicGuideTab } from './LogicGuideModal';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFINITIONS } from '../types';

interface ServiceItem {
  id: ActiveNavTab | 'welcome' | 'apk-guide' | 'logic-guide';
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  badge?: string | number | null;
  badgeColor?: string;
  category: 'core' | 'reports' | 'system';
}

interface VerticalServicesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: ActiveNavTab | 'welcome' | null;
  onSelectTab: (tab: ActiveNavTab | 'welcome') => void;
  settings: AppSettings;
  syncMeta: SyncMetadata;
  errorCount: number;
  wrongPickingCount?: number;
  pendingLabCount?: number;
  overdueLabCount?: number;
  activeSession: ActiveInvoiceSession | null;
  onOpenApkGuide: () => void;
  onOpenSyncModal: () => void;
  onOpenAuditorModal: () => void;
  onOpenFirebaseModal?: () => void;
  onOpenLogicGuide?: (tab?: LogicGuideTab) => void;
  onOpenUserModal?: () => void;
}

export const VerticalServicesDrawer: React.FC<VerticalServicesDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  settings,
  syncMeta,
  errorCount,
  wrongPickingCount = 0,
  pendingLabCount = 0,
  overdueLabCount = 0,
  activeSession,
  onOpenApkGuide,
  onOpenSyncModal,
  onOpenAuditorModal,
  onOpenFirebaseModal,
  onOpenLogicGuide,
  onOpenUserModal,
}) => {
  const { currentAppUser, activeRole, roleConfig } = useAuth();

  if (!isOpen) return null;

  const isRtl = settings?.language === 'ar' || !settings || settings?.language === undefined;

  const allServices: ServiceItem[] = [
    // 0. Welcome / Home Screen
    {
      id: 'welcome',
      titleAr: 'الرئيسية (مرحباً! كيف تريد أن تبدأ؟)',
      titleEn: 'Home (Welcome & Operation Hub)',
      subtitleAr: 'لوحة الترحيب واختيار الخدمات المستودعية السريعة',
      subtitleEn: 'Quick operational dashboard & service launcher',
      icon: Home,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-700/50',
      category: 'core'
    },
    // 1. Outbound Audit
    {
      id: 'audit',
      titleAr: 'المراجعة والتدقيق والباركود (Dispatch Audit)',
      titleEn: 'Outbound Dispatch Barcode Audit',
      subtitleAr: 'المسح العشوائي السريع للفواتير واكتشاف الأصناف الخاطئة والناقصة',
      subtitleEn: 'Random 1D barcode scan & wrong picking prevention',
      icon: ScanLine,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40',
      borderColor: 'border-emerald-700/50',
      badge: activeSession ? (isRtl ? `فاتورة: ${activeSession.invoiceNo}` : `Inv: ${activeSession.invoiceNo}`) : null,
      badgeColor: 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/50',
      category: 'core'
    },
    // 2. Inbound Receiving
    {
      id: 'receiving',
      titleAr: 'الاستلام والمطابقة (Inbound Receiving)',
      titleEn: 'Inbound Receiving & Matching',
      subtitleAr: 'فحص الشحنات الواردة ومطابقة الكميات وأوامر الشراء',
      subtitleEn: 'Match received consignments against purchase orders',
      icon: Truck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-950/40',
      borderColor: 'border-blue-700/50',
      category: 'core'
    },
    // 3. Wave Picking
    {
      id: 'picking',
      titleAr: 'قوائم الانتقاء والتجهيز (Wave Picking)',
      titleEn: 'Batch Wave Picking & Preparation',
      subtitleAr: 'تجميع الفواتير وتفكيك العبوات وإسناد المهام للعمال حسب الخبرة',
      subtitleEn: 'Batch invoice clustering & skill-based task delegation',
      icon: ListFilter,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40',
      borderColor: 'border-cyan-700/50',
      category: 'core'
    },
    // 4. Inventory & Cycle Count
    {
      id: 'inventory',
      titleAr: 'الجرد وتجميع العبوات (Cycle Count)',
      titleEn: 'Cycle Count & Packaging Breakdown',
      subtitleAr: 'الجرد الدوري بالموقع وحساب تفكيك الكراتين والباكتات والحبات',
      subtitleEn: 'Location-based counting & carton/pack breakdown',
      icon: Boxes,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-950/40',
      borderColor: 'border-indigo-700/50',
      category: 'core'
    },
    // 5. Returns & Lab
    {
      id: 'returns',
      titleAr: 'المرتجعات وفحص الجودة (Returns & Lab)',
      titleEn: 'Returns (RMA) & Quality Lab Inspection',
      subtitleAr: 'استلام المرتجعات وتحليل PDF وفحص الأصناف المخبرية',
      subtitleEn: 'Smart PDF return parsing & lab release tracking',
      icon: RotateCcw,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/40',
      borderColor: 'border-amber-700/50',
      badge: pendingLabCount > 0 ? (isRtl ? `${pendingLabCount} فحص معلق` : `${pendingLabCount} Pending`) : null,
      badgeColor: overdueLabCount > 0 ? 'bg-red-950 text-red-300 border border-red-700 animate-pulse' : 'bg-amber-950 text-amber-300 border border-amber-700',
      category: 'core'
    },
    // 6. Errors & Discrepancies
    {
      id: 'errors',
      titleAr: 'تقرير الفروقات والتنبيهات (Discrepancies)',
      titleEn: 'Discrepancy & Error Reports',
      subtitleAr: 'سجل الفروقات والزيادات والأصناف المستبعدة الخاطئة',
      subtitleEn: 'Logged variances, shortages & discarded items',
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-950/40',
      borderColor: 'border-red-700/50',
      badge: errorCount > 0 ? (isRtl ? `${errorCount} تنبيه` : `${errorCount} Alerts`) : null,
      badgeColor: 'bg-red-950 text-red-300 border border-red-700',
      category: 'reports'
    },
    // 7. Master Database
    {
      id: 'master',
      titleAr: 'قاعدة فواتير اليوم (Master Database)',
      titleEn: 'Daily Master Invoices Database',
      subtitleAr: 'استعراض أصناف وفواتير اليوم وتحديث الإكسيل اليومي',
      subtitleEn: 'Browse daily datasets & master invoice search',
      icon: Database,
      color: 'text-slate-300',
      bgColor: 'bg-slate-900/60',
      borderColor: 'border-slate-700/60',
      badge: syncMeta.totalInvoices > 0 ? (isRtl ? `${syncMeta.totalInvoices} فاتورة` : `${syncMeta.totalInvoices} Invoices`) : null,
      badgeColor: 'bg-slate-800 text-slate-300 border border-slate-700',
      category: 'reports'
    },
    // 8. Tools & Scanner
    {
      id: 'settings',
      titleAr: 'أدوات ومحاكي الباركود (Tools & Config)',
      titleEn: 'Scanner Simulator & System Config',
      subtitleAr: 'محاكي المسح وضبط هوية وتوقيع المراجع واللغة',
      subtitleEn: 'Hardware barcode simulator & auditor profile',
      icon: Sliders,
      color: 'text-slate-400',
      bgColor: 'bg-slate-900/60',
      borderColor: 'border-slate-700/60',
      category: 'system'
    },
    // 9. Android APK Guide
    {
      id: 'apk-guide',
      titleAr: 'دليل تحويل التطبيق لـ APK أندرويد (APK Guide & PDF)',
      titleEn: 'Android Studio APK Build Guide & PDF Export',
      subtitleAr: 'خطوات تحويل المنظومة إلى تطبيق أندرويد وتوليد ملف PDF شامل',
      subtitleEn: 'Step-by-step Android Studio compilation guide & PDF manual',
      icon: Smartphone,
      color: 'text-emerald-300',
      bgColor: 'bg-gradient-to-r from-emerald-950/60 to-indigo-950/60',
      borderColor: 'border-emerald-500/60',
      badge: isRtl ? 'تحميل PDF 📄' : 'Download PDF',
      badgeColor: 'bg-emerald-800 text-emerald-100 font-bold',
      category: 'system'
    }
  ];

  // Separate active service from inactive services so Active is ALWAYS ON TOP!
  const effectiveTab = currentTab || 'welcome';
  const activeServiceItem = allServices.find(s => s.id === effectiveTab) || allServices[0];
  const otherServices = allServices.filter(s => s.id !== effectiveTab);

  const handleSelect = (serviceId: ActiveNavTab | 'welcome' | 'apk-guide' | 'logic-guide') => {
    if (serviceId === 'apk-guide') {
      onOpenApkGuide();
    } else if (serviceId === 'logic-guide') {
      if (onOpenLogicGuide) onOpenLogicGuide('all');
    } else {
      onSelectTab(serviceId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Vertical Drawer Container */}
      <div 
        className={`relative z-50 w-full max-w-md bg-slate-900 border-x border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden ${
          isRtl ? 'mr-auto' : 'ml-auto'
        }`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-slate-950 to-indigo-950/80 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isRtl ? 'قائمة الخدمات والعمليات الرأسية' : 'Warehouse Services Hub'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl ? 'الخدمة النشطة للعمل تتصدر القائمة تلقائياً' : 'Active working workstation is prioritized at the top'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account & Role Profile Strip */}
        <div className="bg-slate-950/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 font-bold">{currentAppUser?.name || settings.auditorName || 'أحمد حمادة'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${roleConfig.color} ${roleConfig.bgLight}`}>
              {isRtl ? roleConfig.labelAr : roleConfig.labelEn}
            </span>
          </div>

          <button
            onClick={() => {
              if (onOpenUserModal) onOpenUserModal();
              else onOpenAuditorModal();
              onClose();
            }}
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 text-[11px] bg-emerald-950/60 hover:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-700/50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isRtl ? 'تبديل المستخدم' : 'Switch User'}</span>
          </button>
        </div>

        {/* Services List with Active Item at the Top */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-4">
          
          {/* 🌟 1. PROMINENT ACTIVE SERVICE (ALWAYS AT THE VERY TOP) 🌟 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                {isRtl ? 'الخدمة النشطة الحالية (Active Service)' : 'Currently Active Service'}
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-bold">
                {effectiveTab === 'welcome' 
                  ? (isRtl ? 'الشاشة الرئيسية' : 'Home Hub') 
                  : (isRtl ? 'قيد العمل الآن' : 'In Progress')}
              </span>
            </div>

            <div 
              className={`p-4 rounded-2xl border-2 ${activeServiceItem.borderColor} ${activeServiceItem.bgColor} shadow-xl relative overflow-hidden ring-2 ring-emerald-500/20`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/90 text-emerald-400 shadow-md border border-slate-700">
                    <activeServiceItem.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      {isRtl ? activeServiceItem.titleAr : activeServiceItem.titleEn}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isRtl ? activeServiceItem.subtitleAr : activeServiceItem.subtitleEn}
                    </p>

                    {activeServiceItem.badge && (
                      <div className="mt-2 inline-block">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${activeServiceItem.badgeColor}`}>
                          {activeServiceItem.badge}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Quick Action Button */}
              <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-emerald-300 font-bold">
                  {effectiveTab === 'welcome' 
                    ? (isRtl ? 'أنت في الشاشة الرئيسية' : 'You are in Home Hub')
                    : (isRtl ? 'أنت تعمل على هذه الخدمة حالياً' : 'You are currently working here')}
                </span>
                <button
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <span>{isRtl ? 'متابعة العمل' : 'Resume Work'}</span>
                  {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* 📋 2. REMAINING SERVICES (ORGANIZED VERTICALLY) */}
          <div className="space-y-2 pt-2">
            <div className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
              {isRtl ? 'الخدمات والعمليات المتاحة للتبديل' : 'Available Warehouse Services'}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {otherServices.map((service) => {
                const IconComponent = service.icon;
                return (
                  <button
                    key={service.id}
                    onClick={() => handleSelect(service.id)}
                    className="w-full text-start p-3.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all shadow-sm flex items-center justify-between gap-3 group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700 transition-colors ${service.color}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {isRtl ? service.titleAr : service.titleEn}
                          </h4>
                          {service.badge && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${service.badgeColor}`}>
                              {service.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {isRtl ? service.subtitleAr : service.subtitleEn}
                        </p>
                      </div>
                    </div>

                    <div className="text-slate-500 group-hover:text-white transition-colors shrink-0">
                      {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Bottom Actions */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex flex-col gap-2">
          {onOpenLogicGuide && (
            <button
              onClick={() => {
                onOpenLogicGuide('all');
                onClose();
              }}
              className="w-full py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl text-xs font-bold border border-purple-700/40 flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>{isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية 💡' : 'Logic & Math Formulas Guide'}</span>
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            {onOpenFirebaseModal && (
              <button
                onClick={() => {
                  onOpenFirebaseModal();
                  onClose();
                }}
                className="w-full sm:flex-1 py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-xl text-xs font-bold border border-amber-700/40 flex items-center justify-center gap-2 transition-all"
              >
                <span>{isRtl ? 'سحابة Firebase' : 'Firebase Cloud'}</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenSyncModal();
                onClose();
              }}
              className="w-full sm:flex-1 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-700/40 flex items-center justify-center gap-2 transition-all"
            >
              <span>{isRtl ? 'مزامنة إكسيل اليوم' : 'Daily Excel Sync'}</span>
            </button>

            <button
              onClick={() => {
                onOpenApkGuide();
                onClose();
              }}
              className="w-full sm:flex-1 py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-bold border border-indigo-700/40 flex items-center justify-center gap-2 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isRtl ? 'دليل APK للأندرويد' : 'APK Guide'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

