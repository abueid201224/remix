import React, { useState, useRef, useEffect } from 'react';
import { 
  UserCheck, 
  X, 
  PenTool, 
  RotateCcw, 
  Check, 
  ShieldCheck, 
  Sparkles,
  BadgeCheck,
  FileSignature
} from 'lucide-react';
import type { AppSettings } from '../types';

interface AuditorSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveAuditorInfo?: (info: {
    auditorName: string;
    auditorId: string;
    auditorTitle: string;
    auditorSignature?: string;
  }) => void;
  onSaveSettings?: (newSettings: AppSettings) => void;
  language?: 'ar' | 'en';
}

export const AuditorSignatureModal: React.FC<AuditorSignatureModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveAuditorInfo,
  onSaveSettings,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  
  const [name, setName] = useState(settings.auditorName || 'أحمد حمادة');
  const [id, setId] = useState(settings.auditorId || 'AUD-101');
  const [title, setTitle] = useState(settings.auditorTitle || (isRtl ? 'مراجع ومراقب مخزون معتمد' : 'Senior Inventory Auditor'));
  const [signatureData, setSignatureData] = useState<string>(settings.auditorSignature || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas with existing signature or blank
  useEffect(() => {
    if (!isOpen) return;

    setName(settings.auditorName || 'أحمد حمادة');
    setId(settings.auditorId || 'AUD-101');
    setTitle(settings.auditorTitle || (isRtl ? 'مراجع ومراقب مخزون معتمد' : 'Senior Inventory Auditor'));
    setSignatureData(settings.auditorSignature || '');

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (settings.auditorSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = settings.auditorSignature;
    } else {
      setHasDrawn(false);
    }
  }, [isOpen, settings, isRtl]);

  if (!isOpen) return null;

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.strokeStyle = '#10b981'; // Emerald ink
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setHasDrawn(false);
  };

  // Generate an official digital stamp on the canvas
  const generateOfficialSeal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background subtle pattern
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 12);
    ctx.stroke();

    // Inner dashed border
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stamp text
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isRtl ? 'تم التدقيق والاعتماد المخزني' : 'AUDITED & DIGITALLY CERTIFIED', canvas.width / 2, 45);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${name.trim() || 'Auditor'} (${id.trim() || 'AUD-101'})`, canvas.width / 2, 75);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText(title.trim() || 'Certified Warehouse Auditor', canvas.width / 2, 100);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 11px monospace';
    const dateStr = new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { dateStyle: 'medium' });
    ctx.fillText(`VERIFIED: ${dateStr}`, canvas.width / 2, 120);

    setSignatureData(canvas.toDataURL('image/png'));
    setHasDrawn(true);
  };

  const handleSave = () => {
    const cleanName = name.trim() || 'أحمد حمادة';
    const cleanId = id.trim() || 'AUD-101';
    const cleanTitle = title.trim() || 'مراجع ومراقب مخزون';
    
    let finalSignature = signatureData;
    if (!hasDrawn && !finalSignature && canvasRef.current) {
      // If user hasn't drawn anything, auto-generate official seal
      generateOfficialSeal();
      finalSignature = canvasRef.current.toDataURL('image/png');
    }

    const updatedInfo = {
      auditorName: cleanName,
      auditorId: cleanId,
      auditorTitle: cleanTitle,
      auditorSignature: finalSignature,
    };

    if (typeof onSaveAuditorInfo === 'function') {
      onSaveAuditorInfo(updatedInfo);
    }
    if (typeof onSaveSettings === 'function') {
      onSaveSettings({
        ...settings,
        ...updatedInfo,
      });
    }
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-slate-900 border-2 border-emerald-600/70 rounded-2xl shadow-2xl w-full max-w-lg text-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-b border-emerald-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-inner">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{isRtl ? 'ملف واعتماد المراجع والمراقب' : 'Auditor Profile & Digital Signature'}</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/40">
                  {isRtl ? 'معايير المراجعة ISA 500' : 'ISA 500'}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {isRtl ? 'توثيق اسم المراجع وتوقيعه الرسمي على الفواتير وتقارير الفروقات' : 'Attach auditor credentials & signature to audit logs and reports'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Auditor Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRtl ? 'اسم المراجع / المدقق المسؤول:' : 'Auditor Full Name:'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRtl ? 'مثال: أحمد حمادة' : 'e.g. Ahmed Hamada'}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white text-xs sm:text-sm font-semibold focus:outline-none"
                />
              </div>
            </div>

            {/* Auditor ID */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRtl ? 'كود / رقم المراجع (Auditor ID):' : 'Auditor Badge / ID Code:'}
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="AUD-101"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-emerald-300 font-mono font-bold text-xs sm:text-sm focus:outline-none"
              />
            </div>

            {/* Job Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRtl ? 'المسمى الوظيفي / الصفة الرقابية:' : 'Job Title / Designation:'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isRtl ? 'مراجع ومراقب مخزون معتمد' : 'Senior Inventory Auditor'}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Signature / Digital Seal Canvas */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRtl ? 'لوحة التوقيع الرقمي / الختم المعتمد:' : 'Digital Signature / Certified Stamp Canvas:'}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateOfficialSeal}
                  className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  title={isRtl ? 'توليد ختم تدقيق رسمي تلقائي' : 'Generate official digital seal'}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>{isRtl ? 'توليد ختم معتمد' : 'Generate Seal'}</span>
                </button>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[11px] font-semibold text-slate-400 hover:text-red-300 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isRtl ? 'مسح' : 'Clear'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="relative bg-slate-950 border-2 border-dashed border-slate-700 rounded-xl overflow-hidden touch-none flex items-center justify-center min-h-[140px]">
              <canvas
                ref={canvasRef}
                width={460}
                height={140}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair"
              />
              {!hasDrawn && !isDrawing && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-500 text-xs">
                  <PenTool className="w-6 h-6 mb-1 opacity-40" />
                  <span>{isRtl ? 'وقع هنا باللمس أو القلم، أو اضغط "توليد ختم معتمد"' : 'Sign here with touch/pen or click "Generate Seal"'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Assurance Note */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-300/90 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>{isRtl ? 'التوثيق الرقابي التلقائي:' : 'Automatic Compliance:'}</strong>{' '}
              {isRtl
                ? 'سيتم إرفاق اسم المراجع وكوده وتوقيعه تلقائياً مع كل فاتورة مكتملة وتضمينه في تقارير الفروقات وملفات Excel و PDF المصدرة.'
                : 'Auditor credentials and digital signature will be embedded automatically into all audited invoices, error reports, and exported Excel/PDF files.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all border border-emerald-500/50"
          >
            <Check className="w-4 h-4" />
            <span>{isRtl ? 'حفظ واعتماد ملف المراجع' : 'Save & Confirm Profile'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
