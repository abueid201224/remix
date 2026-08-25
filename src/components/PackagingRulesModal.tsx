import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import type { PackagingGroupRule } from '../types';
import { savePackagingGroupRules } from '../services/db';

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

  // New Rule Form State
  const [formState, setFormState] = useState<{
    name: string;
    startBarcode: string;
    endBarcode: string;
    category: string;
    cartonFactor: number;
    packFactor: number;
    unitName: string;
    notes: string;
  }>({
    name: '',
    startBarcode: '',
    endBarcode: '',
    category: '',
    cartonFactor: 24,
    packFactor: 6,
    unitName: 'حبة',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSaveRule = async () => {
    if (!formState.name.trim() || !formState.startBarcode.trim() || !formState.endBarcode.trim()) {
      alert('يرجى كتابة اسم المجموعة وبداية ونهاية نطاق الباركود.');
      return;
    }

    let updated: PackagingGroupRule[];
    if (editingId) {
      updated = ruleList.map(r => r.id === editingId ? {
        ...r,
        ...formState,
      } : r);
    } else {
      const newRule: PackagingGroupRule = {
        id: `rule-${Date.now()}`,
        ...formState,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      updated = [newRule, ...ruleList];
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
      notes: rule.notes || '',
    });
    setIsAddingNew(true);
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف شرط ضم العبوات هذا؟')) {
      const updated = ruleList.filter(r => r.id !== id);
      setRuleList(updated);
      onUpdateRules(updated);
      await savePackagingGroupRules(updated);
    }
  };

  const handleToggleActive = async (id: string) => {
    const updated = ruleList.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    setRuleList(updated);
    onUpdateRules(updated);
    await savePackagingGroupRules(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4 my-8"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {isRtl ? 'شروط ضم المنتجات في مجموعات متشابهة العبوة' : 'Packaging Grouping & Barcode Range Rules'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'تحديد نطاقات الباركود (من إلى) ومعاملات تحويل الكراتين والباكتات لجرد المخزون وحساب الفعلي تلقائياً' 
                  : 'Define barcode range rules (Start to End Barcode) & package conversion factors for inventory'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Add / Edit Form */}
          {isAddingNew ? (
            <div className="bg-slate-950 border border-indigo-900/50 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-indigo-300">
                  {editingId ? (isRtl ? 'تعديل شرط المجموعة' : 'Edit Packaging Rule') : (isRtl ? 'إضافة شرط مجموعة عبوات جديد' : 'Add New Packaging Rule')}
                </span>
                <button
                  onClick={() => { setIsAddingNew(false); setEditingId(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المجموعة العبوية</label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: مجموعة العصائر 250 مل (كرتون 24 / باكت 6)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">باركود البداية (من)</label>
                  <input
                    type="text"
                    value={formState.startBarcode}
                    onChange={(e) => setFormState(prev => ({ ...prev, startBarcode: e.target.value }))}
                    placeholder="مثال: 6221000100"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">باركود النهاية (إلى)</label>
                  <input
                    type="text"
                    value={formState.endBarcode}
                    onChange={(e) => setFormState(prev => ({ ...prev, endBarcode: e.target.value }))}
                    placeholder="مثال: 6221000199"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">معامل الكرتونة (حبة/كرتون)</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.cartonFactor}
                    onChange={(e) => setFormState(prev => ({ ...prev, cartonFactor: Number(e.target.value) || 1 }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">معامل الباكت / الشد (حبة/باكت)</label>
                  <input
                    type="number"
                    min="1"
                    value={formState.packFactor}
                    onChange={(e) => setFormState(prev => ({ ...prev, packFactor: Number(e.target.value) || 1 }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">اسم الوحدة الفردية</label>
                  <input
                    type="text"
                    value={formState.unitName}
                    onChange={(e) => setFormState(prev => ({ ...prev, unitName: e.target.value }))}
                    placeholder="حبة / علبة / قطعة"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">التصنيف / الفئة (اختياري)</label>
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(e) => setFormState(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="مشروبات / منظفات / أغذية"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleSaveRule}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>{isRtl ? 'حفظ شرط المجموعة' : 'Save Packaging Rule'}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? 'إضافة شرط مجموعة جديد (نطاق باركود وتفاصيل عبوات)' : 'Add New Packaging Group Rule'}</span>
            </button>
          )}

          {/* List of Rules */}
          <div className="space-y-3">
            {ruleList.map(rule => (
              <div 
                key={rule.id} 
                className={`p-3.5 bg-slate-950/80 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  rule.isActive ? 'border-slate-800' : 'border-slate-800/40 opacity-50'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{rule.name}</span>
                    {rule.category && (
                      <span className="text-[10px] bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-semibold">
                        {rule.category}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${rule.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                      {rule.isActive ? 'مفعّل' : 'معطّل'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      النطاق: {rule.startBarcode} ⟵ {rule.endBarcode}
                    </span>
                    <span className="text-amber-300 font-semibold">
                      الكرتونة: {rule.cartonFactor} {rule.unitName}
                    </span>
                    <span className="text-indigo-300 font-semibold">
                      الباكت: {rule.packFactor} {rule.unitName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleActive(rule.id)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-xs border border-slate-800"
                  >
                    {rule.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button
                    onClick={() => handleStartEdit(rule)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-400 rounded border border-slate-800"
                    title="تعديل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 bg-slate-900 hover:bg-red-950 text-red-400 rounded border border-slate-800"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
