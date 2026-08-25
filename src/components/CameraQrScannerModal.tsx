import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { 
  Camera, 
  X, 
  QrCode, 
  Flashlight, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Upload,
  Sparkles,
  Zap
} from 'lucide-react';
import { SoundEffects } from '../services/audio';

interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedValue: string) => void;
  soundEnabled: boolean;
  soundVolume: number;
  language: 'ar' | 'en';
}

// Extracts clean Invoice/Order identifier from various QR code formats (JSON, URL, or plain text)
export function extractInvoiceOrOrderCode(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';

  // 1. JSON payload format check e.g. {"invoiceNo": "INV-001"} or {"orderNo": "ORD-8801"}
  if ((clean.startsWith('{') && clean.endsWith('}')) || (clean.startsWith('[') && clean.endsWith(']'))) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.invoiceNo) return String(parsed.invoiceNo).trim();
      if (parsed.orderNo) return String(parsed.orderNo).trim();
      if (parsed.invoice) return String(parsed.invoice).trim();
      if (parsed.order) return String(parsed.order).trim();
      if (parsed.inv) return String(parsed.inv).trim();
      if (parsed.id) return String(parsed.id).trim();
    } catch {
      // ignore json parse error
    }
  }

  // 2. URL format check e.g. https://domain.com/inv/INV-2024-001 or ?inv=INV-2024-001
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const url = new URL(clean);
      const invParam = url.searchParams.get('invoice') || url.searchParams.get('inv') || url.searchParams.get('order') || url.searchParams.get('ord');
      if (invParam) return invParam.trim();
      
      // Get trailing path segment
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1].trim();
      }
    } catch {
      // ignore url parse error
    }
  }

  // 3. Plain barcode / order text
  return clean;
}

export const CameraQrScannerModal: React.FC<CameraQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  soundEnabled,
  soundVolume,
  language,
}) => {
  const isRtl = language === 'ar';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [detectedResult, setDetectedResult] = useState<string | null>(null);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Frame processing loop for QR decoding
  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data.trim().length > 0) {
        const extracted = extractInvoiceOrOrderCode(code.data);
        if (extracted) {
          setDetectedResult(extracted);
          if (soundEnabled) SoundEffects.playInvoiceLock(soundVolume);
          SoundEffects.vibrate(100);

          // Short visual confirmation before closing
          setTimeout(() => {
            stopCamera();
            onScanSuccess(extracted);
            onClose();
          }, 350);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(tick);
  }, [onClose, onScanSuccess, soundEnabled, soundVolume, stopCamera]);

  // Start Camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setHasCameraError(null);
    setDetectedResult(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(isRtl ? 'المتصفح لا يدعم الوصول للكاميرا.' : 'Browser camera API is not supported.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS/Android WebView
        await videoRef.current.play();
        setIsScanning(true);
        animationFrameId.current = requestAnimationFrame(tick);
      }

      // Check Torch/Flashlight capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && capabilities.torch) {
        setHasTorchSupport(true);
      } else {
        setHasTorchSupport(false);
      }
    } catch (err: any) {
      console.error('Camera initialization failed', err);
      setHasCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? (isRtl ? 'تم رفض إذن الوصول للكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح.' : 'Camera permission was denied. Please allow camera access in browser settings.')
          : (isRtl ? `تعذر تشغيل الكاميرا: ${err.message || 'خطأ غير معروف'}` : `Failed to start camera: ${err.message || 'Unknown error'}`)
      );
    }
  }, [facingMode, isRtl, stopCamera, tick]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle failed', err);
      }
    }
  };

  // Flip Camera lens
  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Fallback: Upload QR image from gallery / files
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            const extracted = extractInvoiceOrOrderCode(code.data);
            setDetectedResult(extracted);
            if (soundEnabled) SoundEffects.playInvoiceLock(soundVolume);
            setTimeout(() => {
              onScanSuccess(extracted);
              onClose();
            }, 300);
          } else {
            alert(isRtl ? 'لم يتم العثور على رمز QR صالح في الصورة المرفقة.' : 'No valid QR code found in uploaded image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950 border border-emerald-600/50 rounded-xl text-emerald-400">
              <QrCode className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                <span>{isRtl ? 'قارئ QR Code لكاميرا الفاتورة / الأوردر' : 'Invoice & Order QR Code Scanner'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRtl ? 'وجّه الكاميرا نحو رمز QR على الفاتورة أو ورقة التحضير لقفلها فوراً' : 'Point camera at the Invoice / Order QR code to lock onto it'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Canvas Area */}
        <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* QR Target Reticle & Laser line */}
          {isScanning && !hasCameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-lg" />

                {/* Animated Scanning Laser */}
                <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-bounce" />

                <span className="text-[11px] font-bold text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/50 uppercase tracking-wider">
                  {isRtl ? 'ضع رمز QR داخل الإطار' : 'Align QR inside frame'}
                </span>
              </div>
            </div>
          )}

          {/* Detected Success Overlay */}
          {detectedResult && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in duration-150">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-2 animate-bounce" />
              <span className="text-xs uppercase font-bold text-emerald-300 tracking-wider">
                {isRtl ? 'تم التقاط رمز الفاتورة / الأوردر بنجاح!' : 'QR Code Successfully Detected!'}
              </span>
              <div className="text-2xl font-black font-mono text-white mt-1">
                {detectedResult}
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {hasCameraError && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
              <div className="text-sm text-slate-200 font-semibold max-w-sm">
                {hasCameraError}
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isRtl ? 'إعادة المحاولة' : 'Retry Camera'}</span>
                </button>
                <label className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>{isRtl ? 'رفع صورة QR' : 'Upload QR Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Camera Controls */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {hasTorchSupport && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  torchOn 
                    ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={isRtl ? 'تشغيل فلاش الكاميرا' : 'Toggle Flashlight'}
              >
                <Flashlight className="w-4 h-4" />
                <span className="hidden sm:inline">{torchOn ? (isRtl ? 'الفلاش مفعّل' : 'Torch ON') : (isRtl ? 'الفلاش' : 'Torch')}</span>
              </button>
            )}

            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title={isRtl ? 'تبديل الكاميرا (أمامية / خلفية)' : 'Switch Camera'}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">{facingMode === 'environment' ? (isRtl ? 'كاميرا خلفية' : 'Rear Camera') : (isRtl ? 'كاميرا أمامية' : 'Front Camera')}</span>
            </button>
          </div>

          {/* Quick upload fallback button */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span>{isRtl ? 'رفع صورة' : 'Upload Image'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
