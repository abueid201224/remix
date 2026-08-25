import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  KeyRound, 
  Phone, 
  IdCard, 
  Building2, 
  UserCheck, 
  UserPlus, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles,
  Zap,
  Info,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFINITIONS, type UserRole, type AppUser } from '../types';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRtl?: boolean;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  isRtl = true,
}) => {
  const { 
    currentAppUser, 
    allUsers, 
    loginWithCredentials, 
    loginAsGuest, 
    quickSwitchUser, 
    registerAppUser 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'switch'>('login');
  
  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regJobId, setRegJobId] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('WAREHOUSE_KEEPER');
  const [regPin, setRegPin] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regTitle, setRegTitle] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginIdentifier.trim()) {
      setLoginError(isRtl ? 'يرجى إدخال الرقم الوظيفي أو رقم الهاتف' : 'Please enter Employee ID or Phone');
      return;
    }
    if (!loginPin.trim() || loginPin.length < 4) {
      setLoginError(isRtl ? 'رمز PIN يجب أن يتكون من 4 أرقام على الأقل' : 'PIN must be at least 4 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithCredentials(loginIdentifier, loginPin);
      if (res.success) {
        onClose();
      } else {
        setLoginError(res.error || (isRtl ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError(isRtl ? 'يرجى إدخال الاسم بالكامل' : 'Please enter full name');
      return;
    }
    if (!regJobId.trim()) {
      setRegError(isRtl ? 'يرجى إدخال الرقم الوظيفي' : 'Please enter Employee ID');
      return;
    }
    if (!regPin.trim() || regPin.length < 4) {
      setRegError(isRtl ? 'رمز PIN يجب أن يتكون من 4 أرقام رقمية على الأقل' : 'PIN must be at least 4 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerAppUser({
        name: regName.trim(),
        jobId: regJobId.trim().toUpperCase(),
        phone: regPhone.trim() || undefined,
        role: regRole,
        pinCode: regPin.trim(),
        department: regDepartment.trim() || undefined,
        title: regTitle.trim() || ROLE_DEFINITIONS[regRole].labelAr,
        signatureText: `${ROLE_DEFINITIONS[regRole].labelAr} - ${regName.trim()}`,
      });

      if (res.success) {
        onClose();
      } else {
        setRegError(res.error || (isRtl ? 'فشل إنشاء الحساب' : 'Failed to create user'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSwitch = async (user: AppUser) => {
    await quickSwitchUser(user);
    onClose();
  };

  const handleGuestEntry = async () => {
    await loginAsGuest();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh] ${isRtl ? 'rtl' : 'ltr'}`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {isRtl ? 'إدارة المستخدمين والصلاحيات الرقابية' : 'User Access & RBAC Roles'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl ? 'دخول آمن بالرقم الوظيفي / الهاتف ورمز PIN الرقمي' : 'Secure login with Employee ID / Phone & numeric PIN'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active User Banner */}
        {currentAppUser && (
          <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">{isRtl ? 'المستخدم الحالي:' : 'Current User:'}</span>
              <span className="font-bold text-white">{currentAppUser.name}</span>
              <span className={`px-2 py-0.5 rounded-full font-mono font-semibold text-[11px] border ${ROLE_DEFINITIONS[currentAppUser.role].color} ${ROLE_DEFINITIONS[currentAppUser.role].bgLight}`}>
                {isRtl ? ROLE_DEFINITIONS[currentAppUser.role].labelAr : ROLE_DEFINITIONS[currentAppUser.role].labelEn}
              </span>
            </div>
            <span className="font-mono text-slate-400 text-[11px]">
              ID: {currentAppUser.jobId}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 bg-slate-950/40 p-1.5 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('login')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'login' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
          </button>

          <button
            onClick={() => setActiveTab('switch')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'switch' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>{isRtl ? 'التبديل السريع' : 'Quick Demo'}</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'register' 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isRtl ? 'إنشاء حساب جديد' : 'New Account'}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isRtl ? 'الرقم الوظيفي أو رقم الهاتف' : 'Employee ID or Phone Number'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={isRtl ? 'مثال: AUD-101 أو 0501112233' : 'e.g. AUD-101 or 0501112233'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    autoFocus
                  />
                  <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-slate-500">
                    <IdCard className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isRtl ? 'رمز المرور الرقمي (PIN Code)' : 'Numeric PIN Code (4-6 digits)'}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono tracking-widest text-center text-lg"
                  />
                  <div className="absolute inset-y-0 end-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isRtl ? 'رمز الدخول التجريبي الافتراضي للمستخدمين هو 1234' : 'Default demo users PIN is 1234'}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isRtl ? 'تسجيل الدخول للمستودع' : 'Sign In Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleGuestEntry}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'المتابعة كـ مستخدم ضيف (قراءة واستعراض فقط)' : 'Continue as Guest (Read-Only Demo)'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: QUICK SWITCH DEMO USERS */}
          {activeTab === 'switch' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                {isRtl ? 'اختر أي حساب تجريبي للتبديل الفوري ومعاينة الصلاحيات المخصصة لكل دور:' : 'Select any role account to switch instantly and test RBAC permissions:'}
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {allUsers.map((u) => {
                  const rConf = ROLE_DEFINITIONS[u.role] || ROLE_DEFINITIONS.GUEST;
                  const isCurrent = currentAppUser?.id === u.id;

                  return (
                    <button
                      key={u.id}
                      onClick={() => handleDemoSwitch(u)}
                      className={`p-3.5 rounded-xl border text-start transition-all flex items-center justify-between gap-3 ${
                        isCurrent 
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/30' 
                          : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${rConf.color} ${rConf.bgLight}`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{u.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.2 rounded">
                                {isRtl ? 'الحالي' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="font-mono">{u.jobId}</span>
                            <span>•</span>
                            <span>{isRtl ? rConf.labelAr : rConf.labelEn}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                            {isRtl ? rConf.descriptionAr : rConf.descriptionEn}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold flex-shrink-0">
                        <span>{isRtl ? 'تبديل' : 'Switch'}</span>
                        <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: REGISTER NEW USER */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {regError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRtl ? 'الاسم الكامل' : 'Full Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={isRtl ? 'مثال: سامي المنصور' : 'e.g. John Doe'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRtl ? 'الرقم الوظيفي (Job ID)' : 'Employee ID'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={regJobId}
                    onChange={(e) => setRegJobId(e.target.value)}
                    placeholder={isRtl ? 'مثال: AUD-105' : 'e.g. AUD-105'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRtl ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isRtl ? 'رمز المرور الرقمي (PIN)' : 'Numeric PIN (4-6 digits)'} *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-center tracking-widest"
                  />
                </div>
              </div>

              {/* Role Selection Matrix */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {isRtl ? 'الدور والصلاحيات الرقابية' : 'System Role & Permissions'} *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['WAREHOUSE_KEEPER', 'AUDITOR', 'SUPERVISOR', 'GUEST'] as UserRole[]).map((r) => {
                    const rConf = ROLE_DEFINITIONS[r];
                    const isSelected = regRole === r;

                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRegRole(r)}
                        className={`p-2.5 rounded-xl border text-start transition-all ${
                          isSelected 
                            ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500/40 text-white' 
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white">
                            {isRtl ? rConf.labelAr : rConf.labelEn}
                          </span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                          {isRtl ? rConf.descriptionAr : rConf.descriptionEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isRtl ? 'تسجيل وحفظ الحساب الجديد' : 'Save & Register User'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Role Standards Reference Card */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Info className="w-3.5 h-3.5" />
              <span>{isRtl ? 'معايير الصلاحيات المعتمدة:' : 'Approved Role Standards:'}</span>
            </div>
            <p>
              {isRtl 
                ? '• مراجع/مدقق: اعتماد التدقيق، التوقيع الرقمي، معايير ISA 500، وفحص المرتجعات.'
                : '• Auditor: Certified dispatch audit, digital signature, ISA 500 & RMA quality tests.'}
            </p>
            <p>
              {isRtl 
                ? '• أمين مستودع: عمليات الاستلام الفعلي، تفكيك العبوات، الجرد، وقوائم السحب والتجهيز.'
                : '• Warehouse Keeper: Physical inbound, cycle counts, packaging breakdown & wave picking.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
