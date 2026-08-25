import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Boxes,
  ScanLine,
  Tag,
  ArrowRightLeft,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  Trash2,
  Settings,
  Printer,
  ChevronRight,
  Info,
  Pin
} from 'lucide-react';
import type { AppSettings, InventoryCountItem, PackagingGroupRule, ActiveTargetColumn } from '../types';
import { SoundEffects } from '../services/audio';

interface FastCountPanelProps {
  activeGroup: PackagingGroupRule | null;
  groups: PackagingGroupRule[];
  onSelectGroup: (group: PackagingGroupRule) => void;
  items: InventoryCountItem[];
  onUpdateCount: (id: string, updates: Partial<InventoryCountItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItemToGroup: (itemCode: string, itemName?: string) => void;
  onOpenBarcodeTags: () => void;
  onOpenRulesModal: () => void;
  activeTargetColumn?: ActiveTargetColumn;
  onChangeTargetColumn?: (col: ActiveTargetColumn) => void;
  isRtl: boolean;
  settings: AppSettings;
}

export const FastCountPanel: React.FC<FastCountPanelProps> = ({
  activeGroup,
  groups,
  onSelectGroup,
  items,
  onUpdateCount,
  onDeleteItem,
  onAddItemToGroup,
  onOpenBarcodeTags,
  onOpenRulesModal,
  activeTargetColumn = 'pieces',
  onChangeTargetColumn,
  isRtl,
  settings,
}) => {
  const [fastScanInput, setFastScanInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [switchAlert, setSwitchAlert] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Group items
  const groupItems = activeGroup 
    ? items.filter(i => i.groupId === activeGroup.id || i.groupName === activeGroup.name)
    : [];

  const filteredGroupItems = groupItems.filter(i => 
    !quickSearch || 
    i.itemCode.toLowerCase().includes(quickSearch.toLowerCase()) || 
    i.itemName.toLowerCase().includes(quickSearch.toLowerCase())
  );

  // Auto-select first item if current selection is invalid
  useEffect(() => {
    if (groupItems.length > 0) {
      if (!selectedItemId || !groupItems.some(i => i.id === selectedItemId)) {
        setSelectedItemId(groupItems[0].id);
      }
    } else {
      setSelectedItemId(null);
    }
  }, [activeGroup, groupItems, selectedItemId]);

  const selectedItem = groupItems.find(i => i.id === selectedItemId);

  // Handle Fast Scan (Group switch or Item increment according to locked target column)
  const handleFastScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = fastScanInput.trim();
    if (!clean) return;

    // 1. Check if scan is a Group Barcode (e.g. GRP-rule-id, rule ID, start/end barcode)
    const matchedGroup = groups.find(g => 
      g.id.toLowerCase() === clean.toLowerCase() ||
      `grp-${g.id.toLowerCase()}` === clean.toLowerCase() ||
      String(g.startBarcode).trim() === clean ||
      String(g.endBarcode).trim() === clean ||
      g.name.toLowerCase().includes(clean.toLowerCase())
    );

    if (matchedGroup) {
      onSelectGroup(matchedGroup);
      setSwitchAlert(`تم التبديل السريع إلى: ${matchedGroup.name}`);
      setTimeout(() => setSwitchAlert(null), 3500);
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      setFastScanInput('');
      return;
    }

    // 2. Check if barcode belongs to another group's range
    const rangeMatchedGroup = groups.find(g => {
      if (!g.isActive) return false;
      const start = String(g.startBarcode || '').trim();
      const end = String(g.endBarcode || '').trim();
      if (start && end) {
        if (/^\d+$/.test(clean) && /^\d+$/.test(start) && /^\d+$/.test(end)) {
          const numVal = BigInt(clean);
          return numVal >= BigInt(start) && numVal <= BigInt(end);
        }
        return clean >= start && clean <= end;
      }
      return false;
    });

    if (rangeMatchedGroup && activeGroup && rangeMatchedGroup.id !== activeGroup.id) {
      onSelectGroup(rangeMatchedGroup);
      setSwitchAlert(`تم رصد صنف يتبع ${rangeMatchedGroup.name} - تم تبديل المجموعة تلقائياً!`);
      setTimeout(() => setSwitchAlert(null), 4000);
      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
    }

    // 3. Increment item count according to locked activeTargetColumn
    const existingInGroup = groupItems.find(i => i.itemCode.toLowerCase() === clean.toLowerCase());
    if (existingInGroup) {
      setSelectedItemId(existingInGroup.id);
      const updates: Partial<InventoryCountItem> = {
        lastScannedAt: new Date().toISOString()
      };
      if (activeTargetColumn === 'cartons') {
        updates.cartonsCount = existingInGroup.cartonsCount + 1;
      } else if (activeTargetColumn === 'packs') {
        updates.packsCount = existingInGroup.packsCount + 1;
      } else {
        updates.piecesCount = existingInGroup.piecesCount + 1;
      }
      onUpdateCount(existingInGroup.id, updates);
      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
    } else {
      // Add new item into active group
      onAddItemToGroup(clean);
      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
    }

    setFastScanInput('');
  };

  // Group summary calculations
  const groupTotalBook = groupItems.reduce((acc, i) => acc + i.bookQty, 0);
  const groupTotalActual = groupItems.reduce((acc, i) => acc + i.calculatedActualQty, 0);
  const groupTotalVariance = groupTotalActual - groupTotalBook;
  const groupExactCount = groupItems.filter(i => i.status === 'EXACT').length;

  return (
    <div className="space-y-4">
      {/* 1. FAST GROUP SWITCHER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 animate-pulse">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {isRtl ? 'وضع الجرد السريع بالمجموعات العبوية' : 'Fast Packaging Group Count Mode'}
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                  {isRtl ? 'تبديل فوري بالباركود' : 'Instant Barcode Switch'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRtl 
                  ? 'امسح باركود أي مجموعة للتبديل الفوري وظهور تفصيل وتجميع عبواتها، ثم أدخل الكميات بالكرتون والباكت والحبة' 
                  : 'Scan group barcode to instantly switch & inspect customized packaging factors'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBarcodeTags}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all shadow-sm"
              title="عرض وطباعة بطاقات باركود المجموعات لتثبيتها على الأرفف"
            >
              <Tag className="w-4 h-4 text-indigo-400" />
              <span>{isRtl ? 'بطاقات الرفوف (طباعة Barcodes)' : 'Shelf Barcodes'}</span>
            </button>

            <button
              onClick={onOpenRulesModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span>{isRtl ? 'إدارة الشروط' : 'Rules'}</span>
            </button>
          </div>
        </div>

        {/* Barcode Quick Scanner Box for Fast Switch */}
        <form onSubmit={handleFastScanSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="w-4 h-4 text-amber-400 absolute left-3 top-3 rtl:left-auto rtl:right-3" />
            <input
              ref={scanInputRef}
              type="text"
              value={fastScanInput}
              onChange={(e) => setFastScanInput(e.target.value)}
              placeholder={isRtl ? 'امسح باركود المجموعة (GRP-xxx) أو أي صنف بالرف للتبديل الفوري...' : 'Scan group code or item barcode...'}
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-amber-500 rounded-xl pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all whitespace-nowrap"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isRtl ? 'مسح / تبديل' : 'Switch'}</span>
          </button>
        </form>

        {/* Instant Switch Toast Notice */}
        {switchAlert && (
          <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{switchAlert}</span>
          </div>
        )}

        {/* Group Selector Pill Carousel */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
            <span>{isRtl ? 'المجموعات المسجلة بالنظام (اضغط للتبديل السريع):' : 'Registered Packaging Groups:'}</span>
            <span className="text-[10px] text-slate-500 font-mono">{groups.length} مجموعات</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {groups.map((group) => {
              const isSelected = activeGroup?.id === group.id;
              const countInGroup = items.filter(i => i.groupId === group.id || i.groupName === group.name).length;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Boxes className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span>{group.name}</span>
                  <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-400 font-mono">
                    ك{group.cartonFactor}/ب{group.packFactor}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-amber-500 text-black font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {countInGroup}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. ACTIVE GROUP CUSTOMIZED PACKAGING BREAKDOWN CARD */}
      {activeGroup ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border-2 border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold bg-amber-500 text-black px-2 py-0.5 rounded font-mono">
                  المجموعة النشطة حالياً
                </span>
                <h3 className="text-base font-black text-white">{activeGroup.name}</h3>
                {activeGroup.category && (
                  <span className="text-xs bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-700">
                    {activeGroup.category}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                <span>نطاق الباركود: <span className="font-mono font-bold text-amber-300">{activeGroup.startBarcode} ➔ {activeGroup.endBarcode}</span></span>
                <span>كود المسح السريع: <span className="font-mono font-bold text-indigo-300">GRP-{activeGroup.id}</span></span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">الأصناف بالمجموعة:</span>
              <span className="text-sm font-black text-white font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {groupItems.length} صنف
              </span>
            </div>
          </div>

          {/* CUSTOMIZED PACKAGING MULTIPLIERS (تفصيل العبوات المخصصة للمجموعة) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <div className="text-[11px] text-amber-400 font-bold">معامل الكرتونة (Carton Factor)</div>
                <div className="text-xs text-slate-400">عدد القطع في كل كرتونة ماستر</div>
              </div>
              <div className="text-xl font-black text-amber-300 font-mono bg-amber-950/50 px-3 py-1 rounded-lg border border-amber-700/50">
                {activeGroup.cartonFactor} <span className="text-xs font-normal text-amber-400">{activeGroup.unitName}</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <div className="text-[11px] text-indigo-300 font-bold">معامل الباكت (Pack Factor)</div>
                <div className="text-xs text-slate-400">عدد القطع في كل باكت/شيرينك</div>
              </div>
              <div className="text-xl font-black text-indigo-300 font-mono bg-indigo-950/50 px-3 py-1 rounded-lg border border-indigo-700/50">
                {activeGroup.packFactor} <span className="text-xs font-normal text-indigo-400">{activeGroup.unitName}</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <div className="text-[11px] text-emerald-400 font-bold">الوحدة الأساسية (Base Unit)</div>
                <div className="text-xs text-slate-400">وحدة الجرد والحساب الفعلي</div>
              </div>
              <div className="text-xl font-black text-emerald-300 font-mono bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-700/50">
                {activeGroup.unitName}
              </div>
            </div>
          </div>

          {/* Group KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center pt-1">
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400 font-semibold">الدفترى للمجموعة</div>
              <div className="text-sm font-black text-white font-mono">{groupTotalBook}</div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-indigo-300 font-semibold">الفعلي المحتسب</div>
              <div className="text-sm font-black text-indigo-300 font-mono">{groupTotalActual}</div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-amber-400 font-semibold">الفارق الصافي</div>
              <div className={`text-sm font-black font-mono ${
                groupTotalVariance === 0 ? 'text-emerald-400' : groupTotalVariance > 0 ? 'text-purple-400' : 'text-amber-400'
              }`}>
                {groupTotalVariance > 0 ? `+${groupTotalVariance}` : groupTotalVariance}
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
              <div className="text-[10px] text-emerald-400 font-semibold">الأصناف المطابقة</div>
              <div className="text-sm font-black text-emerald-400 font-mono">
                {groupExactCount} / {groupItems.length}
              </div>
            </div>
          </div>

          {/* 3. QUICK PACKAGING COUNTER CONTROLLER (لوحة الإدخال والاحتساب السريع للصنف المحدد) */}
          {selectedItem && (
            <div className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded">الصنف المحدد للجرد:</span>
                  <span className="font-black text-white text-xs">{selectedItem.itemName}</span>
                  <span className="text-xs font-mono text-indigo-300">({selectedItem.itemCode})</span>
                </div>
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <span>الدفترى: <strong className="font-mono text-white">{selectedItem.bookQty}</strong></span>
                  <span>|</span>
                  <span>الفعلي: <strong className="font-mono text-indigo-300">{selectedItem.calculatedActualQty}</strong></span>
                  <span>|</span>
                  <span className={selectedItem.varianceQty === 0 ? 'text-emerald-400 font-bold' : selectedItem.varianceQty > 0 ? 'text-purple-400 font-bold' : 'text-amber-400 font-bold'}>
                    الفارق: {selectedItem.varianceQty > 0 ? `+${selectedItem.varianceQty}` : selectedItem.varianceQty}
                  </span>
                </div>
              </div>

              {/* Quick Stepper Counter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cartons Counter */}
                <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">📦 عدد الكراتين (×{selectedItem.cartonFactor})</span>
                    <span className="text-xs font-mono font-black text-white">{selectedItem.cartonsCount * selectedItem.cartonFactor} حبة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { cartonsCount: Math.max(0, selectedItem.cartonsCount - 1) })}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={selectedItem.cartonsCount}
                      onChange={(e) => onUpdateCount(selectedItem.id, { cartonsCount: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-amber-300 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { cartonsCount: selectedItem.cartonsCount + 1 })}
                      className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { cartonsCount: selectedItem.cartonsCount + 5 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded"
                    >
                      +5 كرتونة
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { cartonsCount: selectedItem.cartonsCount + 10 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded"
                    >
                      +10 كرتونة
                    </button>
                  </div>
                </div>

                {/* Packs Counter */}
                <div className="bg-slate-900 border border-indigo-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300">📦 عدد الباكتات (×{selectedItem.packFactor})</span>
                    <span className="text-xs font-mono font-black text-white">{selectedItem.packsCount * selectedItem.packFactor} حبة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { packsCount: Math.max(0, selectedItem.packsCount - 1) })}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={selectedItem.packsCount}
                      onChange={(e) => onUpdateCount(selectedItem.id, { packsCount: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-indigo-300 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { packsCount: selectedItem.packsCount + 1 })}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { packsCount: selectedItem.packsCount + 2 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold rounded"
                    >
                      +2 باكت
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { packsCount: selectedItem.packsCount + 5 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold rounded"
                    >
                      +5 باكت
                    </button>
                  </div>
                </div>

                {/* Loose Pieces Counter */}
                <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">🍬 حبات وقطع فردية (Loose)</span>
                    <span className="text-xs font-mono font-black text-white">{selectedItem.piecesCount} حبة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { piecesCount: Math.max(0, selectedItem.piecesCount - 1) })}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={selectedItem.piecesCount}
                      onChange={(e) => onUpdateCount(selectedItem.id, { piecesCount: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 text-center font-mono font-bold text-emerald-300 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { piecesCount: selectedItem.piecesCount + 1 })}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { piecesCount: selectedItem.piecesCount + 1 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded"
                    >
                      +1 حبة
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateCount(selectedItem.id, { piecesCount: selectedItem.piecesCount + 5 })}
                      className="flex-1 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded"
                    >
                      +5 حبات
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Formula Explanation Banner */}
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300 flex items-center justify-between">
                <span>معادلة الاحتساب الآلي:</span>
                <span className="font-mono font-bold text-indigo-300">
                  ({selectedItem.cartonsCount} كرتونة × {selectedItem.cartonFactor}) + ({selectedItem.packsCount} باكت × {selectedItem.packFactor}) + {selectedItem.piecesCount} حبات = <strong className="text-white text-xs underline">{selectedItem.calculatedActualQty} حبة فعلية</strong>
                </span>
              </div>
            </div>
          )}

          {/* 4. GROUP ITEMS TABLE WITH INSTANT HIGHLIGHT */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="بحث سريع داخل أصناف هذه المجموعة..."
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="text-xs text-slate-400">
                أصناف المجموعة: {filteredGroupItems.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-300 text-right">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">اختيار</th>
                    <th className="p-2.5">الباركود والصنف</th>
                    <th className="p-2.5 text-center">الرصيد الدفتري</th>
                    
                    {/* TOUCH CLICKABLE HEADER: Cartons */}
                    <th 
                      onClick={() => {
                        if (onChangeTargetColumn) onChangeTargetColumn('cartons');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`p-2.5 text-center cursor-pointer transition-all ${
                        activeTargetColumn === 'cartons'
                          ? 'bg-amber-500/30 text-amber-300 border-b-2 border-amber-400 font-black'
                          : 'text-amber-300/80 hover:bg-slate-800 hover:text-amber-300'
                      }`}
                      title="المس لتثبيت تسجيل المسح في عمود الكراتين"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {activeTargetColumn === 'cartons' && <Pin className="w-3 h-3 text-amber-400 animate-bounce" />}
                        <span>الكراتين (×{activeGroup.cartonFactor})</span>
                      </div>
                    </th>

                    {/* TOUCH CLICKABLE HEADER: Packs */}
                    <th 
                      onClick={() => {
                        if (onChangeTargetColumn) onChangeTargetColumn('packs');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`p-2.5 text-center cursor-pointer transition-all ${
                        activeTargetColumn === 'packs'
                          ? 'bg-indigo-500/30 text-indigo-200 border-b-2 border-indigo-400 font-black'
                          : 'text-indigo-300/80 hover:bg-slate-800 hover:text-indigo-300'
                      }`}
                      title="المس لتثبيت تسجيل المسح في عمود الباكتات"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {activeTargetColumn === 'packs' && <Pin className="w-3 h-3 text-indigo-400 animate-bounce" />}
                        <span>الباكتات (×{activeGroup.packFactor})</span>
                      </div>
                    </th>

                    {/* TOUCH CLICKABLE HEADER: Loose Pieces */}
                    <th 
                      onClick={() => {
                        if (onChangeTargetColumn) onChangeTargetColumn('pieces');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`p-2.5 text-center cursor-pointer transition-all ${
                        activeTargetColumn === 'pieces'
                          ? 'bg-emerald-500/30 text-emerald-200 border-b-2 border-emerald-400 font-black'
                          : 'text-emerald-300/80 hover:bg-slate-800 hover:text-emerald-300'
                      }`}
                      title="المس لتثبيت تسجيل المسح في عمود الحبات"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {activeTargetColumn === 'pieces' && <Pin className="w-3 h-3 text-emerald-400 animate-bounce" />}
                        <span>حبات فردية</span>
                      </div>
                    </th>

                    <th className="p-2.5 text-center font-bold text-white bg-slate-900">الفعلي المحتسب</th>
                    <th className="p-2.5 text-center">الفارق</th>
                    <th className="p-2.5 text-center">الحالة</th>
                    <th className="p-2.5 text-center w-8">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredGroupItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-500">
                        لا توجد أصناف مسجلة تحت هذه المجموعة بعد. امسح باركود صنف يقع ضمن النطاق ({activeGroup.startBarcode} ➔ {activeGroup.endBarcode}) لإضافته فوراً.
                      </td>
                    </tr>
                  ) : (
                    filteredGroupItems.map(item => {
                      const isRowSelected = selectedItemId === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`cursor-pointer transition-colors ${
                            isRowSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="radio"
                              checked={isRowSelected}
                              onChange={() => setSelectedItemId(item.id)}
                              className="accent-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-white font-mono">{item.itemCode}</div>
                            <div className="text-[11px] text-slate-400">{item.itemName}</div>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-200">
                            {item.bookQty}
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.cartonsCount}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onUpdateCount(item.id, { cartonsCount: Number(e.target.value) || 0 })}
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-amber-300 text-xs"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.packsCount}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onUpdateCount(item.id, { packsCount: Number(e.target.value) || 0 })}
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-indigo-300 text-xs"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.piecesCount}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onUpdateCount(item.id, { piecesCount: Number(e.target.value) || 0 })}
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-emerald-300 text-xs"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono font-black text-sm text-white bg-slate-900">
                            {item.calculatedActualQty}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            <span className={item.varianceQty === 0 ? 'text-emerald-400' : item.varianceQty > 0 ? 'text-purple-400' : 'text-amber-400'}>
                              {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              item.status === 'EXACT'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : item.status === 'SHORTAGE'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}>
                              {item.status === 'EXACT' ? 'مطابق' : item.status === 'SHORTAGE' ? 'عجز' : 'زيادة'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteItem(item.id);
                              }}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
          يرجى اختيار أو مسح باركود إحدى المجموعات العبوية لتفعيل وضع الجرد السريع.
        </div>
      )}
    </div>
  );
};
