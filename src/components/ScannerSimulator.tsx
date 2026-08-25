import React from 'react';
import { 
  ScanLine, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Sliders, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  FileSignature,
  ShieldCheck,
  Download,
  Check,
  Radio,
  WifiOff,
  Cpu,
  Layers,
  ArrowDownToLine,
  ExternalLink
} from 'lucide-react';
import { SoundEffects } from '../services/audio';
import type { AppSettings, MasterInvoiceItem } from '../types';

interface ScannerSimulatorProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onSimulateScan: (barcode: string) => void;
  activeInvoiceNo: string | null;
  masterItems: MasterInvoiceItem[];
  onOpenAuditorModal?: () => void;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export const ScannerSimulator: React.FC<ScannerSimulatorProps> = ({
  settings,
  onUpdateSettings,
  onSimulateScan,
  activeInvoiceNo,
  masterItems,
  onOpenAuditorModal,
  canInstallPwa,
  onInstallPwa,
}) => {
  const isRtl = settings.language === 'ar';

  // Extract unique invoices & sample items for simulation
  const uniqueInvoices = Array.from(new Set(masterItems.map(i => i.invoiceNo)));
  const currentInvoiceItems = masterItems.filter(i => i.invoiceNo === activeInvoiceNo);
  const otherInvoiceItems = masterItems.filter(i => i.invoiceNo !== activeInvoiceNo);

  const testAudio = (type: 'match' | 'exact' | 'mismatch' | 'surplus' | 'invoice' | 'long') => {
    if (type === 'match') SoundEffects.playScanMatch(settings.soundVolume);
    if (type === 'exact') SoundEffects.playExactComplete(settings.soundVolume);
    if (type === 'mismatch') SoundEffects.playMismatchWarning(settings.soundVolume);
    if (type === 'surplus') SoundEffects.playSurplusAlert(settings.soundVolume);
    if (type === 'invoice') SoundEffects.playInvoiceLock(settings.soundVolume);
    if (type === 'long') SoundEffects.playLongBarcodeAlert(settings.soundVolume);
  };

  return (
    <div className="space-y-4">
      {/* 0. Lead Auditor Profile & Stamp Seal (ISA 500 Compliance) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{isRtl ? 'بيانات واعتماد المراجع المسؤول (ISA 500)' : 'Lead Auditor & Digital Seal Profile'}</span>
                <span className="text-xs bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700 font-mono font-bold">
                  Verified
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'هوية المراجع ورقمه الوظيفي والختم الرقمي المعتمد لتقارير الجرد وتصدير PDF/Excel' 
                  : 'Auditor identity, credentials, and digital seal for audit reports and official PDF/Excel exports'}
              </p>
            </div>
          </div>

          {onOpenAuditorModal && (
            <button
              onClick={onOpenAuditorModal}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow"
            >
              <FileSignature className="w-4 h-4" />
              <span>{isRtl ? 'تعديل التوقيع والبيانات' : 'Edit Profile & Signature'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">{isRtl ? 'اسم المراجع' : 'Auditor Name'}</span>
            <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>{settings.auditorName || 'أحمد حمادة'}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">{isRtl ? 'الرقم الوظيفي / الكود الرقابي' : 'Auditor ID / Badge'}</span>
            <div className="text-sm font-bold text-emerald-300 font-mono">
              {settings.auditorId || 'AUD-101'}
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block mb-1">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</span>
            <div className="text-xs font-semibold text-slate-300">
              {settings.auditorTitle || (isRtl ? 'مراجع ومراقب مخزون معتمد' : 'Certified Inventory Auditor')}
            </div>
          </div>
        </div>

        {settings.auditorSignature && settings.auditorSignature.startsWith('data:image/') && (
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">{isRtl ? 'الختم / التوقيع الرقمي المسجل:' : 'Active Signature / Stamp:'}</span>
              <span className="text-[11px] text-emerald-400 font-mono">(100% Offline IndexedDB)</span>
            </div>
            <img 
              src={settings.auditorSignature} 
              alt="Auditor Signature" 
              className="h-10 max-w-[140px] object-contain rounded bg-slate-900 px-2 py-0.5 border border-slate-800"
            />
          </div>
        )}
      </div>

      {/* 1. Barcode Simulator Panel (For quick testing without hardware) */}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Handheld Barcode Simulator</h2>
            <p className="text-xs text-slate-400">
              Tap any barcode below to simulate 1D scanner laser events instantly
            </p>
          </div>
        </div>

        {/* Section A: Invoices */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Step A: Simulate Scanning Invoice Barcodes:</span>
            {activeInvoiceNo && (
              <span className="text-emerald-400 font-mono">Active: {activeInvoiceNo}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {uniqueInvoices.length > 0 ? (
              uniqueInvoices.map((inv) => (
                <button
                  key={inv}
                  onClick={() => onSimulateScan(inv)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all border ${
                    inv === activeInvoiceNo
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-emerald-500 hover:text-white'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>{inv}</span>
                </button>
              ))
            ) : (
              <div className="text-xs text-slate-500">No master invoices loaded.</div>
            )}
          </div>
        </div>

        {/* Section B: Matching Items */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-slate-300">
            Step B: Simulate Scanning Items for Active Invoice ({activeInvoiceNo || 'None Locked'}):
          </div>
          {currentInvoiceItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {currentInvoiceItems.map((item) => (
                <button
                  key={item.itemCode}
                  onClick={() => onSimulateScan(item.itemCode)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/80 transition-all text-left group"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                      {item.itemCode}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {item.itemName}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                    Req: {item.requiredQty}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-950/60 rounded-lg text-xs text-slate-400 border border-slate-800">
              Scan or lock an invoice first to see matching items for quick testing.
            </div>
          )}
        </div>

        {/* Section C: Mismatch / Unknown Items */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Simulate Mismatch Scans (Items that do NOT belong to active invoice):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSimulateScan('SKU-MISMATCH-999')}
              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800 rounded-lg text-xs font-mono font-bold transition-colors"
            >
              Scan [SKU-MISMATCH-999] (Foreign Item)
            </button>

            {otherInvoiceItems.slice(0, 2).map((item) => (
              <button
                key={item.itemCode}
                onClick={() => onSimulateScan(item.itemCode)}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/60 rounded-lg text-xs font-mono font-bold transition-colors"
              >
                Scan [{item.itemCode}] (From {item.invoiceNo})
              </button>
            ))}
          </div>
        </div>

        {/* Section D: Long Barcode (> 10 digits) Simulation */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate Long Barcode Scans (&gt; {settings.longBarcodeThreshold || 10} digits):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSimulateScan('62212345678901')}
              className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-700/80 rounded-lg text-xs font-mono font-bold transition-colors"
            >
              Scan [62212345678901] (14 Digits - EAN/GTIN)
            </button>
            <button
              onClick={() => onSimulateScan('998877665544')}
              className="px-3 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-mono font-bold transition-colors"
            >
              Scan [998877665544] (12 Digits)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Android App Installation & Industrial PDA Terminal Hub */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 sm:p-5 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {isRtl ? 'تطبيق الأندرويد وأجهزة الجرد المحمولة (Android App & PDA)' : 'Android Application & Warehouse PDA Hub'}
                </h2>
                <span className="text-[11px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-600 font-bold">
                  PWA / APK Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'يعمل كتطبيق أندرويد مستقل (Standalone App) كامل الصلاحيات دون إنترنت 100% مع قارئات الباركود والكاميرا' 
                  : 'Runs as a full standalone Android app offline with hardware barcode scanners & camera'}
              </p>
            </div>
          </div>

          {canInstallPwa && onInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-900/40 transition-all transform active:scale-95 animate-pulse"
            >
              <Download className="w-4 h-4" />
              <span>{isRtl ? 'تثبيت التطبيق على الأندرويد الآن' : 'Install on Android Now'}</span>
            </button>
          )}
        </div>

        {/* 3 Step Android Installation Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-950/90 border border-slate-800/90 p-3.5 rounded-xl space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center justify-center text-[10px]">1</span>
              <span>{isRtl ? 'فتح في متصفح Chrome أو Samsung' : 'Open in Chrome / Samsung Browser'}</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isRtl 
                ? 'افتح رابط التطبيق في متصفح جوجل كروم على هاتفك الأندرويد أو جهاز الجرد PDA.' 
                : 'Open the app URL in Google Chrome or Samsung Internet on your Android device.'}
            </p>
          </div>

          <div className="bg-slate-950/90 border border-slate-800/90 p-3.5 rounded-xl space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center justify-center text-[10px]">2</span>
              <span>{isRtl ? 'إضافة إلى الشاشة الرئيسية (تثبيت)' : 'Tap "Install App" or "Add to Home"'}</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isRtl 
                ? 'اضغط على زر القائمة (⋮) أعلى المتصفح، ثم اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".' 
                : 'Tap browser menu (⋮) and select "Install App" or "Add to Home screen".'}
            </p>
          </div>

          <div className="bg-slate-950/90 border border-slate-800/90 p-3.5 rounded-xl space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center justify-center text-[10px]">3</span>
              <span>{isRtl ? 'تطبيق كامل بدون شريط المتصفح' : 'Full Screen Native Experience'}</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isRtl 
                ? 'سيظهر أيقونة التطبيق في شاشة تطبيقات هاتفك، ويعمل بملء الشاشة مع سرعة استجابة فائقة وحفظ تلقائي.' 
                : 'The app icon appears on your home screen and launches in full-screen standalone mode.'}
            </p>
          </div>
        </div>

        {/* Industrial PDA (Zebra, Honeywell, Sunmi, Urovo) Configuration Guide */}
        <div className="bg-slate-950/70 border border-emerald-900/40 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>{isRtl ? 'إعدادات أجهزة الجرد الاحترافية والمستودعات (Zebra / Honeywell / Sunmi / Datalogic / Urovo):' : 'Industrial Warehouse PDA Scanner Settings:'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRtl ? '1. وضع إخراج لوحة المفاتيح (Keystroke / HID Output)' : '1. Keystroke Output Mode'}</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {isRtl 
                  ? 'في تطبيق الماسح المدمج (مثل Zebra DataWedge أو Honeywell ScanSettings)، تأكد من تفعيل وضع إرسال الباركود كـ (Keystroke / Keyboard Wedge).' 
                  : 'In DataWedge or Scanner Settings, ensure Keystroke Output is enabled to send scans as keyboard events.'}
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRtl ? '2. لاحقة الإرسال السريع (Enter / Carriage Return Suffix)' : '2. Enter Key Suffix (CR)'}</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                {isRtl 
                  ? 'اضبط لاحقة الإرسال (Basic Data Formatting -> Send ENTER key) ليتم تسجيل كل مسح فورياً دون لمس الشاشة.' 
                  : 'Set suffix to [ENTER] (Carriage Return) so every scan processes instantly with automatic line increment.'}
              </p>
            </div>
          </div>
        </div>

        {/* APK Generation / Packaging info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              {isRtl 
                ? 'ترغب في ملف حزمة أندرويد (.APK) رسمي للتثبيت المباشر أو التوزيع الداخلي؟ التطبيق متوافق مع PWABuilder و TWA و Capacitor.' 
                : 'Need a standalone .APK file for enterprise MDM deployment? The app is 100% compliant with PWABuilder, TWA, and Capacitor.'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800 shrink-0">
            Android 8.0 - 15+ Ready
          </span>
        </div>
      </div>

      {/* 3. Hardware Scanner Configuration Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {isRtl ? 'توصيل قارئات الباركود الخارجية (USB / Bluetooth / 2.4GHz)' : 'External Hardware Barcode Scanner Integration'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRtl 
                ? 'إعداد فوري لقارئات الباركود اللاسلكية والسلكية عبر وصلة OTG للهواتف والتابلت' 
                : 'Plug-and-play setup for USB OTG, 2.4GHz Dongle, and Bluetooth 1D Scanners'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg space-y-1">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center text-[10px]">1</span>
              <span>{isRtl ? 'توصيل القارئ بالهاتف' : 'Connect Scanner'}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              {isRtl 
                ? 'صل كابل القارئ عبر وصلة USB OTG بالأندرويد أو اقترن به كجهاز Bluetooth HID.' 
                : 'Plug via USB OTG cable or pair Bluetooth scanner in Android Settings as a standard HID Keyboard.'}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg space-y-1">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center text-[10px]">2</span>
              <span>{isRtl ? 'خاصية Enter التلقائية' : 'Suffix Setting'}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              {isRtl 
                ? 'قارئات الباركود ترسل افتراضياً ضغطة Enter بعد كل باركود مما ينفذ المطابقة فوراً.' 
                : 'Ensure your physical scanner is programmed to append an [ENTER / CR] suffix at the end of each scan.'}
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg space-y-1">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center text-[10px]">3</span>
              <span>{isRtl ? 'المسح المستمر دون لمس الشاشة' : 'Continuous Scanning'}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              {isRtl 
                ? 'امسح باركود الفاتورة ثم باشر مسح الأصناف مباشرة، والكميات تزداد تلقائياً مع التنبيه الصوتي.' 
                : 'Scan invoice barcode first, then scan items one by one. The count increments automatically.'}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Audio & Vibration Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="p-2 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/30">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Audio & Haptic Feedback</h2>
            <p className="text-xs text-slate-400">
              Customize industrial audible beeps and device vibration
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          {/* Sound Toggle & Volume */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-200">Audible Beep Feedback</div>
              <div className="text-slate-400 text-[11px]">Distinct synthesized tones for Match, Exact, Mismatch & Surplus</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={settings.soundVolume}
                onChange={(e) => onUpdateSettings({ ...settings, soundVolume: parseFloat(e.target.value) })}
                className="w-24 accent-emerald-500"
              />
              <button
                onClick={() => onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                  settings.soundEnabled
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {settings.soundEnabled ? 'Sound ON' : 'Muted'}
              </button>
            </div>
          </div>

          {/* Long Barcode Length Threshold Configuration */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <span>Long Barcode Alert Threshold</span>
                <span className="text-xs bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-700 font-mono font-bold">
                  &gt; {settings.longBarcodeThreshold || 10} digits
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Barcodes exceeding this digit length will trigger the conditional alert modal (Allow / Block / Decide Later)
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="6"
                max="20"
                step="1"
                value={settings.longBarcodeThreshold || 10}
                onChange={(e) => onUpdateSettings({ ...settings, longBarcodeThreshold: parseInt(e.target.value, 10) })}
                className="w-28 accent-amber-500"
              />
              <span className="font-mono font-bold text-amber-400 text-xs w-8 text-center">
                {settings.longBarcodeThreshold || 10}
              </span>
            </div>
          </div>

          {/* Sound Preview Tests */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-slate-400 text-xs font-semibold">Test Tones:</span>
            <button
              onClick={() => testAudio('match')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded border border-slate-700 text-[11px] font-semibold"
            >
              Match Ping (880Hz)
            </button>
            <button
              onClick={() => testAudio('exact')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 text-[11px] font-semibold"
            >
              Exact Chime (High 2-tone)
            </button>
            <button
              onClick={() => testAudio('mismatch')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-red-400 rounded border border-slate-700 text-[11px] font-semibold"
            >
              Mismatch Buzz (Low 220Hz)
            </button>
            <button
              onClick={() => testAudio('surplus')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700 text-[11px] font-semibold"
            >
              Surplus Alert (3-tone)
            </button>
            <button
              onClick={() => testAudio('long')}
              className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 rounded border border-amber-700/80 text-[11px] font-bold"
            >
              Long Barcode Alert (Distinct Siren)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
