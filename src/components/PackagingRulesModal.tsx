import React, { useState, useRef } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Layers,
  Filter,
  Save,
  Info,
  FileSpreadsheet,
  Download,
  Upload,
  Copy,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { PackagingGroupRule } from '../types';
import { savePackagingGroupRules } from '../services/db';
import {
  downloadPackagingRulesExcelTemplate,
  parsePackagingRulesExcel,
  exportPackagingRulesToExcel
} from '../services/excelService';

interface PackagingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: PackagingGroupRule[];
  onUpdateRules: (rules: PackagingGroupRule[]) => void;
  language?: 'ar' | 'en';
}

export const PackagingRulesModal: React.FC<PackagingRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  onUpdateRules,
  language = 'ar',
}) => {
  const isRtl = language === 'ar';
  const [ruleList, setRuleList] = useState<PackagingGroupRule[]>(rules);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ message: string; type: 'SUCCESS' | 'ERROR' | 'INFO' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New / Edit Rule Form State
  const [formState, setFormState] = useState<{
    name: string;
    startBarcode: string;
    endBarcode: string;
    category: string;
    cartonFactor: number;
    packFactor: number;
    unitName: string;
    systemUnit: string;
    notes: string;
  }>({
    name: '',
    startBarcode: '',
    endBarcode: '',
    category: '',
    cartonFactor: 24,
    packFactor: 6,
    unitName: 'حبة',
    systemUnit: 'حبة',
    notes: '',
  });

  // "إضافة مجموعة متشابهة أخرى لنفس الشروط" State
  const [selectedBaseRuleId, setSelectedBaseRuleId] = useState<string>(rules[0]?.id || '');
  const [similarGroupName, setSimilarGroupName] = useState('');
  const [similarStartBarcode, setSimilarStartBarcode] = useState('');
  const [similarEndBarcode, setSimilarEndBarcode] = useState('');

  if (!isOpen) return null;

  const showNotification = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
    setStatusNotice({ message, type });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const handleSaveRule = async () => {
    if (!formState.name.trim() || !formState.startBarcode.trim() || !formState.endBarcode.trim()) {
      showNotification(isRtl ? 'يرجى كتابة اسم المجموعة وبداية ونهاية نطاق الباركود.' : 'Please enter group name and barcode range.', 'ERROR');
      return;
    }

    let updated: PackagingGroupRule[];
    if (editingId) {
      updated = ruleList.map(r => r.id === editingId ? {
        ...r,
        ...formState,
      } : r);
      showNotification(isRtl ? 'تم تحديث شرط المجموعة بنجاح وتوحيده بالسيستم' : 'Rule updated successfully', 'SUCCESS');
    } else {
      const newRule: PackagingGroupRule = {
        id: `rule-${Date.now()}`,
        ...formState,
        baseUnit: formState.unitName,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      updated = [newRule, ...ruleList];
      showNotification(isRtl ? 'تمت إضافة شرط المجموعة الجديد بنجاح' : 'New rule created successfully', 'SUCCESS');
    }

    setRuleList(updated);
    onUpdateRules(updated);
    await savePackagingGroupRules(updated);

    setIsAddingNew(false);
    setEditingId(null);
    setFormState({
      name: '',
      startBarcode: '',
      endBarcode: '',
      category: '',
      cartonFactor: 24,
      packFactor: 6,
      unitName: 'حبة',
      systemUnit: 'حبة',
      notes: '',
    });
  };

  const handleStartEdit = (rule: PackagingGroupRule) => {
    setEditingId(rule.id);
    setFormState({
      name: rule.name,
      startBarcode: rule.startBarcode,
      endBarcode: rule.endBarcode,
      category: rule.category || '',
      cartonFactor: rule.cartonFactor || 24,
      packFactor: rule.packFactor || 6,
      unitName: rule.unitName || 'حبة',
      systemUnit: rule.systemUnit || rule.unitName || 'حبة',
      notes: rule.notes || '',
    });
    setIsAddingNew(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm(isRtl ? 'هل أنت متأكد من حذف شرط ضم العبوات هذا؟' : 'Are you sure you want to delete this packaging rule?')) {
      const updated = ruleList.filter(r => r.id !== id);
      setRuleList(updated);
      onUpdateRules(updated);
      await savePackagingGroupRules(updated);
      showNotification(isRtl ? 'تم حذف شرط المجموعة' : 'Rule deleted', 'INFO');
    }
  };

  const handleToggleActive = async (id: string) => {
    const updated = ruleList.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    setRuleList(updated);
    onUpdateRules(updated);
    await savePackagingGroupRules(updated);
  };

  // Clone / Add Similar Group for Same Conditions (إضافة مجموعة متشابهة أخرى لنفس الشروط)
  const handleAddSimilarGroup = async () => {
    const baseRule = ruleList.find(r => r.id === selectedBaseRuleId) || ruleList[0];
    if (!baseRule) {
      showNotification(isRtl ? 'يرجى اختيار مجموعة أساسية لنسخ شروطها.' : 'Please select a base group.', 'ERROR');
      return;
    }

    if (!similarStartBarcode.trim()) {
      showNotification(isRtl ? 'يرجى إدخال بداية كود / باركود المجموعة المتشابهة.' : 'Please enter start barcode.', 'ERROR');
      return;
    }

    const startCode = similarStartBarcode.trim();
    const endCode = similarEndBarcode.trim() || startCode;
    const name = similarGroupName.trim() || `${baseRule.name} (نطاق إضافي ${startCode}-${endCode})`;

    const clonedRule: PackagingGroupRule = {
      id: `rule-clone-${Date.now()}`,
      name,
      startBarcode: startCode,
      endBarcode: endCode,
      category: baseRule.category,
      cartonFactor: baseRule.cartonFactor,
      packFactor: baseRule.packFactor,
      unitName: baseRule.unitName,
      systemUnit: baseRule.systemUnit || baseRule.unitName,
      baseUnit: baseRule.baseUnit || baseRule.unitName,
      isActive: true,
      notes: `مجموعة متشابهة مكررة من (${baseRule.name}) بنفس الشروط ومعاملات الصرف والتغليف`,
      createdAt: new Date().toISOString(),
    };

    const updated = [clonedRule, ...ruleList];
    setRuleList(updated);
    onUpdateRules(updated);
    await savePackagingGroupRules(updated);

    // Reset inputs
    setSimilarGroupName('');
    setSimilarStartBarcode('');
    setSimilarEndBarcode('');

    showNotification(
      isRtl 
        ? `🎉 تم تفعيل نفس الشروط للمجموعة المتشابهة (${name}) وتوحيدها في كافة خدمات المستودع!`
        : `🎉 Similar group (${name}) added and applied to all services!`,
      'SUCCESS'
    );
  };

  // Handle Excel Upload for Packaging Rules
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parsePackagingRulesExcel(file);
      if (result.errors.length > 0 && result.rules.length === 0) {
        showNotification(result.errors.join(' | '), 'ERROR');
        return;
      }

      if (result.rules.length > 0) {
        // Merge without duplicating existing IDs
        const existingIds = new Set(ruleList.map(r => r.startBarcode + '-' + r.endBarcode));
        const newOnes = result.rules.filter(r => !existingIds.has(r.startBarcode + '-' + r.endBarcode));
        const merged = [...newOnes, ...ruleList];

        setRuleList(merged);
        onUpdateRules(merged);
        await savePackagingGroupRules(merged);

        showNotification(
          isRtl 
            ? `✅ تم استيراد وتفعيل ${result.rules.length} شروط تجميع عبوات من ملف الإكسيل بنجاح!` 
            : `✅ Imported ${result.rules.length} packaging rules from Excel!`,
          'SUCCESS'
        );
      }
    } catch (err: any) {
      showNotification(err.message || 'خطأ أثناء استيراد ملف الإكسيل', 'ERROR');
    } finally {
      e.target.value = '';
    }
  };

  const selectedBaseRule = ruleList.find(r => r.id === selectedBaseRuleId) || ruleList[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4 my-8"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{isRtl ? 'شروط ضم المنتجات في مجموعات متشابهة العبوة' : 'Packaging Grouping & Barcode Rules'}</span>
                <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  {ruleList.length} {isRtl ? 'مجموعات معرفة' : 'Rules'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'تحديد نطاقات الباركود والوحدة المعرفة على السيستم للصرف ومعاملات الكراتين والباكتات لجرد المخزون وقوائم الانتقاء' 
                  : 'Define barcode range rules, system issue units & conversion factors for picking, audit & inventory'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notice */}
        {statusNotice && (
          <div className={`mx-4 sm:mx-5 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
            statusNotice.type === 'SUCCESS' 
              ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300' 
              : statusNotice.type === 'ERROR'
              ? 'bg-red-950/80 border border-red-800/60 text-red-300'
              : 'bg-indigo-950/80 border border-indigo-800/60 text-indigo-300'
          }`}>
            {statusNotice.type === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusNotice.message}</span>
          </div>
        )}

        {/* Action Bar: Excel Template, Import & Export */}
        <div className="px-4 sm:px-5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadPackagingRulesExcelTemplate()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'تحميل نموذج إكسيل تفصيلي لتعبئة شروط العبوات' : 'Download Excel Template'}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isRtl ? 'تحميل نموذج إكسيل تفصيلي' : 'Excel Template'}</span>
            </button>

            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm">
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isRtl ? 'استيراد الشروط من إكسيل' : 'Import from Excel'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => exportPackagingRulesToExcel(ruleList)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'تصدير كافة الشروط الحالية لملف إكسيل' : 'Export Rules to Excel'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isRtl ? 'تصدير لإكسيل' : 'Export Excel'}</span>
            </button>
          </div>

          {!isAddingNew && (
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? 'إضافة شرط جديد' : 'New Rule'}</span>
            </button>
          )}
        </div>

        <div className="px-4 sm:px-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Add / Edit Form */}
          {isAddingNew && (
            <div className="bg-slate-950 border border-indigo-900/60 p-4 rounded-xl space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  {editingId ? (isRtl ? 'تعديل شرط المجموعة' : 'Edit Packaging Rule') : (isRtl ? 'إضافة شرط مجموعة عبوات جديد' : 'Add New Packaging Rule')}
                </span>
                <button
                  onClick={() => { setIsAddingNew(false); setEditingId(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'اسم المجموعة العبوية' : 'Group Name'}
                  </label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: مجموعة العصائر 250 مل (كرتون 24 / باكت 6)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'باركود البداية (من)' : 'Start Barcode'}
                  </label>
                  <input
                    type="text"
                    value={formState.startBarcode}
                    onChange={(e) => setFormState(prev => ({ ...prev, startBarcode: e.target.value }))}
                    placeholder="مثال: 6221000100"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'باركود النهاية (إلى)' : 'End Barcode'}
                  </label>
                  <input
                    type="text"
                    value={formState.endBarcode}
                    onChange={(e) => setFormState(prev => ({ ...prev, endBarcode: e.target.value }))}
                    placeholder="مثال: 6221000199"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1">
                    {isRtl ? 'الوحدة المعرفة على السيستم للصرف' : 'System Issue Unit'}
                  </label>
                  <select
                    value={formState.systemUnit}
                    onChange={(e) => setFormState(prev => ({ ...prev, systemUnit: e.target.value }))}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="حبة">حبة (Piece)</option>
                    <option value="قطعة">قطعة (Unit)</option>
                    <option value="باكيت">باكيت (Pack / Shrink)</option>
                    <option value="بوكس">بوكس (Box)</option>
                    <option value="كرتونة">كرتونة (Carton)</option>
                    <option value="شد">شد (Bundle)</option>
                    <option value="كيس">كيس (Bag)</option>
                    <option value="دستة">دستة (Dozen)</option>
                    <option value="طرد">طرد (Parcel)</option>
                    <option value="عبوة">عبوة (Bottle / Can)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'معامل الكرتونة / البوكس (حبة/كرتون)' : 'Carton / Box Factor'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formState.cartonFactor}
                    onChange={(e) => setFormState(prev => ({ ...prev, cartonFactor: Number(e.target.value) || 1 }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'معامل الباكت / الشد (حبة/باكت)' : 'Pack / Shrink Factor'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formState.packFactor}
                    onChange={(e) => setFormState(prev => ({ ...prev, packFactor: Number(e.target.value) || 1 }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'اسم الوحدة الفردية الصغرى' : 'Base Single Unit'}
                  </label>
                  <input
                    type="text"
                    value={formState.unitName}
                    onChange={(e) => setFormState(prev => ({ ...prev, unitName: e.target.value }))}
                    placeholder="حبة / علبة / قطعة"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {isRtl ? 'ملاحظات الصرف والتحويل (اختياري)' : 'Notes'}
                  </label>
                  <input
                    type="text"
                    value={formState.notes}
                    onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="ملاحظات الصرف والتغليف..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleSaveRule}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isRtl ? 'حفظ وتفعيل شرط المجموعة' : 'Save & Apply Rule'}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Defined Rules */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>{isRtl ? 'قائمة شروط المجموعات الحالية النشطة' : 'Active Packaging Rules'}</span>
              <span className="text-[11px] text-slate-500">
                {isRtl ? 'تطبق تلقائياً على كل باركود وارد أو ممسوح' : 'Applied automatically'}
              </span>
            </h3>

            {ruleList.map(rule => (
              <div 
                key={rule.id} 
                className={`p-3.5 bg-slate-950/90 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  rule.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-xs sm:text-sm">{rule.name}</span>
                    {rule.category && (
                      <span className="text-[10px] bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-semibold border border-slate-700">
                        {rule.category}
                      </span>
                    )}
                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded font-bold">
                      الوحدة المعرفة: {rule.systemUnit || rule.unitName || 'حبة'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${rule.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                      {rule.isActive ? 'مفعّل' : 'معطّل'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      النطاق: {rule.startBarcode} ⟵ {rule.endBarcode}
                    </span>
                    <span className="text-amber-300 font-semibold">
                      الكرتونة/البوكس: {rule.cartonFactor} {rule.unitName}
                    </span>
                    <span className="text-indigo-300 font-semibold">
                      الباكت/الشد: {rule.packFactor} {rule.unitName}
                    </span>
                  </div>

                  {rule.notes && (
                    <p className="text-[11px] text-slate-500">{rule.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleToggleActive(rule.id)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 transition-colors"
                  >
                    {rule.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button
                    onClick={() => handleStartEdit(rule)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-400 rounded-lg border border-slate-800 transition-colors"
                    title="تعديل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 bg-slate-900 hover:bg-red-950 text-red-400 rounded-lg border border-slate-800 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* =============================================================== */}
          {/* أسفل صفحة الشروط: إضافة مجموعة متشابهة أخرى لنفس الشروط          */}
          {/* =============================================================== */}
          <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-800/40 rounded-xl space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-900/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {isRtl ? 'إضافة مجموعة متشابهة أخرى لنفس الشروط' : 'Add Similar Group for Same Conditions'}
                  </h4>
                  <p className="text-[11px] text-indigo-300/80">
                    {isRtl 
                      ? 'تكرار نفس معاملات الكرتون والباكت والوحدة المعرفة لنطاق كود/باركود جديد وتوحيدها بكل الخدمات' 
                      : 'Clone packaging and conversion factors to another barcode range'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Select Base Rule */}
              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRtl ? '1. اختر شروط المجموعة المراد تكرارها وتطبيقها:' : 'Select Base Group to Clone:'}
                </label>
                <select
                  value={selectedBaseRuleId}
                  onChange={(e) => setSelectedBaseRuleId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {ruleList.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — [كرتون {r.cartonFactor} / باكت {r.packFactor} / الوحدة المعرفة: {r.systemUnit || r.unitName}]
                    </option>
                  ))}
                </select>
              </div>

              {/* New Group Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRtl ? '2. اسم المجموعة المتشابهة الجديدة:' : 'New Group Name:'}
                </label>
                <input
                  type="text"
                  value={similarGroupName}
                  onChange={(e) => setSimilarGroupName(e.target.value)}
                  placeholder={selectedBaseRule ? `مثال: ${selectedBaseRule.name} - تشغيلة جديدة` : 'اسم المجموعة...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Start Barcode */}
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  {isRtl ? '3. من بداية كود / باركود:' : 'Start Barcode:'}
                </label>
                <input
                  type="text"
                  value={similarStartBarcode}
                  onChange={(e) => setSimilarStartBarcode(e.target.value)}
                  placeholder="مثال: 6223000100"
                  className="w-full bg-slate-900 border border-emerald-600/50 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* End Barcode */}
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  {isRtl ? '4. إلى نهاية كود / باركود:' : 'End Barcode:'}
                </label>
                <input
                  type="text"
                  value={similarEndBarcode}
                  onChange={(e) => setSimilarEndBarcode(e.target.value)}
                  placeholder="مثال: 6223000999"
                  className="w-full bg-slate-900 border border-emerald-600/50 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Cloned Summary Preview */}
            {selectedBaseRule && (
              <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3 text-slate-400">
                  <span>الشروط الموروثة:</span>
                  <span className="text-amber-300 font-bold">الوحدة المعرفة: {selectedBaseRule.systemUnit || selectedBaseRule.unitName}</span>
                  <span className="text-amber-300 font-semibold">الكرتون: {selectedBaseRule.cartonFactor} {selectedBaseRule.unitName}</span>
                  <span className="text-indigo-300 font-semibold">الباكت: {selectedBaseRule.packFactor} {selectedBaseRule.unitName}</span>
                  {selectedBaseRule.category && <span className="text-slate-300">الفئة: {selectedBaseRule.category}</span>}
                </div>

                <button
                  onClick={handleAddSimilarGroup}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isRtl ? 'إضافة المجموعة وتفعيل نفس الشروط وتوحيدها ⚡' : 'Add & Apply Identical Rules'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isRtl ? 'تطبق الشروط فورياً في الجرد، الاستلام، المراجعة وقوائم الانتقاء.' : 'Rules take effect immediately across all warehouse operations.'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
