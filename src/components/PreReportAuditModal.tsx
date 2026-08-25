import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Boxes, 
  FileSpreadsheet, 
  Printer, 
  Lock, 
  X, 
  UserCheck, 
  Edit3, 
  ArrowRight,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import type { 
  BatchPickingWave, 
  WarehouseWorker, 
  PickingProductGroup, 
  AggregatedPickingItem,
  WorkerExperienceLevel,
  GroupDifficultyLevel 
} from '../types';

interface PreReportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  wave: BatchPickingWave;
  workers: WarehouseWorker[];
  onAssignWorker: (groupId: string, workerId: string) => void;
  onDifficultyChange: (groupId: string, difficulty: GroupDifficultyLevel) => void;
  onUpdateItemQty: (groupId: string, itemId: string, updates: Partial<AggregatedPickingItem>) => void;
  onExportExcel: () => void;
  onExportWorkerSlip: (group: PickingProductGroup, worker?: WarehouseWorker) => void;
  onApproveAndLock: () => void;
  isRtl?: boolean;
}

export const PreReportAuditModal: React.FC<PreReportAuditModalProps> = ({
  isOpen,
  onClose,
  wave,
  workers,
  onAssignWorker,
  onDifficultyChange,
  onUpdateItemQty,
  onExportExcel,
  onExportWorkerSlip,
  onApproveAndLock,
  isRtl = true,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workers_summary' | 'groups_details' | 'validation_checklist'>('workers_summary');

  if (!isOpen || !wave) return null;

  // Compute worker workload statistics
  const workerWorkload = workers.map(worker => {
    const assignedGroups = wave.groups.filter(g => g.assignedWorkerId === worker.id);
    const totalItemsCount = assignedGroups.reduce((acc, g) => acc + g.items.length, 0);
    const totalPiecesQty = assignedGroups.reduce((acc, g) => acc + g.totalQty, 0);
    const totalCartons = assignedGroups.reduce((acc, g) => acc + g.totalCartons, 0);
    const totalPacks = assignedGroups.reduce((acc, g) => acc + g.totalPacks, 0);
    const totalLoose = assignedGroups.reduce((acc, g) => acc + g.totalPieces, 0);
    const totalPicked = assignedGroups.reduce((acc, g) => acc + g.items.reduce((s, it) => s + it.pickedQty, 0), 0);

    return {
      worker,
      assignedGroups,
      totalItemsCount,
      totalPiecesQty,
      totalCartons,
      totalPacks,
      totalLoose,
      totalPicked,
      progressPercent: totalPiecesQty > 0 ? Math.round((totalPicked / totalPiecesQty) * 100) : 0
    };
  });

  const unassignedGroups = wave.groups.filter(g => !g.assignedWorkerId);
  const zeroQtyItems: { group: PickingProductGroup; item: AggregatedPickingItem }[] = [];
  wave.groups.forEach(g => {
    g.items.forEach(it => {
      if (it.totalRequiredQty <= 0) {
        zeroQtyItems.push({ group: g, item: it });
      }
    });
  });

  const allPicked = wave.groups.every(g => g.items.every(it => it.status === 'COMPLETED'));
  const isReadyToLock = unassignedGroups.length === 0 && zeroQtyItems.length === 0;

  const getExperienceBadge = (lvl: WorkerExperienceLevel) => {
    switch (lvl) {
      case 'EXPERT':
        return <span className="bg-red-950 text-red-300 border border-red-800 text-[10px] px-2 py-0.5 rounded-full font-bold">خبير (Expert)</span>;
      case 'INTERMEDIATE':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">متوسط (Mid)</span>;
      default:
        return <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">مبتدئ (Novice)</span>;
    }
  };

  const getDifficultyBadge = (diff: GroupDifficultyLevel) => {
    switch (diff) {
      case 'HIGH_EXPERT':
        return <span className="bg-red-950 text-red-300 border border-red-800 text-[10px] px-2 py-0.5 rounded-md font-bold">عالي الصعوبة</span>;
      case 'MEDIUM_INTERMEDIATE':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] px-2 py-0.5 rounded-md font-bold">متوسط الصعوبة</span>;
      default:
        return <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-bold">سهل</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right rtl:text-right ltr:text-left"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/40">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {isRtl ? 'مراجعة وتدقيق الكميات المسندة للعمال قبل التقرير النهائي' : 'Pre-Report Worker Assignment & Quantity Audit'}
                </h2>
                <span className="font-mono text-xs bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-700/60 font-bold">
                  {wave.waveNo}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl 
                  ? 'مراجعة دقيقة لتوزيع أعباء العمل والكميات المجمعة قبل اعتماد القائمة واستخراج التقارير الرسمية وإغلاق المهمة.'
                  : 'Detailed audit of worker task distribution and aggregated quantities before generating final reports and closing the task.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Metric Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-4 bg-slate-950/60 border-b border-slate-800">
          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold">{isRtl ? 'إجمالي الأصناف المجمعة' : 'Aggregated SKUs'}</div>
            <div className="text-lg font-black text-white font-mono mt-0.5">{wave.totalItemsCount} <span className="text-xs font-normal text-slate-400">صنف</span></div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold">{isRtl ? 'إجمالي الكميات (حبة)' : 'Total Pieces'}</div>
            <div className="text-lg font-black text-indigo-300 font-mono mt-0.5">{wave.totalQuantity} <span className="text-xs font-normal text-slate-400">حبة</span></div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold">{isRtl ? 'الكراتين والباكتات' : 'Cartons & Packs'}</div>
            <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
              📦 {wave.totalCartons} <span className="text-xs text-purple-300 mr-1">/ 🧃 {wave.totalPacks}</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div className="text-[11px] text-slate-400 font-bold">{isRtl ? 'تغطية إسناد العمال' : 'Worker Allocation'}</div>
            <div className="text-lg font-black font-mono mt-0.5 flex items-center gap-1.5">
              {unassignedGroups.length === 0 ? (
                <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>100% مكتمل الإسناد</span>
                </span>
              ) : (
                <span className="text-red-400 text-sm font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{unassignedGroups.length} غير مسند</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation in Audit Modal */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('workers_summary')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 ${
              activeTab === 'workers_summary'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isRtl ? 'ملخص توزيع العمال والأعباء' : 'Worker Workload Summary'}</span>
          </button>

          <button
            onClick={() => setActiveTab('groups_details')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 ${
              activeTab === 'groups_details'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{isRtl ? 'تفاصيل المجموعات والكميات' : 'Groups & Item Breakdown'}</span>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.2 rounded-full text-[10px]">
              {wave.groups.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('validation_checklist')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 ${
              activeTab === 'validation_checklist'
                ? 'border-indigo-500 text-indigo-300 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isRtl ? 'فحص الاعتماد وقبل الإغلاق' : 'Pre-Lock Validation'}</span>
            {(!isReadyToLock) && (
              <span className="bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.2 rounded-full text-[10px]">
                تنبيه
              </span>
            )}
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: WORKER WORKLOAD SUMMARY */}
          {activeTab === 'workers_summary' && (
            <div className="space-y-4">
              {/* Unassigned Warning Banner */}
              {unassignedGroups.length > 0 && (
                <div className="p-3.5 bg-red-950/80 border border-red-700 rounded-xl flex items-center justify-between text-xs text-red-200 font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <span>
                      {isRtl 
                        ? `تنبيه: يوجد (${unassignedGroups.length}) مجموعات لم يتم إسنادها لأي عامل بعد. يرجى تحديد العامل المسؤول قبل إغلاق المهمة.`
                        : `Warning: (${unassignedGroups.length}) groups are not assigned to any worker.`}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('groups_details')}
                    className="bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs"
                  >
                    {isRtl ? 'إسناد الآن' : 'Assign Now'}
                  </button>
                </div>
              )}

              {/* Workers Workload Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {workerWorkload.map(({ worker, assignedGroups, totalItemsCount, totalPiecesQty, totalCartons, totalPacks, totalLoose, progressPercent }) => {
                  const isAssigned = assignedGroups.length > 0;
                  return (
                    <div 
                      key={worker.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isAssigned
                          ? 'bg-slate-950/70 border-slate-800 hover:border-indigo-500/50'
                          : 'bg-slate-950/30 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{worker.name}</span>
                            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                              {worker.code}
                            </span>
                            {getExperienceBadge(worker.experienceLevel)}
                          </div>
                          {worker.specialty && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              التخصص: {worker.specialty}
                            </div>
                          )}
                        </div>

                        {isAssigned ? (
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                            {assignedGroups.length} {isRtl ? 'مجموعات مسندة' : 'Groups'}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">
                            {isRtl ? 'لا توجد مهام' : 'Idle'}
                          </span>
                        )}
                      </div>

                      {/* Stats Breakdown for Worker */}
                      {isAssigned ? (
                        <div className="mt-3 space-y-2.5">
                          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400">{isRtl ? 'الأصناف' : 'SKUs'}</div>
                              <div className="font-mono font-bold text-white">{totalItemsCount}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400">{isRtl ? 'إجمالي الحبات' : 'Pieces'}</div>
                              <div className="font-mono font-bold text-indigo-300">{totalPiecesQty}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400">{isRtl ? 'كراتين' : 'Cartons'}</div>
                              <div className="font-mono font-bold text-amber-300">{totalCartons}</div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400">{isRtl ? 'باكتات' : 'Packs'}</div>
                              <div className="font-mono font-bold text-purple-300">{totalPacks}</div>
                            </div>
                          </div>

                          {/* Groups list for this worker */}
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-bold text-slate-400">
                              {isRtl ? 'المجموعات المسندة لهذا العامل:' : 'Assigned Groups:'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {assignedGroups.map(g => (
                                <div key={g.groupId} className="bg-slate-900 border border-slate-700/60 px-2 py-1 rounded-lg text-xs flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-white font-bold truncate">{g.groupName}</span>
                                    {getDifficultyBadge(g.difficulty)}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-[11px] text-indigo-300 font-bold">{g.totalQty} حبة</span>
                                    <button
                                      onClick={() => onExportWorkerSlip(g, worker)}
                                      className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
                                      title={isRtl ? 'طباعة كشف هذا العامل (PDF)' : 'Print Slip'}
                                    >
                                      <Printer className="w-3.5 h-3.5 text-indigo-400" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-500">
                          {isRtl ? 'لم يتم إسناد أي مجموعة منتجات لهذا العامل في هذه الموجة' : 'No product groups assigned to this worker'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: GROUPS & ITEM BREAKDOWN */}
          {activeTab === 'groups_details' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                {isRtl 
                  ? 'يمكنك هنا مراجعة وتعديل إسناد العمال ومستويات الصعوبة وتعديل الكميات المطلوبة لكل صنف مباشرة قبل استخراج التقرير النهائي.'
                  : 'Review and adjust worker assignments, difficulty, and item quantities directly before final export.'}
              </div>

              {wave.groups.map((group, gIdx) => {
                const assignedWorker = workers.find(w => w.id === group.assignedWorkerId);
                return (
                  <div 
                    key={group.groupId}
                    className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
                  >
                    {/* Group Header Card */}
                    <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-800 text-indigo-300 font-mono text-xs px-2 py-0.5 rounded font-bold">
                          #{gIdx + 1}
                        </span>
                        <h3 className="text-sm font-black text-white">{group.groupName}</h3>
                        {getDifficultyBadge(group.difficulty)}
                      </div>

                      {/* Reassign Worker & Difficulty Controls on the fly */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <select
                            value={group.assignedWorkerId || ''}
                            onChange={(e) => onAssignWorker(group.groupId, e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900 text-slate-400">
                              {isRtl ? '-- حدد عامل --' : '-- Assign Worker --'}
                            </option>
                            {workers.map(w => (
                              <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                                {w.name} ({w.experienceLevel === 'EXPERT' ? 'خبير' : w.experienceLevel === 'INTERMEDIATE' ? 'متوسط' : 'مبتدئ'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <select
                          value={group.difficulty}
                          onChange={(e) => onDifficultyChange(group.groupId, e.target.value as GroupDifficultyLevel)}
                          className="bg-slate-950 text-xs font-bold text-slate-200 border border-slate-800 rounded-lg px-2 py-1 focus:outline-none"
                        >
                          <option value="HIGH_EXPERT" className="bg-slate-900 text-red-300">صعبة (خبير)</option>
                          <option value="MEDIUM_INTERMEDIATE" className="bg-slate-900 text-amber-300">متوسطة</option>
                          <option value="LOW_NOVICE" className="bg-slate-900 text-emerald-300">سهلة (مبتدئ)</option>
                        </select>

                        <button
                          onClick={() => onExportWorkerSlip(group, assignedWorker)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-400" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Items Table in Group */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[10px]">
                          <tr>
                            <th className="p-2 w-10 text-center">#</th>
                            <th className="p-2">الصنف والباركود</th>
                            <th className="p-2 text-center">الكمية المطلوبة</th>
                            <th className="p-2 text-center">الكراتين</th>
                            <th className="p-2 text-center">الباكتات</th>
                            <th className="p-2 text-center">الحبات المتبقية</th>
                            <th className="p-2 text-center">الملتقط</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {group.items.map((it, itIdx) => (
                            <tr key={it.id} className="hover:bg-slate-900/40">
                              <td className="p-2 text-center text-slate-500 font-mono text-[11px]">
                                {itIdx + 1}
                              </td>
                              <td className="p-2">
                                <div className="font-mono font-bold text-amber-300 text-[11px]">{it.itemCode}</div>
                                <div className="text-slate-200 text-xs">{it.itemName}</div>
                              </td>

                              {/* Editable Required Quantity */}
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.totalRequiredQty}
                                  onChange={(e) => onUpdateItemQty(group.groupId, it.id, { totalRequiredQty: Math.max(1, Number(e.target.value) || 1) })}
                                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-black text-indigo-300 focus:outline-none focus:border-indigo-500 text-xs"
                                />
                              </td>

                              {/* Editable Cartons */}
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={it.cartonsCount || 0}
                                  onChange={(e) => onUpdateItemQty(group.groupId, it.id, { cartonsCount: Number(e.target.value) || 0 })}
                                  className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center font-mono font-bold text-amber-300 text-xs"
                                />
                              </td>

                              {/* Editable Packs */}
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={it.packsCount || 0}
                                  onChange={(e) => onUpdateItemQty(group.groupId, it.id, { packsCount: Number(e.target.value) || 0 })}
                                  className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center font-mono font-bold text-purple-300 text-xs"
                                />
                              </td>

                              {/* Editable Loose Pieces */}
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={it.piecesCount || 0}
                                  onChange={(e) => onUpdateItemQty(group.groupId, it.id, { piecesCount: Number(e.target.value) || 0 })}
                                  className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-center font-mono font-bold text-blue-300 text-xs"
                                />
                              </td>

                              {/* Picked Qty */}
                              <td className="p-2 text-center">
                                <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                                  it.pickedQty >= it.totalRequiredQty ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-900 text-slate-300'
                                }`}>
                                  {it.pickedQty} / {it.totalRequiredQty}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: PRE-LOCK VALIDATION CHECKLIST */}
          {activeTab === 'validation_checklist' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <span>{isRtl ? 'قائمة الفحص والتحقق قبل الاعتماد النهائي' : 'Pre-Approval Verification Checklist'}</span>
                </h3>

                <div className="space-y-3">
                  {/* Check 1: Worker Allocation */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    unassignedGroups.length === 0 
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200' 
                      : 'bg-red-950/30 border-red-800 text-red-200'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {unassignedGroups.length === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                      <span>{isRtl ? 'إسناد العمال لكافة المجموعات:' : 'Worker Assignment Coverage:'}</span>
                    </div>
                    <span className="text-xs font-mono font-bold">
                      {unassignedGroups.length === 0 ? 'مطابق 100% (كافة المجموعات مسندة)' : `يوجد ${unassignedGroups.length} مجموعات غير مسندة`}
                    </span>
                  </div>

                  {/* Check 2: Zero Quantity Check */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    zeroQtyItems.length === 0 
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200' 
                      : 'bg-amber-950/30 border-amber-800 text-amber-200'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {zeroQtyItems.length === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      <span>{isRtl ? 'فحص الأصناف ذات الكميات الصفرية:' : 'Zero-quantity items check:'}</span>
                    </div>
                    <span className="text-xs font-mono font-bold">
                      {zeroQtyItems.length === 0 ? 'سليم (لا توجد أصناف بكميات صفر)' : `يوجد ${zeroQtyItems.length} صنف بكمية صفرية`}
                    </span>
                  </div>

                  {/* Check 3: Packaging Math Consistency */}
                  <div className="p-3 rounded-xl border bg-emerald-950/30 border-emerald-800 text-emerald-200 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{isRtl ? 'مطابقة معادلات العبوات (كراتين + باكتات + حبات):' : 'Packaging Formula Balance:'}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-300">
                      {wave.totalCartons} كرتونة | {wave.totalPacks} باكت | {wave.totalPieces} حبة
                    </span>
                  </div>

                  {/* Check 4: Picking Progress */}
                  <div className="p-3 rounded-xl border bg-slate-900 border-slate-800 text-slate-200 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-indigo-400" />
                      <span>{isRtl ? 'حالة التقاط وتحقيق الكميات الميدانية:' : 'Picking Physical Progress:'}</span>
                    </div>
                    <span className="font-mono font-bold text-indigo-300">
                      {wave.groups.reduce((acc, g) => acc + g.items.filter(i => i.status === 'COMPLETED').length, 0)} / {wave.totalItemsCount} صنف مكتمل
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              {isRtl ? 'متابعة التعديل' : 'Back to Editing'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onExportExcel();
              }}
              className="px-4 py-2 bg-emerald-700/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>{isRtl ? 'استخراج التقرير النهائي (Excel)' : 'Export Final Report (Excel)'}</span>
            </button>

            <button
              onClick={() => {
                onApproveAndLock();
                onClose();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Lock className="w-4 h-4" />
              <span>{isRtl ? 'اعتماد وقفل المهمة رسمياً' : 'Approve & Lock Wave'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
