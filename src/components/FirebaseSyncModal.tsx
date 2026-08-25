import React, { useState } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  User, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Database,
  UploadCloud,
  DownloadCloud
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  getAllReturnReports, 
  getAllAuditDiscrepancies, 
  getAppSettings,
  saveReturnReport,
  saveAppSettings 
} from '../services/db';
import { 
  syncReturnReportToCloud, 
  fetchReturnReportsFromCloud, 
  syncUserSettingsToCloud 
} from '../services/firebase';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl?: boolean;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  isRtl = true,
}) => {
  const { currentUser, isLoading, isCloudConnected, login, logout } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBackupToCloud = async () => {
    if (!currentUser) {
      setSyncError(isRtl ? 'يرجى تسجيل الدخول بحساب Google أولاً للمزامنة مع السحابة' : 'Please sign in with Google first');
      return;
    }
    setIsSyncing(true);
    setSyncStatusMsg(null);
    setSyncError(null);
    try {
      const [reports, discrepancies, settings] = await Promise.all([
        getAllReturnReports(),
        getAllAuditDiscrepancies(),
        getAppSettings(),
      ]);

      // Upload Return Reports
      for (const rep of reports) {
        await syncReturnReportToCloud(rep);
      }

      // Upload Settings
      await syncUserSettingsToCloud(settings);

      setSyncStatusMsg(
        isRtl 
          ? `تم رفع وحفظ ${reports.length} تقرير مرتجع وإعدادات النظام إلى قاعدة بيانات Firebase السحابية بنجاح!`
          : `Successfully backed up ${reports.length} reports and settings to Firebase Cloud!`
      );
    } catch (err: any) {
      console.error('Cloud Backup error:', err);
      setSyncError(err.message || 'فشلت عملية المزامنة السحابية');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!currentUser) {
      setSyncError(isRtl ? 'يرجى تسجيل الدخول بحساب Google أولاً لاستيراد البيانات' : 'Please sign in with Google first');
      return;
    }
    setIsSyncing(true);
    setSyncStatusMsg(null);
    setSyncError(null);
    try {
      const cloudReports = await fetchReturnReportsFromCloud();
      let importedCount = 0;
      for (const rep of cloudReports) {
        await saveReturnReport(rep);
        importedCount++;
      }
      setSyncStatusMsg(
        isRtl
          ? `تم استيراد وتحديث ${importedCount} تقرير من سحابة Firebase إلى قاعدة البيانات المحلية بنجاح!`
          : `Successfully restored ${importedCount} reports from Firebase Cloud to local database!`
      );
    } catch (err: any) {
      console.error('Cloud Restore error:', err);
      setSyncError(err.message || 'فشلت عملية الاستيراد من السحابة');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isRtl ? 'المزامنة السحابية (Firebase Cloud Sync)' : 'Firebase Cloud Sync'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl ? 'مزامنة آمنة للتقارير والبيانات عبر أجهزة المستودع' : 'Secure real-time sync across warehouse devices'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Cloud Status Card */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isCloudConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {isCloudConnected ? <CloudCheck className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs text-slate-400">{isRtl ? 'حالة الاتصال بالسحابة' : 'Cloud Status'}</p>
                <p className="text-sm font-semibold text-slate-200">
                  {isCloudConnected 
                    ? (isRtl ? 'متصل بقاعدة Firestore السحابية' : 'Connected to Firestore Cloud') 
                    : (isRtl ? 'وضع عدم الاتصال (Offline First)' : 'Offline First Mode')}
                </p>
              </div>
            </div>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-mono font-medium ${isCloudConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'}`}>
              europe-west2
            </span>
          </div>

          {/* User Account / Auth Section */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {isRtl ? 'حساب المراجع / مدير المستودع' : 'Auditor & Account Auth'}
            </p>
            {currentUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || ''} 
                      className="w-10 h-10 rounded-full border border-amber-400/40"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-100">{currentUser.displayName || currentUser.email}</p>
                    <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'تسجيل خروج' : 'Sign Out'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isRtl ? 'سجل الدخول بحساب Google لمزامنة التقارير تلقائياً' : 'Sign in with Google to enable cloud synchronization'}
                </p>
                <button
                  onClick={login}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-950/40 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isRtl ? 'تسجيل الدخول مع Google' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Sync Operations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleBackupToCloud}
              disabled={isSyncing || !currentUser}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                currentUser && !isSyncing
                  ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300 border-emerald-500/30 shadow-sm cursor-pointer'
                  : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              <span>{isRtl ? 'رفع النسخة الاحتياطية للسحابة' : 'Backup to Cloud'}</span>
            </button>

            <button
              onClick={handleRestoreFromCloud}
              disabled={isSyncing || !currentUser}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                currentUser && !isSyncing
                  ? 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border-blue-500/30 shadow-sm cursor-pointer'
                  : 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
              }`}
            >
              <DownloadCloud className={`w-4 h-4 ${isSyncing ? 'animate-pulse' : ''}`} />
              <span>{isRtl ? 'استيراد البيانات من السحابة' : 'Restore from Cloud'}</span>
            </button>
          </div>

          {/* Status / Feedback messages */}
          {syncStatusMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {syncError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{syncError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>{isRtl ? 'مشفر ومحمي عبر قواعد Firestore ABAC' : 'Encrypted with Firestore ABAC Rules'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
