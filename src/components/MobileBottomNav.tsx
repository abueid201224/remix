import React from 'react';
import { 
  ScanLine, 
  Menu, 
  RefreshCw, 
  AlertTriangle, 
  Truck, 
  Boxes, 
  RotateCcw, 
  ListFilter,
  Sliders,
  Layers,
  Smartphone,
  Home
} from 'lucide-react';
import type { ActiveNavTab } from './Navbar';

interface MobileBottomNavProps {
  currentTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  onToggleDrawer: () => void;
  onOpenSyncModal: () => void;
  errorCount: number;
  isRtl: boolean;
  onOpenApkGuide: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onToggleDrawer,
  onOpenSyncModal,
  errorCount,
  isRtl,
  onOpenApkGuide
}) => {
  return (
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 shadow-2xl flex items-center justify-around"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
    >
      {/* 1. Home / Welcome Screen Button */}
      <button
        onClick={() => onSelectTab('welcome')}
        id="mobile-home-btn"
        className={`flex flex-col items-center justify-center p-1.5 min-w-[52px] rounded-xl transition-colors ${
          currentTab === 'welcome' ? 'text-emerald-400 font-bold bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
        }`}
        title={isRtl ? 'الرئيسية' : 'Home'}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] mt-1">{isRtl ? 'الرئيسية' : 'Home'}</span>
      </button>

      {/* 2. All Services Hub Drawer Button */}
      <button
        onClick={onToggleDrawer}
        id="mobile-services-hub-btn"
        className="flex flex-col items-center justify-center p-1.5 min-w-[52px] rounded-xl text-emerald-400 hover:bg-slate-800 transition-colors"
        title={isRtl ? 'قائمة الخدمات والعمليات' : 'Services Hub'}
      >
        <div className="relative p-1 rounded-lg bg-emerald-950/80 border border-emerald-700/60 shadow-sm">
          <Menu className="w-5 h-5 text-emerald-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <span className="text-[10px] font-bold mt-1 text-slate-200">
          {isRtl ? 'الخدمات' : 'Services'}
        </span>
      </button>

      {/* 3. Primary Center Workstation Button (Active Audit Scanner) */}
      <button
        onClick={() => onSelectTab('audit')}
        className={`flex flex-col items-center justify-center -mt-4 p-2.5 rounded-2xl shadow-xl transition-transform active:scale-95 ${
          currentTab === 'audit'
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-950 shadow-emerald-900/50'
            : 'bg-slate-800 text-emerald-400 border border-slate-700'
        }`}
        title={isRtl ? 'مدقق الباركود' : 'Barcode Auditor'}
      >
        <ScanLine className="w-6 h-6 animate-pulse" />
        <span className="text-[9px] font-black mt-0.5">{isRtl ? 'التدقيق' : 'Audit'}</span>
      </button>

      {/* 4. Discrepancies Alerts */}
      <button
        onClick={() => onSelectTab('errors')}
        className={`flex flex-col items-center justify-center p-1.5 min-w-[52px] rounded-xl transition-colors relative ${
          currentTab === 'errors' ? 'text-red-400 font-bold bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <AlertTriangle className="w-5 h-5" />
          {errorCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
              {errorCount > 9 ? '9+' : errorCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-1">{isRtl ? 'الفروقات' : 'Alerts'}</span>
      </button>

      {/* 5. Android APK Guide Quick Trigger */}
      <button
        onClick={onOpenApkGuide}
        className="flex flex-col items-center justify-center p-1.5 min-w-[52px] rounded-xl text-indigo-400 hover:bg-slate-800 transition-colors"
        title={isRtl ? 'دليل APK للأندرويد' : 'APK Guide'}
      >
        <Smartphone className="w-5 h-5" />
        <span className="text-[10px] mt-1 text-slate-300">APK 📱</span>
      </button>
    </div>
  );
};

