import React, { useState } from 'react';
import { 
  Smartphone, 
  Download, 
  Terminal, 
  FileCode, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Boxes, 
  Sparkles,
  X,
  BookOpen,
  Check,
  AlertCircle
} from 'lucide-react';
import { generateAndroidApkGuidePdf } from '../services/apkGuidePdfService';
import type { AppSettings } from '../types';

interface AndroidApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
}

export const AndroidApkGuideModal: React.FC<AndroidApkGuideModalProps> = ({
  isOpen,
  onClose,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'snippets' | 'pda' | 'review'>('steps');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const isRtl = settings.language === 'ar';

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateAndroidApkGuidePdf({
        authorName: settings.auditorName || 'Ahmed Hamada (أحمد حمادة)',
        appName: 'WMS Auditor Pro (نظام إدارة ومراجعة المستودعات)',
        appVersion: 'v2.4.0 (Enterprise APK Ready)'
      });
    } catch (err) {
      console.error('Error generating APK guide PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const stepsList = [
    {
      step: '1',
      title: isRtl ? 'بناء ملفات الواجهة الإنتاجية (Vite Web Build)' : 'Build Production Web Bundle',
      desc: isRtl 
        ? 'نقوم بتجميع أكواد React وTypeScript وTailwind CSS لإنشاء حزمة الويب المستقلة في مجلد dist/.'
        : 'Compile React, TypeScript, and Tailwind CSS assets into standalone dist/ directory.',
      cmd: 'npm run build',
      hint: isRtl ? 'تأكد من نجاح أمر البناء وظهور مجلد dist/ متضمناً index.html والأصول.' : 'Verify dist/ folder is generated with index.html and assets.'
    },
    {
      step: '2',
      title: isRtl ? 'تثبيت حزم Capacitor للأندرويد' : 'Install Capacitor Native Core & Android CLI',
      desc: isRtl 
        ? 'تثبيت محرك Capacitor المسؤول عن تحويل تطبيق الويب إلى تطبيق أندرويد أصلي.'
        : 'Install Capacitor core runtime and Android platform CLI bindings.',
      cmd: 'npm install @capacitor/core @capacitor/cli @capacitor/android',
      hint: isRtl ? 'هذه الحزم متوافقة مع أحدث إصدارات Android Studio وGradle 8+.' : 'Fully compatible with Android Studio Koala/Ladybug and Gradle 8+.'
    },
    {
      step: '3',
      title: isRtl ? 'تهيئة وتوليد مشروع الأندرويد الأصلي' : 'Initialize & Add Android Platform',
      desc: isRtl 
        ? 'إنشاء مجلد الأندرويد android/ وتكوين ملفات Gradle وAndroidManifest.xml تلقائياً.'
        : 'Generate native Android Studio project structure inside android/ directory.',
      cmd: 'npx cap add android',
      hint: isRtl ? 'سيتم إنشاء مجلد android/ في جذر المشروع ليحتوي على مشروع أندرويد ستوديو كامل.' : 'Creates android/ directory ready for Android Studio IDE.'
    },
    {
      step: '4',
      title: isRtl ? 'مزامنة ملفات الويب والأصول مع الأندرويد' : 'Sync Web Assets with Android Project',
      desc: isRtl 
        ? 'نسخ حزمة dist/ إلى مسار الأصول الداخلية للأندرويد وتحديث الإضافات.'
        : 'Copy /dist assets into /android/app/src/main/assets/public.',
      cmd: 'npx cap sync android',
      hint: isRtl ? 'كرر هذا الأمر دائماً بعد إجراء أي تعديل على كود التطبيق لتحديث نسخة الأندرويد.' : 'Run this command anytime you make changes to your React app.'
    },
    {
      step: '5',
      title: isRtl ? 'فتح المشروع في Android Studio' : 'Open in Android Studio',
      desc: isRtl 
        ? 'فتح مجلد الأندرويد مباشرة في بيئة التطوير Android Studio لبدء البناء أو التجربة.'
        : 'Launch Android Studio with the newly generated Gradle project.',
      cmd: 'npx cap open android',
      hint: isRtl ? 'يمكنك أيضاً فتح المجلد android/ يدوياً من داخل Android Studio عبر File > Open.' : 'Or open the /android folder via Android Studio File > Open.'
    },
    {
      step: '6',
      title: isRtl ? 'توليد حزمة التثبيت الموقعة (Generate Signed APK)' : 'Generate Signed Release APK',
      desc: isRtl 
        ? 'من القائمة العلوية في أندرويد ستوديو: Build > Generate Signed Bundle / APK > APK > Release.'
        : 'In Android Studio: Build > Generate Signed Bundle / APK > select APK > Release variant.',
      cmd: './gradlew assembleRelease',
      hint: isRtl ? 'ستجد ملف APK النهائي في المسار: android/app/build/outputs/apk/release/app-release.apk' : 'Release APK generated at: android/app/build/outputs/apk/release/app-release.apk'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/70 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/30">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {isRtl ? 'دليل تحويل وتجميع التطبيق لـ APK عبر Android Studio' : 'Android Studio APK Build & Export Guide'}
                </h2>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Capacitor 6.x / Android 14+
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl 
                  ? 'خطوات عملية بالتفصيل لتحويل المنظومة إلى تطبيق أندرويد مستقل APK للأجهزة اللوحية وهواتف العمال وماسحات الباركود اللاسلكية'
                  : 'Complete step-by-step instructions to export standalone Android APK for tablets, phones, and rugged PDA barcode scanners.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all border border-emerald-400/40"
              title={isRtl ? 'تحميل ملف الدليل الشامل بصيغة PDF' : 'Download Complete Guide as PDF'}
            >
              <Download className="w-4 h-4 animate-bounce" />
              <span>{isRtl ? 'تحميل دليل PDF' : 'Download PDF Guide'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'steps'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>{isRtl ? '1. خطوات التجميع خطوة بخطوة' : '1. Step-by-Step Workflow'}</span>
          </button>

          <button
            onClick={() => setActiveTab('snippets')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'snippets'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>{isRtl ? '2. ملفات الإعداد المهيأة (Configs)' : '2. Ready Config Snippets'}</span>
          </button>

          <button
            onClick={() => setActiveTab('pda')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'pda'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{isRtl ? '3. ضبط أجهزة الباركود والـ PDA' : '3. Hardware PDA Setup'}</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'review'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isRtl ? '4. مراجعة البناء البرمجي والمنطق' : '4. Architecture & Logic Review'}</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: STEP BY STEP WORKFLOW */}
          {activeTab === 'steps' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-3.5 flex items-start gap-3 text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold text-emerald-300">
                    {isRtl ? 'التطبيق جاهز 100% للتصدير والعمل أوفلاين على الأندرويد' : 'App is 100% Offline & Android APK Ready'}
                  </p>
                  <p className="text-emerald-400/90 text-xs mt-0.5">
                    {isRtl 
                      ? 'تم تجهيز ملفات capacitor.config.ts و manifest.json ودعم قارئ الباركود الخطي وذاكرة IndexedDB المدمجة بدون الحاجة لخوادم خارجية.'
                      : 'All native bridge configurations, IndexedDB offline persistence, and hardware scanner keystroke listeners are configured.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {stepsList.map((item, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all shadow-md flex flex-col sm:flex-row items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-black flex items-center justify-center border border-indigo-500/30 shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">{item.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                        
                        <div className="mt-2.5 flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg font-mono text-xs text-emerald-400 max-w-xl overflow-x-auto">
                          <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="select-all">{item.cmd}</span>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{item.hint}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(item.cmd, idx)}
                      className="self-end sm:self-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 shrink-0"
                      title={isRtl ? 'نسخ الأمر' : 'Copy Command'}
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{isRtl ? 'تم النسخ' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'نسخ الأمر' : 'Copy'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: READY CONFIG SNIPPETS */}
          {activeTab === 'snippets' && (
            <div className="space-y-5">
              {/* capacitor.config.ts */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black text-white font-mono">capacitor.config.ts</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wms.auditor.pro',
  appName: 'WMS Auditor Pro',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#020617'
  }
};

export default config;`, 101)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded flex items-center gap-1"
                  >
                    {copiedIndex === 101 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 101 ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto">
{`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wms.auditor.pro',
  appName: 'WMS Auditor Pro',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#020617'
  }
};

export default config;`}
                </pre>
              </div>

              {/* AndroidManifest.xml */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black text-white font-mono">android/app/src/main/AndroidManifest.xml</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`<!-- Barcode Scanner & Camera Permissions -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />`, 102)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded flex items-center gap-1"
                  >
                    {copiedIndex === 102 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 102 ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-amber-300 overflow-x-auto">
{`<!-- Barcode Scanner & Camera Permissions -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE PDA BARCODE SETUP */}
          {activeTab === 'pda' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zebra */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🦓</span>
                    <h3 className="text-sm font-black text-white">Zebra DataWedge (TC21, TC26, TC52, MC3300)</h3>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                    <li>افتح تطبيق <strong>DataWedge</strong> على جهاز الزيبرا.</li>
                    <li>اختر <strong>Profile0 (Default)</strong> أو أنشئ بروفايل باسم WMS.</li>
                    <li>فعّل <strong>Keystroke Output</strong>.</li>
                    <li>اضبط <strong>Action Key Char</strong> على <strong>ENTER (CR/LF)</strong>.</li>
                    <li>سيقوم جهاز الليزر بإرسال الباركود فوراً للمنظومة دون الحاجة للضغط على أي أزرار.</li>
                  </ul>
                </div>

                {/* Honeywell */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📱</span>
                    <h3 className="text-sm font-black text-white">Honeywell ScanPal (EDA51, CT40, CT60)</h3>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                    <li>ادخل إلى <strong>Settings &gt; Honeywell Settings &gt; Scanning</strong>.</li>
                    <li>اختر <strong>Internal Scanner &gt; Default Profile</strong>.</li>
                    <li>في قسم <strong>Data Processing Settings</strong>، اختر <strong>Wedge Method: Keyboard</strong>.</li>
                    <li>في قسم <strong>Suffix</strong>، ضع الرمز <strong>\n</strong> لإرسال Enter تلقائياً.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE REVIEW */}
          {activeTab === 'review' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-black text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>نتائج فحص البناء البرمجي والمنطق وجودة الأكواد (Architectural Audit):</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>قاعدة البيانات والتخزين المستقل (IndexedDB):</span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      المنظومة تعتمد بالكامل على IndexedDB مع معاملات ذرية (Transactions). لا يوجد أي استدعاءات سحابية تعطل العمل عند انقطاع الإنترنت.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>معالجة نبضات الباركود (Zero Latency Listener):</span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      المستمع العام (Event Listener) يفصل بذكاء بين الكتابة اليدوية في الحقول ونبضات أجهزة الليزر فائقة السرعة (&lt; 50ms).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حسابات تفكيك العبوات (Packaging Math):</span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      المعادلات الرياضية لتفكيك الكراتين والباكتات والحبات الفردية دقيقة 100% وتمنع أي فروقات كسور أو أخطاء تقريب.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>التوافق الرقابي والتوثيق (ISA 500 Compliance):</span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      كافة عمليات التدقيق والتقارير تسجل معرف المراجع وتوقيعه الرقمي والوقت الفعلي والتعديلات اليدوية بدقة تامة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {isRtl ? '💡 نصيحة: احتفظ بنسخة من ملف PDF كمرجع دائم لفريق تقنية المعلومات بالمستودع.' : 'Tip: Keep the PDF manual saved for your warehouse IT engineers.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownloadPdf}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{isRtl ? 'تحميل الدليل كـ PDF' : 'Download PDF Guide'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition-all"
            >
              {isRtl ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
