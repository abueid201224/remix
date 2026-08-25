import React from 'react';
import { 
  ScanLine, 
  AlertTriangle, 
  Database, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  WifiOff, 
  CheckCircle2,
  Sliders,
  Languages,
  Smartphone,
  UserCheck,
  FileSignature,
  Truck,
  RotateCcw,
  Boxes,
  ListFilter,
  Menu,
  Sparkles,
  ChevronDown,
  Cloud,
  BookOpen,
  HelpCircle,
  Home,
  ShieldCheck
} from 'lucide-react';
import type { SyncMetadata, AppSettings } from '../types';
import { translations } from '../services/i18n';
import type { LogicGuideTab } from './LogicGuideModal';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFINITIONS } from '../types';

export type ActiveNavTab = 'welcome' | 'audit' | 'receiving' | 'returns' | 'inventory' | 'picking' | 'errors' | 'master' | 'settings';

interface NavbarProps {
  currentTab: ActiveNavTab;
  setCurrentTab: (tab: ActiveNavTab) => void;
  syncMeta: SyncMetadata;
  onOpenSyncModal: () => void;
  errorCount: number;
  wrongPickingCount?: number;
  overdueLabCount?: number;
  pendingLabCount?: number;
  settings: AppSettings;
  onToggleSound: () => void;
  onToggleLanguage: () => void;
  isScannerActive: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  onOpenAuditorModal?: () => void;
  onOpenUserModal?: () => void;
  onToggleDrawer?: () => void;
  onOpenApkGuide?: () => void;
  onOpenFirebaseModal?: () => void;
  onOpenLogicGuide?: (tab?: LogicGuideTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  syncMeta,
  onOpenSyncModal,
  errorCount,
  wrongPickingCount = 0,
  overdueLabCount = 0,
  pendingLabCount = 0,
  settings,
  onToggleSound,
  onToggleLanguage,
  isScannerActive,
  canInstallPwa,
  onInstallPwa,
  onOpenAuditorModal,
  onOpenUserModal,
  onToggleDrawer,
  onOpenApkGuide,
  onOpenFirebaseModal,
  onOpenLogicGuide,
}) => {
  const { currentAppUser, roleConfig } = useAuth();
  const t = translations[settings.language] || translations.en;
  const isRtl = settings.language === 'ar';

  const getActiveTabTitle = () => {
    switch (currentTab) {
      case 'welcome': return isRtl ? 'الرئيسية (مرحباً! كيف تريد أن تبدأ؟)' : 'Home Hub';
      case 'receiving': return isRtl ? 'الاستلام والمطابقة' : 'Receiving';
      case 'picking': return isRtl ? 'قائمة الانتقاء والتجهيز' : 'Wave Picking';
      case 'audit': return isRtl ? 'المراجعة والتدقيق والباركود' : 'Dispatch Audit';
      case 'inventory': return isRtl ? 'الجرد وتجميع العبوات' : 'Cycle Count';
      case 'returns': return isRtl ? 'المرتجعات وفحص الجودة' : 'Returns & Lab';
      case 'errors': return isRtl ? 'تقرير الفروقات' : 'Discrepancies';
      case 'master': return isRtl ? 'قاعدة فواتير اليوم' : 'Master Data';
      case 'settings': return isRtl ? 'الأدوات والمحاكي' : 'Tools & Config';
      default: return isRtl ? 'الخدمة النشطة' : 'Active Service';
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* Top Banner with Industrial Branding & Offline Indicators */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Scanner Status */}
        <div className="flex items-center gap-3">
          {/* Vertical Services Drawer Toggle Button */}
          {onToggleDrawer && (
            <button
              onClick={onToggleDrawer}
              id="top-services-drawer-btn"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 shadow-sm transition-all active:scale-95"
              title={isRtl ? 'فتح قائمة الخدمات الرأسية' : 'Open Vertical Services Hub'}
            >
              <Menu className="w-5 h-5" />
              <span className="hidden sm:inline text-xs font-bold text-slate-200">
                {isRtl ? 'الخدمات' : 'Services'}
              </span>
            </button>
          )}

          <div 
            onClick={() => setCurrentTab('welcome')}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 text-white font-bold shadow-inner cursor-pointer hover:bg-emerald-500 transition-colors"
            title={isRtl ? 'العودة للشاشة الرئيسية' : 'Return to Home'}
          >
            <ScanLine className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 
                onClick={() => setCurrentTab('welcome')}
                className="text-base sm:text-lg font-bold tracking-tight text-white cursor-pointer hover:text-emerald-300 transition-colors"
              >
                {t.appTitle}
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded-full">
                <WifiOff className="w-3 h-3" />
                {t.offlineMode}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {isRtl ? 'نظام المستودعات الذكي Offline-First — تدقيق الفواتير والجرد وإدارة الصلاحيات' : 'Offline-First Smart WMS & Barcode Verification'}
            </p>
          </div>
        </div>

        {/* Action Controls & Sync Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Logic & Math Guide Modal Button */}
          {onOpenLogicGuide && (
            <button
              id="navbar-logic-guide-btn"
              onClick={() => onOpenLogicGuide(currentTab === 'welcome' ? 'all' : (currentTab as LogicGuideTab))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-xs font-bold text-purple-300 transition-all shadow-sm active:scale-95"
              title={isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية وطرق بناء الفرضيات' : 'WMS Logic, Math Formulas & Troubleshooting Guide'}
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline">{isRtl ? 'دليل المنطق والمعادلات 💡' : 'Logic & Formulas'}</span>
            </button>
          )}

          {/* Android APK Guide & PDF Download Trigger */}
          {onOpenApkGuide && (
            <button
              onClick={onOpenApkGuide}
              id="navbar-apk-guide-btn"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-950/50 hover:bg-indigo-900/60 text-xs font-bold text-indigo-300 transition-all shadow-sm active:scale-95"
              title={isRtl ? 'دليل تحويل التطبيق لـ APK للأندرويد وتحميل ملف PDF' : 'Android Studio APK Build Guide & PDF Export'}
            >
              <Smartphone className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="hidden sm:inline">{isRtl ? 'تطبيق APK 📱' : 'APK Guide'}</span>
            </button>
          )}

          {/* User Account & Role Trigger Button */}
          <button
            onClick={() => {
              if (onOpenUserModal) onOpenUserModal();
              else if (onOpenAuditorModal) onOpenAuditorModal();
            }}
            id="navbar-user-profile-btn"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-600/50 bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-emerald-300 transition-colors shadow-sm"
            title={isRtl ? 'إدارة المستخدمين والصلاحيات والتبديل السريع' : 'User Account & RBAC Permissions'}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">{currentAppUser?.name || settings.auditorName || 'المستخدم'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border ${roleConfig.color} ${roleConfig.bgLight}`}>
              {isRtl ? roleConfig.labelAr : roleConfig.labelEn}
            </span>
          </button>

          {/* PWA Install Button (When prompt available) */}
          {canInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-md border border-emerald-400/40 animate-bounce"
              title={isRtl ? 'تثبيت التطبيق على جهاز الأندرويد' : 'Install App on Android'}
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">{isRtl ? 'تثبيت التطبيق' : 'Install PWA'}</span>
            </button>
          )}

          {/* Hardware Scanner Pulse indicator */}
          <div 
            title={isScannerActive ? "Hardware Scanner Ready & Connected" : "Listening for Barcode Key-Wedge"}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isScannerActive ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
            <span>{t.scannerReady}</span>
          </div>

          {/* Language Switcher Button (العربية / English) */}
          <button
            onClick={onToggleLanguage}
            title={isRtl ? "Switch to English" : "التحويل للغة العربية"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
          >
            <Languages className="w-4 h-4 text-emerald-400" />
            <span>{isRtl ? 'English' : 'عربي'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={settings.soundEnabled ? "Mute Audible Scan Feedback" : "Enable Audible Scan Feedback"}
            className={`p-2 rounded-lg border transition-colors ${
              settings.soundEnabled 
                ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Firebase Cloud Sync Button */}
          {onOpenFirebaseModal && (
            <button
              id="navbar-firebase-sync-btn"
              onClick={onOpenFirebaseModal}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-95"
              title={isRtl ? 'المزامنة السحابية وقاعدة بيانات Firebase' : 'Firebase Cloud Sync & Auth'}
            >
              <Cloud className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">{isRtl ? 'سحابة Firebase' : 'Cloud Sync'}</span>
            </button>
          )}

          {/* CRITICAL: Daily Excel Update Button */}
          <button
            id="daily-excel-sync-btn"
            onClick={onOpenSyncModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all border border-emerald-500/50"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden xs:inline">{t.updateExcel}</span>
            <span className="xs:hidden">{t.sync}</span>
            {syncMeta.totalInvoices > 0 && (
              <span className="bg-emerald-800 text-emerald-100 text-xs px-1.5 py-0.5 rounded font-mono">
                {syncMeta.totalInvoices}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Service Top Indicator on Mobile/Tablet */}
      {onToggleDrawer && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between">
          <button
            onClick={onToggleDrawer}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-slate-400">{isRtl ? 'الخدمة النشطة للعمل:' : 'Active Workstation:'}</span>
            <span className="text-emerald-300 font-black bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
              {getActiveTabTitle()}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <div className="flex items-center gap-1.5">
            {onOpenLogicGuide && (
              <button
                onClick={() => onOpenLogicGuide(currentTab === 'welcome' ? 'all' : (currentTab as LogicGuideTab))}
                className="text-[11px] text-purple-300 hover:text-purple-200 font-bold flex items-center gap-1 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40 transition-all"
                title={isRtl ? 'فتح دليل المنطق والمعادلات والحلول لهذه الخدمة' : 'Open Logic & Formula Guide for this service'}
              >
                <BookOpen className="w-3 h-3 text-purple-400" />
                <span className="hidden xs:inline">{isRtl ? 'المنطق والمعادلات' : 'Logic Guide'}</span>
              </button>
            )}

            <button
              onClick={onToggleDrawer}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{isRtl ? 'قائمة الخدمات' : 'Services Menu'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="bg-slate-950/90 border-t border-slate-800/80 px-2 sm:px-4 hidden sm:block">
        <nav className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-1.5 scrollbar-none">
          {/* 0. Welcome / Home Screen */}
          <button
            id="nav-welcome-tab"
            onClick={() => setCurrentTab('welcome')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'welcome'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>{isRtl ? 'الرئيسية' : 'Home'}</span>
          </button>

          {/* 1. Inbound Receiving */}
          <button
            id="nav-receiving-tab"
            onClick={() => setCurrentTab('receiving')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'receiving'
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4 text-blue-300" />
            <span>{t.receivingTab || (isRtl ? 'الاستلام' : 'Receiving')}</span>
          </button>

          {/* 2. Dispatch / Invoice Auditor */}
          <button
            id="nav-audit-tab"
            onClick={() => setCurrentTab('audit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'audit'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ScanLine className="w-4 h-4 text-emerald-300" />
            <span>{t.activeAudit}</span>
          </button>

          {/* 3. Returns & Refunds (RMA) & Quality Lab */}
          <button
            id="nav-returns-tab"
            onClick={() => setCurrentTab('returns')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'returns'
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-300" />
            <span>{t.returnsTab || (isRtl ? 'المرتجعات والفحص' : 'Returns & Lab')}</span>
            {pendingLabCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                overdueLabCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingLabCount} {overdueLabCount > 0 ? '⚠️' : ''}
              </span>
            )}
          </button>

          {/* 4. Cycle Count & Packaging Breakdown */}
          <button
            id="nav-inventory-tab"
            onClick={() => setCurrentTab('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'inventory'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4 text-indigo-300" />
            <span>{t.inventoryTab || (isRtl ? 'الجرد وتجميع العبوات' : 'Inventory')}</span>
          </button>

          {/* 5. Batch Wave Picking List Generator */}
          <button
            id="nav-picking-tab"
            onClick={() => setCurrentTab('picking')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              currentTab === 'picking'
                ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ListFilter className="w-4 h-4 text-cyan-300" />
            <span>{isRtl ? 'قائمة الانتقاء والتجهيز' : 'Picking List'}</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Discrepancies Report */}
          <button
            id="nav-errors-tab"
            onClick={() => setCurrentTab('errors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              currentTab === 'errors'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t.errorReport}</span>
            {errorCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                currentTab === 'errors' ? 'bg-red-950 text-red-200' : 'bg-red-500 text-white'
              }`}>
                {errorCount}
              </span>
            )}
          </button>

          {/* Master Invoices Database */}
          <button
            id="nav-master-tab"
            onClick={() => setCurrentTab('master')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              currentTab === 'master'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{t.masterInvoices}</span>
          </button>

          {/* Tools & Config */}
          <button
            id="nav-settings-tab"
            onClick={() => setCurrentTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${isRtl ? 'mr-auto' : 'ml-auto'} ${
              currentTab === 'settings'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.tools}</span>
          </button>
        </nav>
      </div>

      {/* Sync Status Banner */}
      {syncMeta.lastSyncDate && (
        <div className="bg-slate-800/60 border-t border-slate-700/50 px-4 py-1 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {isRtl ? 'قاعدة بيانات اليوم:' : 'Daily Master Data:'} <strong className="text-slate-200">{syncMeta.fileName || 'Active Dataset'}</strong> ({syncMeta.totalInvoices} {isRtl ? 'فواتير' : 'Invoices'}, {syncMeta.totalItems} {isRtl ? 'صنف' : 'Items'})
            </span>
          </div>
          <span className="hidden sm:inline">
            {isRtl ? 'توقيت المزامنة:' : 'Synced:'} {new Date(syncMeta.lastSyncDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </header>
  );
};



