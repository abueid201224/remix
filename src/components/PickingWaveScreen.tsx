import React, { useState, useEffect } from 'react';
import {
  ListFilter,
  FileSpreadsheet,
  Upload,
  Download,
  Users,
  Award,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Printer,
  Boxes,
  Plus,
  Minus,
  Trash2,
  Edit3,
  Search,
  ScanLine,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  UserCheck,
  RefreshCw,
  Sliders,
  Eye,
  Info,
  Pin,
  Lock,
  Unlock,
  X,
  FileCheck,
  ShieldCheck,
  Sparkle,
  BookOpen
} from 'lucide-react';
import type { 
  AppSettings, 
  BatchPickingWave, 
  PickingProductGroup, 
  WarehouseWorker, 
  PackagingGroupRule,
  WorkerExperienceLevel,
  GroupDifficultyLevel,
  AggregatedPickingItem,
  ActiveTargetColumn,
  DocumentReopenPrompt
} from '../types';
import { 
  parseMultiInvoicePickingExcel, 
  downloadPickingExcelTemplate, 
  exportPickingWaveToExcel,
  exportAllPickingWavesToExcel,
  exportWorkerPickingSheetPdf 
} from '../services/excelService';
import { 
  getWarehouseWorkers, 
  saveWarehouseWorkers, 
  addWarehouseWorker, 
  updateWarehouseWorker, 
  deleteWarehouseWorker,
  getAllPickingWaves, 
  savePickingWave, 
  deletePickingWave,
  getPackagingGroupRules,
  matchBarcodeToPackagingRule
} from '../services/db';
import { SoundEffects } from '../services/audio';
import { PackagingRulesModal } from './PackagingRulesModal';
import { ReopenConfirmationModal } from './ReopenConfirmationModal';
import { PreReportAuditModal } from './PreReportAuditModal';

interface PickingWaveScreenProps {
  settings: AppSettings;
  lastScannedCode?: string | null;
  onOpenLogicGuide?: (tab?: string) => void;
}

export const PickingWaveScreen: React.FC<PickingWaveScreenProps> = ({
  settings,
  lastScannedCode,
  onOpenLogicGuide,
}) => {
  const isRtl = settings.language === 'ar';

  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'wave' | 'workers' | 'history'>('wave');

  // Active Wave State
  const [activeWave, setActiveWave] = useState<BatchPickingWave | null>(null);
  const [workers, setWorkers] = useState<WarehouseWorker[]>([]);
  const [packagingRules, setPackagingRules] = useState<PackagingGroupRule[]>([]);
  const [savedWaves, setSavedWaves] = useState<BatchPickingWave[]>([]);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<AggregatedPickingItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'SUCCESS' | 'INFO' | 'WARNING' } | null>(null);

  // Manual Review & Edit Mode before Final Report Generation
  const [isManualEditMode, setIsManualEditMode] = useState<boolean>(true);
  const [isPreReportAuditModalOpen, setIsPreReportAuditModalOpen] = useState<boolean>(false);

  // Touch column header locking
  const [activeTargetColumn, setActiveTargetColumn] = useState<ActiveTargetColumn>('pieces');

  // Reopen security modal state
  const [reopenPrompt, setReopenPrompt] = useState<DocumentReopenPrompt | null>(null);
  const [viewingWave, setViewingWave] = useState<BatchPickingWave | null>(null);

  // Manual Item Add Modal for a Group
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('PCS');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemCartonFactor, setNewItemCartonFactor] = useState(24);
  const [newItemPackFactor, setNewItemPackFactor] = useState(6);

  // New Worker Form State
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerCode, setNewWorkerCode] = useState('');
  const [newWorkerLevel, setNewWorkerLevel] = useState<WorkerExperienceLevel>('INTERMEDIATE');
  const [newWorkerSpecialty, setNewWorkerSpecialty] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    const [workersList, rulesList, wavesList] = await Promise.all([
      getWarehouseWorkers(),
      getPackagingGroupRules(),
      getAllPickingWaves(),
    ]);
    setWorkers(workersList);
    setPackagingRules(rulesList);
    setSavedWaves(wavesList);

    if (wavesList.length > 0 && !activeWave) {
      setActiveWave(wavesList[0]);
    }
  };

  const showNotice = (message: string, type: 'SUCCESS' | 'INFO' | 'WARNING' = 'INFO') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Recalculate group and wave summary statistics
  const recalculateWaveTotals = (wave: BatchPickingWave): BatchPickingWave => {
    const updatedGroups = wave.groups.map(group => {
      let gQty = 0;
      let gCartons = 0;
      let gPacks = 0;
      let gPieces = 0;

      group.items.forEach(it => {
        gQty += it.totalRequiredQty;
        gCartons += it.cartonsCount || 0;
        gPacks += it.packsCount || 0;
        gPieces += it.piecesCount || 0;
      });

      return {
        ...group,
        totalQty: gQty,
        totalCartons: gCartons,
        totalPacks: gPacks,
        totalPieces: gPieces,
      };
    });

    let waveQty = 0;
    let waveCartons = 0;
    let wavePacks = 0;
    let wavePieces = 0;
    let waveItems = 0;

    updatedGroups.forEach(g => {
      waveQty += g.totalQty;
      waveCartons += g.totalCartons;
      wavePacks += g.totalPacks;
      wavePieces += g.totalPieces;
      waveItems += g.items.length;
    });

    return {
      ...wave,
      groups: updatedGroups,
      totalQuantity: waveQty,
      totalCartons: waveCartons,
      totalPacks: wavePacks,
      totalPieces: wavePieces,
      totalItemsCount: waveItems,
    };
  };

  // Hardware Scanner Integration for Active Picking Wave with Active Column Locking
  useEffect(() => {
    if (!lastScannedCode || !activeWave || activeSubTab !== 'wave') return;
    const clean = lastScannedCode.trim().toLowerCase();
    if (!clean) return;

    let itemFound = false;
    const updatedGroups = activeWave.groups.map(group => {
      const updatedItems = group.items.map(item => {
        if (item.itemCode.toLowerCase() === clean) {
          itemFound = true;
          const cFactor = item.cartonFactor || 24;
          const pFactor = item.packFactor || 6;

          let incQty = 1;
          if (activeTargetColumn === 'cartons') {
            incQty = cFactor;
            item.cartonsCount = (item.cartonsCount || 0) + 1;
          } else if (activeTargetColumn === 'packs') {
            incQty = pFactor;
            item.packsCount = (item.packsCount || 0) + 1;
          } else {
            incQty = 1;
            item.piecesCount = (item.piecesCount || 0) + 1;
          }

          const nextPicked = Math.min(item.totalRequiredQty, item.pickedQty + incQty);
          return {
            ...item,
            pickedQty: nextPicked,
            status: (nextPicked >= item.totalRequiredQty ? 'COMPLETED' : 'IN_PROGRESS') as 'COMPLETED' | 'IN_PROGRESS'
          };
        }
        return item;
      });

      const allCompleted = updatedItems.every(i => i.status === 'COMPLETED');
      const anyInProgress = updatedItems.some(i => i.pickedQty > 0);

      return {
        ...group,
        items: updatedItems,
        status: (allCompleted ? 'COMPLETED' : anyInProgress ? 'IN_PROGRESS' : 'PENDING') as 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'
      };
    });

    if (itemFound) {
      const updatedWave: BatchPickingWave = {
        ...activeWave,
        groups: updatedGroups,
        status: updatedGroups.every(g => g.status === 'COMPLETED') ? 'COMPLETED' : 'IN_PROGRESS'
      };
      const finalWave = recalculateWaveTotals(updatedWave);
      setActiveWave(finalWave);
      savePickingWave(finalWave);
      if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
      showNotice(
        isRtl ? `✅ تم تسجيل التقاط الصنف (${clean})` : `✅ Picked item (${clean})`,
        'SUCCESS'
      );
    } else {
      if (settings.soundEnabled) SoundEffects.playMismatchWarning(settings.soundVolume);
      showNotice(
        isRtl ? `⚠️ الباركود الممسوح (${clean}) غير مدرج في موجة الانتقاء الحالية` : `⚠️ Barcode (${clean}) not in current wave`,
        'WARNING'
      );
    }
  }, [lastScannedCode, activeTargetColumn]);

  // Handle Multi-Invoice Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await parseMultiInvoicePickingExcel(file, packagingRules);
      
      const newWave: BatchPickingWave = {
        id: `wave-${Date.now()}`,
        waveNo: `WAVE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: result.waveTitle,
        createdAt: new Date().toISOString(),
        createdBy: settings.auditorName || 'مشرف التجهيز',
        totalInvoicesCount: result.totalInvoicesCount,
        invoiceNumbers: result.invoiceNumbers,
        totalItemsCount: result.totalItemsCount,
        totalQuantity: result.totalQuantity,
        totalCartons: result.totalCartons,
        totalPacks: result.totalPacks,
        totalPieces: result.totalPieces,
        groups: result.groups,
        status: 'DRAFT',
      };

      const assignedWave = performSmartWorkerAssignment(newWave, workers);
      setActiveWave(assignedWave);
      await savePickingWave(assignedWave);
      const updatedList = await getAllPickingWaves();
      setSavedWaves(updatedList);

      if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
      showNotice(
        isRtl 
          ? `🎉 تم تكوين قائمة الانتقاء وتجميع ${result.totalQuantity} قطعة من ${result.totalInvoicesCount} فواتير!`
          : `🎉 Created wave with ${result.totalQuantity} items across ${result.totalInvoicesCount} invoices!`,
        'SUCCESS'
      );
    } catch (err: any) {
      console.error('Error parsing picking Excel:', err);
      showNotice(err.message || 'حدث خطأ أثناء قراءة ملف الإكسيل', 'WARNING');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Smart Auto-Assign Algorithm matching Group Difficulty to Worker Experience Level
  const performSmartWorkerAssignment = (wave: BatchPickingWave, currentWorkers: WarehouseWorker[]): BatchPickingWave => {
    const activeWorkers = currentWorkers.filter(w => w.isActive);
    if (activeWorkers.length === 0) return wave;

    const experts = activeWorkers.filter(w => w.experienceLevel === 'EXPERT');
    const intermediates = activeWorkers.filter(w => w.experienceLevel === 'INTERMEDIATE');
    const novices = activeWorkers.filter(w => w.experienceLevel === 'NOVICE');

    let expIdx = 0;
    let intIdx = 0;
    let novIdx = 0;

    const assignedGroups = wave.groups.map(group => {
      let chosenWorker: WarehouseWorker | null = null;

      if (group.difficulty === 'HIGH_EXPERT') {
        if (experts.length > 0) {
          chosenWorker = experts[expIdx % experts.length];
          expIdx++;
        } else if (intermediates.length > 0) {
          chosenWorker = intermediates[intIdx % intermediates.length];
          intIdx++;
        } else {
          chosenWorker = activeWorkers[0];
        }
      } else if (group.difficulty === 'MEDIUM_INTERMEDIATE') {
        if (intermediates.length > 0) {
          chosenWorker = intermediates[intIdx % intermediates.length];
          intIdx++;
        } else if (experts.length > 0) {
          chosenWorker = experts[expIdx % experts.length];
          expIdx++;
        } else if (novices.length > 0) {
          chosenWorker = novices[novIdx % novices.length];
          novIdx++;
        } else {
          chosenWorker = activeWorkers[0];
        }
      } else {
        if (novices.length > 0) {
          chosenWorker = novices[novIdx % novices.length];
          novIdx++;
        } else if (intermediates.length > 0) {
          chosenWorker = intermediates[intIdx % intermediates.length];
          intIdx++;
        } else {
          chosenWorker = activeWorkers[0];
        }
      }

      return {
        ...group,
        assignedWorkerId: chosenWorker?.id,
        assignedWorkerName: chosenWorker?.name,
        assignedWorkerLevel: chosenWorker?.experienceLevel,
      };
    });

    return {
      ...wave,
      groups: assignedGroups,
      status: 'ASSIGNED',
    };
  };

  const handleApplyAutoAssign = async () => {
    if (!activeWave) return;
    const updated = performSmartWorkerAssignment(activeWave, workers);
    setActiveWave(updated);
    await savePickingWave(updated);
    showNotice(isRtl ? '✅ تم إعادة الإسناد الذكي للعمال بنجاح' : '✅ Smart Worker Assignment Applied', 'SUCCESS');
  };

  // Manual worker change for a specific group
  const handleAssignWorkerToGroup = async (groupId: string, workerId: string) => {
    if (!activeWave) return;
    const worker = workers.find(w => w.id === workerId);
    const updatedGroups = activeWave.groups.map(g => {
      if (g.groupId === groupId) {
        return {
          ...g,
          assignedWorkerId: worker?.id,
          assignedWorkerName: worker?.name,
          assignedWorkerLevel: worker?.experienceLevel,
        };
      }
      return g;
    });

    const updatedWave: BatchPickingWave = {
      ...activeWave,
      groups: updatedGroups,
      status: 'ASSIGNED',
    };
    setActiveWave(updatedWave);
    await savePickingWave(updatedWave);
  };

  // Manual difficulty change for a specific group
  const handleDifficultyChange = async (groupId: string, difficulty: GroupDifficultyLevel) => {
    if (!activeWave) return;
    const updatedGroups = activeWave.groups.map(g => {
      if (g.groupId === groupId) {
        return { ...g, difficulty };
      }
      return g;
    });

    const updatedWave: BatchPickingWave = {
      ...activeWave,
      groups: updatedGroups,
    };
    setActiveWave(updatedWave);
    await savePickingWave(updatedWave);
  };

  // Manual Item Edit (Required Qty, Cartons, Packs, Pieces, Picked Qty)
  const handleUpdateWaveItem = async (groupId: string, itemId: string, updates: Partial<AggregatedPickingItem>) => {
    if (!activeWave) return;

    const updatedGroups = activeWave.groups.map(group => {
      if (group.groupId === groupId) {
        const updatedItems = group.items.map(item => {
          if (item.id === itemId) {
            const merged = { ...item, ...updates };
            const cFactor = merged.cartonFactor || 24;
            const pFactor = merged.packFactor || 6;

            // If user updated cartons/packs/pieces manually, recompute total required if desired
            if (updates.cartonsCount !== undefined || updates.packsCount !== undefined || updates.piecesCount !== undefined) {
              const c = merged.cartonsCount || 0;
              const p = merged.packsCount || 0;
              const loose = merged.piecesCount || 0;
              merged.totalRequiredQty = (c * cFactor) + (p * pFactor) + loose;
            } else if (updates.totalRequiredQty !== undefined) {
              // If user updated totalRequiredQty, auto-breakdown packaging
              const tot = merged.totalRequiredQty;
              merged.cartonsCount = Math.floor(tot / cFactor);
              const rem = tot % cFactor;
              merged.packsCount = Math.floor(rem / pFactor);
              merged.piecesCount = rem % pFactor;
            }

            merged.status = merged.pickedQty >= merged.totalRequiredQty ? 'COMPLETED' : merged.pickedQty > 0 ? 'IN_PROGRESS' : 'PENDING';
            return merged;
          }
          return item;
        });

        return {
          ...group,
          items: updatedItems,
        };
      }
      return group;
    });

    const recalculated = recalculateWaveTotals({ ...activeWave, groups: updatedGroups });
    setActiveWave(recalculated);
    await savePickingWave(recalculated);
  };

  // Re-balance packaging breakdown for a single item (calculate Cartons, Packs, Pieces from Required Qty)
  const handleRebalanceSingleItem = async (groupId: string, itemId: string) => {
    if (!activeWave) return;
    const group = activeWave.groups.find(g => g.groupId === groupId);
    const item = group?.items.find(i => i.id === itemId);
    if (!item) return;

    const cFactor = item.cartonFactor || 24;
    const pFactor = item.packFactor || 6;
    const tot = item.totalRequiredQty;

    const cCount = Math.floor(tot / cFactor);
    const rem = tot % cFactor;
    const pCount = Math.floor(rem / pFactor);
    const pieces = rem % pFactor;

    await handleUpdateWaveItem(groupId, itemId, {
      cartonsCount: cCount,
      packsCount: pCount,
      piecesCount: pieces,
    });
    showNotice(isRtl ? `⚡ تم إعادة موازنة عبوات الصنف (${item.itemCode}) تلقائياً` : 'Packaging re-balanced', 'SUCCESS');
  };

  // Quick adjust quantity (+10, -10, +1, -1) and auto-balance
  const handleQuickAdjustItemQty = async (groupId: string, itemId: string, delta: number) => {
    if (!activeWave) return;
    const group = activeWave.groups.find(g => g.groupId === groupId);
    const item = group?.items.find(i => i.id === itemId);
    if (!item) return;

    const newTot = Math.max(1, item.totalRequiredQty + delta);
    const cFactor = item.cartonFactor || 24;
    const pFactor = item.packFactor || 6;

    const cCount = Math.floor(newTot / cFactor);
    const rem = newTot % cFactor;
    const pCount = Math.floor(rem / pFactor);
    const pieces = rem % pFactor;

    await handleUpdateWaveItem(groupId, itemId, {
      totalRequiredQty: newTot,
      cartonsCount: cCount,
      packsCount: pCount,
      piecesCount: pieces,
    });
  };

  // Re-balance all packaging across the entire wave
  const handleRebalanceAllPackaging = async () => {
    if (!activeWave) return;
    const updatedGroups = activeWave.groups.map(group => {
      const updatedItems = group.items.map(item => {
        const cFactor = item.cartonFactor || 24;
        const pFactor = item.packFactor || 6;
        const tot = item.totalRequiredQty;

        const cCount = Math.floor(tot / cFactor);
        const rem = tot % cFactor;
        const pCount = Math.floor(rem / pFactor);
        const pieces = rem % pFactor;

        return {
          ...item,
          cartonsCount: cCount,
          packsCount: pCount,
          piecesCount: pieces,
        };
      });

      return {
        ...group,
        items: updatedItems,
      };
    });

    const recalculated = recalculateWaveTotals({ ...activeWave, groups: updatedGroups });
    setActiveWave(recalculated);
    await savePickingWave(recalculated);
    showNotice(isRtl ? '⚡ تم إعادة موازنة احتساب العبوات لكافة الأصناف بالموجة بنجاح!' : 'All packaging rebalanced successfully!', 'SUCCESS');
  };

  // Add Item Manually to a Wave Group
  const handleAddItemToGroup = async () => {
    if (!activeWave || !addingToGroupId || !newItemCode.trim()) return;

    const cleanCode = newItemCode.trim();
    const cFactor = newItemCartonFactor || 24;
    const pFactor = newItemPackFactor || 6;
    const totQty = Math.max(1, newItemQty);

    const cCount = Math.floor(totQty / cFactor);
    const rem = totQty % cFactor;
    const pCount = Math.floor(rem / pFactor);
    const pieces = rem % pFactor;

    const newItem: AggregatedPickingItem = {
      id: `pick-item-${Date.now()}`,
      itemCode: cleanCode,
      itemName: newItemName.trim() || `صنف مضاف ${cleanCode}`,
      unit: newItemUnit || 'PCS',
      groupId: addingToGroupId,
      groupName: activeWave.groups.find(g => g.groupId === addingToGroupId)?.groupName || 'مجموعة',
      totalRequiredQty: totQty,
      pickedQty: 0,
      cartonFactor: cFactor,
      packFactor: pFactor,
      cartonsCount: cCount,
      packsCount: pCount,
      piecesCount: pieces,
      invoiceSources: [{
        invoiceNo: 'MANUAL',
        customerName: 'إضافة يدوية',
        qty: totQty,
      }],
      status: 'PENDING',
    };

    const updatedGroups = activeWave.groups.map(g => {
      if (g.groupId === addingToGroupId) {
        return {
          ...g,
          items: [...g.items, newItem],
        };
      }
      return g;
    });

    const recalculated = recalculateWaveTotals({ ...activeWave, groups: updatedGroups });
    setActiveWave(recalculated);
    await savePickingWave(recalculated);

    // Reset form
    setAddingToGroupId(null);
    setNewItemCode('');
    setNewItemName('');
    setNewItemQty(1);
    showNotice(isRtl ? '✅ تم إضافة الصنف بنجاح لقائمة الانتقاء' : '✅ Item added to picking wave', 'SUCCESS');
  };

  // Remove Item from Wave Group
  const handleRemoveItemFromGroup = async (groupId: string, itemId: string) => {
    if (!activeWave) return;

    const updatedGroups = activeWave.groups.map(g => {
      if (g.groupId === groupId) {
        return {
          ...g,
          items: g.items.filter(it => it.id !== itemId),
        };
      }
      return g;
    });

    const recalculated = recalculateWaveTotals({ ...activeWave, groups: updatedGroups });
    setActiveWave(recalculated);
    await savePickingWave(recalculated);
    showNotice(isRtl ? 'تم حذف الصنف من القائمة' : 'Item removed', 'INFO');
  };

  // Mark an item as picked or toggle status
  const handleToggleItemPicked = async (groupId: string, itemId: string) => {
    if (!activeWave) return;
    const updatedGroups = activeWave.groups.map(g => {
      if (g.groupId === groupId) {
        const updatedItems = g.items.map(it => {
          if (it.id === itemId) {
            const isCompleted = it.status === 'COMPLETED';
            return {
              ...it,
              pickedQty: isCompleted ? 0 : it.totalRequiredQty,
              status: (isCompleted ? 'PENDING' : 'COMPLETED') as 'PENDING' | 'COMPLETED'
            };
          }
          return it;
        });
        const allDone = updatedItems.every(i => i.status === 'COMPLETED');
        return {
          ...g,
          items: updatedItems,
          status: (allDone ? 'COMPLETED' : 'IN_PROGRESS') as 'COMPLETED' | 'IN_PROGRESS'
        };
      }
      return g;
    });

    const updatedWave = recalculateWaveTotals({ ...activeWave, groups: updatedGroups });
    setActiveWave(updatedWave);
    await savePickingWave(updatedWave);
    if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
  };

  // Save / Approve / Lock Wave
  const handleLockWave = async () => {
    if (!activeWave) return;
    const lockedWave: BatchPickingWave = {
      ...activeWave,
      status: 'COMPLETED',
    };
    await savePickingWave(lockedWave);
    const updatedList = await getAllPickingWaves();
    setSavedWaves(updatedList);
    setActiveWave(lockedWave);
    if (settings.soundEnabled) SoundEffects.playInvoiceLock(settings.soundVolume);
    showNotice(isRtl ? `🔒 تم اعتماد وقفل موجة الانتقاء (${activeWave.waveNo}) بنجاح!` : `Locked wave ${activeWave.waveNo}`, 'SUCCESS');
  };

  // Re-open Request Handler for Completed Wave
  const handleRequestReopenWave = (wave: BatchPickingWave) => {
    setReopenPrompt({
      isOpen: true,
      documentType: 'PICKING',
      documentId: wave.id,
      documentNo: wave.waveNo,
      title: `قائمة وموجة انتقال رقم ${wave.waveNo} (${wave.title})`,
      onConfirm: () => handleConfirmReopenWave(wave),
    });
  };

  // Confirm Re-open Wave
  const handleConfirmReopenWave = async (wave: BatchPickingWave) => {
    const unlocked: BatchPickingWave = {
      ...wave,
      status: 'IN_PROGRESS',
    };
    await savePickingWave(unlocked);
    const updatedList = await getAllPickingWaves();
    setSavedWaves(updatedList);
    setActiveWave(unlocked);
    setActiveSubTab('wave');
    setReopenPrompt(null);
    if (settings.soundEnabled) SoundEffects.playInvoiceUnlock(settings.soundVolume);
    showNotice(isRtl ? `🔓 تمت إعادة فتح موجة الانتقاء (${wave.waveNo}) للتعديل اليدوي` : `Wave ${wave.waveNo} unlocked for editing`, 'SUCCESS');
  };

  // Worker CRUD
  const handleSaveWorker = async () => {
    if (!newWorkerName.trim()) {
      showNotice(isRtl ? 'يرجى إدخال اسم العامل' : 'Please enter worker name', 'WARNING');
      return;
    }

    const code = newWorkerCode.trim() || `EMP-${Date.now().toString().slice(-4)}`;

    if (editingWorkerId) {
      const existing = workers.find(w => w.id === editingWorkerId);
      if (existing) {
        const updated: WarehouseWorker = {
          ...existing,
          name: newWorkerName.trim(),
          code,
          experienceLevel: newWorkerLevel,
          specialty: newWorkerSpecialty.trim(),
          phone: newWorkerPhone.trim(),
        };
        await updateWarehouseWorker(updated);
        showNotice(isRtl ? '✅ تم تحديث بيانات العامل' : 'Worker Updated', 'SUCCESS');
      }
    } else {
      const newWorker: WarehouseWorker = {
        id: `worker-${Date.now()}`,
        name: newWorkerName.trim(),
        code,
        experienceLevel: newWorkerLevel,
        specialty: newWorkerSpecialty.trim(),
        phone: newWorkerPhone.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await addWarehouseWorker(newWorker);
      showNotice(isRtl ? '✅ تم إضافة العامل بنجاح' : 'Worker Added', 'SUCCESS');
    }

    // Reset Form
    setEditingWorkerId(null);
    setNewWorkerName('');
    setNewWorkerCode('');
    setNewWorkerLevel('INTERMEDIATE');
    setNewWorkerSpecialty('');
    setNewWorkerPhone('');

    const updatedWorkers = await getWarehouseWorkers();
    setWorkers(updatedWorkers);
  };

  const handleEditWorker = (worker: WarehouseWorker) => {
    setEditingWorkerId(worker.id);
    setNewWorkerName(worker.name);
    setNewWorkerCode(worker.code);
    setNewWorkerLevel(worker.experienceLevel);
    setNewWorkerSpecialty(worker.specialty || '');
    setNewWorkerPhone(worker.phone || '');
    setActiveSubTab('workers');
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (confirm(isRtl ? 'هل أنت متأكد من حذف هذا العامل؟' : 'Delete this worker?')) {
      await deleteWarehouseWorker(workerId);
      const updated = await getWarehouseWorkers();
      setWorkers(updated);
      showNotice(isRtl ? 'تم حذف العامل' : 'Worker deleted', 'INFO');
    }
  };

  const handleToggleWorkerStatus = async (worker: WarehouseWorker) => {
    const updated = { ...worker, isActive: !worker.isActive };
    await updateWarehouseWorker(updated);
    const list = await getWarehouseWorkers();
    setWorkers(list);
  };

  // Experience level badge helper
  const getExperienceBadge = (level: WorkerExperienceLevel) => {
    switch (level) {
      case 'EXPERT':
        return (
          <span className="bg-amber-950/80 text-amber-300 border border-amber-700/70 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRtl ? 'عامل خبير' : 'Expert'}</span>
          </span>
        );
      case 'INTERMEDIATE':
        return (
          <span className="bg-blue-950/80 text-blue-300 border border-blue-700/70 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>{isRtl ? 'عامل متوسط' : 'Intermediate'}</span>
          </span>
        );
      case 'NOVICE':
        return (
          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/70 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRtl ? 'عامل مبتدئ' : 'Novice'}</span>
          </span>
        );
    }
  };

  const getDifficultyBadge = (diff: GroupDifficultyLevel) => {
    switch (diff) {
      case 'HIGH_EXPERT':
        return (
          <span className="bg-red-950/80 text-red-300 border border-red-800/80 px-2.5 py-0.5 rounded-md text-[11px] font-black">
            {isRtl ? 'صعوبة عالية (حساس/زجاجيات)' : 'High (Fragile)'}
          </span>
        );
      case 'MEDIUM_INTERMEDIATE':
        return (
          <span className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
            {isRtl ? 'صعوبة متوسطة (غذائيات/أدوية)' : 'Medium (Standard)'}
          </span>
        );
      case 'LOW_NOVICE':
        return (
          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
            {isRtl ? 'صعوبة منخفضة (كراتين مقفلة)' : 'Low (Bulk/Fast)'}
          </span>
        );
    }
  };

  const filteredGroups = activeWave?.groups.filter(group => {
    if (selectedGroupFilter !== 'ALL' && group.groupId !== selectedGroupFilter) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.groupName.toLowerCase().includes(query) ||
      group.items.some(i => i.itemCode.toLowerCase().includes(query) || i.itemName.toLowerCase().includes(query))
    );
  }) || [];

  return (
    <div className="space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner">
              <Boxes className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white">
                  {isRtl ? 'قائمة وموجات الانتقاء المجمعة (Batch Picking Waves)' : 'Multi-Invoice Batch Picking Wave'}
                </h1>
                {activeWave && (
                  <span className="text-[11px] bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-700 font-mono font-bold">
                    {activeWave.waveNo}
                  </span>
                )}
                {activeWave?.status === 'COMPLETED' && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700 flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3" />
                    <span>مقفلة ومعتمدة</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl
                  ? 'تجميع كود الصنف عبر الفواتير، احتساب العبوات وتثبيت الأعمدة باللمس، وإسناد المهام للعمال مع إمكانية التعديل اليدوي قبل التصدير'
                  : 'Multi-invoice item aggregation, touch-locked packaging columns, smart worker assignment with manual override before final report generation'}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenLogicGuide && (
              <button
                type="button"
                onClick={() => onOpenLogicGuide('picking')}
                className="bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/60 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title={isRtl ? 'دليل المنطق والمعادلات والحلول الرقابية لموجات الانتقاء وخوارزمية التوزيع' : 'Picking Wave Logic & Algorithm Guide'}
              >
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>{isRtl ? 'المنطق والمعادلات 💡' : 'Logic Guide'}</span>
              </button>
            )}

            <button
              onClick={() => exportAllPickingWavesToExcel(savedWaves)}
              className="bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-500/50 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'تصدير كافة موجات وقوائم الانتقاء المجمعة إلى إكسيل' : 'Export All Waves to Excel'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>{isRtl ? 'تصدير كافة قوائم الانتقاء (Excel)' : 'Export All Picking Waves'}</span>
            </button>

            {activeWave && (
              <>
                <button
                  onClick={handleLockWave}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="اعتماد وقفل موجة الانتقاء الحالية"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRtl ? 'اعتماد وقفل الموجة' : 'Approve & Lock Wave'}</span>
                </button>

                <button
                  onClick={() => exportPickingWaveToExcel(activeWave)}
                  className="bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title={isRtl ? 'تصدير الموجة الحالية إلى إكسيل' : 'Export Current Wave'}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isRtl ? `تصدير ${activeWave.waveNo}` : 'Export Wave'}</span>
                </button>
              </>
            )}

            <button
              id="download-picking-template-btn"
              onClick={downloadPickingExcelTemplate}
              className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'تحميل نموذج إكسيل فواتير جاهز' : 'Download Template'}
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>{isRtl ? 'نموذج الفواتير' : 'Template'}</span>
            </button>

            <button
              id="open-packaging-rules-btn"
              onClick={() => setIsRulesModalOpen(true)}
              className="bg-slate-800/90 hover:bg-slate-700 text-indigo-300 border border-indigo-800/60 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'إدارة شروط ضم وتجميع العبوات' : 'Packaging Rules'}
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>{isRtl ? 'شروط ضم العبوات' : 'Packaging Rules'}</span>
            </button>

            <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 ring-1 ring-indigo-400">
              <Upload className="w-4 h-4" />
              <span>{isUploading ? (isRtl ? 'جاري التجميع...' : 'Processing...') : (isRtl ? 'رفع إكسيل الفواتير' : 'Import Invoices Excel')}</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all shadow-md ${
            actionNotice.type === 'SUCCESS' 
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200' 
              : actionNotice.type === 'WARNING'
              ? 'bg-amber-950/80 border-amber-700 text-amber-200'
              : 'bg-blue-950/80 border-blue-700 text-blue-200'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{actionNotice.message}</span>
            </div>
            <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white px-2">✕</button>
          </div>
        )}
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveSubTab('wave')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeSubTab === 'wave'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{isRtl ? 'قوائم التجهيز والمجموعات' : 'Wave Groups & Items'}</span>
            {activeWave && (
              <span className="bg-indigo-950 text-indigo-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                {activeWave.groups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('workers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeSubTab === 'workers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isRtl ? 'إدارة عمال التجهيز والخبرات' : 'Workers & Skills'}</span>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {workers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeSubTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isRtl ? 'سجل موجات الانتقاء' : 'Saved Waves'}</span>
            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {savedWaves.length}
            </span>
          </button>
        </div>

        {activeWave && activeSubTab === 'wave' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Manual Edit Mode Toggle Button */}
            <button
              onClick={() => {
                setIsManualEditMode(!isManualEditMode);
                showNotice(
                  !isManualEditMode 
                    ? (isRtl ? '✍️ تم تفعيل وضع التعديل اليدوي والمراجعة قبل إصدار التقرير' : 'Manual Edit Mode Enabled') 
                    : (isRtl ? '🔒 تم إيقاف التعديل اليدوي والانتقال لوضع الحماية والمسح المباشر' : 'Read-only Protection Mode Enabled'),
                  !isManualEditMode ? 'SUCCESS' : 'INFO'
                );
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-sm ${
                isManualEditMode
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title={isRtl ? 'تفعيل/إلغاء وضع التعديل اليدوي للكميات والعمال قبل استخراج التقرير' : 'Toggle Manual Edit Mode'}
            >
              <Edit3 className={`w-3.5 h-3.5 ${isManualEditMode ? 'text-emerald-200 animate-pulse' : 'text-slate-400'}`} />
              <span>
                {isRtl 
                  ? (isManualEditMode ? 'التعديل اليدوي: [مفعل]' : 'التعديل اليدوي: [معطل]')
                  : (isManualEditMode ? 'Manual Edit: ON' : 'Manual Edit: OFF')}
              </span>
            </button>

            {/* Pre-Report Worker Review & Audit Modal Button */}
            <button
              onClick={() => setIsPreReportAuditModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title={isRtl ? 'فتح لوحة مراجعة الكميات المسندة للعمال وفحص البيانات قبل التقرير' : 'Audit Assigned Quantities & Workers'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
              <span>{isRtl ? 'مراجعة وتدقيق العمال قبل التقرير' : 'Pre-Report Worker Audit'}</span>
            </button>

            {/* Auto Re-balance packaging button */}
            <button
              onClick={handleRebalanceAllPackaging}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-800/50 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
              title={isRtl ? 'إعادة احتساب الكراتين والباكتات والحبات آلياً بناءً على المعاملات' : 'Auto-rebalance packaging'}
            >
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <span className="hidden md:inline">{isRtl ? 'موازنة العبوات' : 'Rebalance'}</span>
            </button>

            <button
              onClick={handleApplyAutoAssign}
              className="bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/70 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title={isRtl ? 'إعادة الإسناد الذكي للعمال حسب الصعوبة والخبرة' : 'Auto Assign Workers'}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{isRtl ? 'إسناد ذكي للعمال' : 'Smart Auto-Assign'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WAVE PICKING GROUPS & PACKAGING BREAKDOWN VIEW                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'wave' && (
        <div className="space-y-4">
          {activeWave ? (
            <>
              {/* Manual Edit Mode Status Banner */}
              <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md transition-all ${
                isManualEditMode 
                  ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-100' 
                  : 'bg-slate-900/90 border-slate-800 text-slate-300'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    isManualEditMode 
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    {isManualEditMode ? <Edit3 className="w-4 h-4 animate-bounce" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-black flex items-center gap-2">
                      <span>
                        {isRtl 
                          ? (isManualEditMode ? '✍️ وضع التعديل اليدوي والمراجعة الدقيقة مفعّل حالياً' : '🔒 وضع القراءة والمسح المباشر (الحقول محمية من التعديل العفوي)')
                          : (isManualEditMode ? 'Manual Quantity & Worker Edit Mode is Active' : 'Protected Read-Only & Direct Scanning Mode Active')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isRtl
                        ? (isManualEditMode 
                            ? 'يمكنك الآن تعديل الكميات الإجمالية، تفكيك العبوات (كراتين/باكتات/حبات)، وتغيير العامل المسند لكل مجموعة قبل قفل المهمة واستخراج التقارير.'
                            : 'تم قفل حقول الإدخال اليدوي لمنع التعديلات الخاطئة أثناء المسح. انقر على زر [التعديل اليدوي] أعلاه إذا رغبت بالمراجعة والتعديل.')
                        : (isManualEditMode
                            ? 'You can now manually adjust quantities, adjust carton/pack counts, and reassign workers before final report extraction.'
                            : 'Input fields are locked to prevent accidental modifications during scanning. Toggle Manual Edit to make changes.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setIsPreReportAuditModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'فحص ومراجعة التقرير' : 'Audit Report'}</span>
                  </button>
                </div>
              </div>
              {/* Wave Summary Dashboard Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isRtl ? 'الفواتير المخدومة' : 'Total Invoices'}</span>
                  </div>
                  <div className="text-lg font-black text-blue-300 font-mono">
                    {activeWave.totalInvoicesCount} <span className="text-xs font-normal text-slate-400">{isRtl ? 'فاتورة' : 'Invoices'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isRtl ? 'الأصناف المجمعة' : 'Unique Items'}</span>
                  </div>
                  <div className="text-lg font-black text-emerald-300 font-mono">
                    {activeWave.totalItemsCount} <span className="text-xs font-normal text-slate-400">{isRtl ? 'كود صنف' : 'Codes'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isRtl ? 'إجمالي الكمية' : 'Total Pieces'}</span>
                  </div>
                  <div className="text-lg font-black text-indigo-300 font-mono">
                    {activeWave.totalQuantity} <span className="text-xs font-normal text-slate-400">{isRtl ? 'حبة' : 'Pcs'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isRtl ? 'إجمالي الكراتين' : 'Master Cartons'}</span>
                  </div>
                  <div className="text-lg font-black text-amber-300 font-mono">
                    {activeWave.totalCartons} <span className="text-xs font-normal text-slate-400">{isRtl ? 'كرتونة' : 'Ctn'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isRtl ? 'إجمالي الباكتات' : 'Shrink Packs'}</span>
                  </div>
                  <div className="text-lg font-black text-purple-300 font-mono">
                    {activeWave.totalPacks} <span className="text-xs font-normal text-slate-400">{isRtl ? 'باكت' : 'Packs'}</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md">
                  <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isRtl ? 'حبات فردية' : 'Loose Pieces'}</span>
                  </div>
                  <div className="text-lg font-black text-emerald-300 font-mono">
                    {activeWave.totalPieces} <span className="text-xs font-normal text-slate-400">{isRtl ? 'حبة' : 'Pcs'}</span>
                  </div>
                </div>
              </div>

              {/* Column Locking Toolbar & Filters */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5 text-amber-400" />
                    <span>تثبيت عمود التسجيل باللمس:</span>
                  </span>

                  <div className="inline-flex bg-slate-950 p-1 rounded-lg border border-slate-800 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTargetColumn('cartons');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                        activeTargetColumn === 'cartons'
                          ? 'bg-amber-500 text-black shadow font-black'
                          : 'text-amber-300/70 hover:text-amber-300 hover:bg-slate-800'
                      }`}
                    >
                      {activeTargetColumn === 'cartons' && <Pin className="w-3 h-3" />}
                      <span>الكراتين</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTargetColumn('packs');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                        activeTargetColumn === 'packs'
                          ? 'bg-purple-600 text-white shadow font-black'
                          : 'text-purple-300/70 hover:text-purple-300 hover:bg-slate-800'
                      }`}
                    >
                      {activeTargetColumn === 'packs' && <Pin className="w-3 h-3" />}
                      <span>الباكتات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTargetColumn('pieces');
                        if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1 ${
                        activeTargetColumn === 'pieces'
                          ? 'bg-blue-600 text-white shadow font-black'
                          : 'text-blue-300/70 hover:text-blue-300 hover:bg-slate-800'
                      }`}
                    >
                      {activeTargetColumn === 'pieces' && <Pin className="w-3 h-3" />}
                      <span>حبات فردية</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 rtl:left-auto rtl:right-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isRtl ? 'بحث في أصناف الموجة...' : 'Search items...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 rtl:pl-2.5 rtl:pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">{isRtl ? 'كافة المجموعات' : 'All Groups'}</option>
                    {activeWave.groups.map(g => (
                      <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Groups & Items List */}
              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center">
                    <Boxes className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">{isRtl ? 'لا توجد مجموعات تطابق البحث المحدد' : 'No matching product groups found'}</p>
                  </div>
                ) : (
                  filteredGroups.map((group, groupIdx) => {
                    const assignedWorker = workers.find(w => w.id === group.assignedWorkerId);
                    const isGroupCompleted = group.items.every(i => i.status === 'COMPLETED');
                    const pickedItemsCount = group.items.filter(i => i.status === 'COMPLETED').length;
                    const completionPercent = group.items.length > 0 ? Math.round((pickedItemsCount / group.items.length) * 100) : 0;

                    return (
                      <div
                        key={group.groupId}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all"
                      >
                        {/* Group Header Card */}
                        <div className={`p-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                          group.difficulty === 'HIGH_EXPERT'
                            ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-red-900/40'
                            : group.difficulty === 'MEDIUM_INTERMEDIATE'
                            ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-900/40'
                            : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-900/40'
                        }`}>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-slate-800 text-indigo-300 font-mono text-xs px-2 py-0.5 rounded-md font-bold">
                                #{groupIdx + 1}
                              </span>
                              <h2 className="text-base font-black text-white">{group.groupName}</h2>
                              {getDifficultyBadge(group.difficulty)}
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-3">
                              <span>{isRtl ? 'عدد الأصناف:' : 'Items:'} <strong className="text-white">{group.items.length}</strong></span>
                              <span>•</span>
                              <span>{isRtl ? 'الفواتير المخدومة:' : 'Invoices:'} <strong className="text-white">{group.invoicesCount}</strong></span>
                              <span>•</span>
                              <span>{isRtl ? 'نسبة الإنجاز:' : 'Progress:'} <strong className={completionPercent === 100 ? 'text-emerald-400' : 'text-amber-400'}>{completionPercent}%</strong></span>
                            </p>
                          </div>

                          {/* Worker Assignment & Actions */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {/* Worker Selector Dropdown */}
                            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5">
                              <UserCheck className="w-4 h-4 text-indigo-400" />
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold">{isRtl ? 'العامل المسند:' : 'Assigned Worker:'}</span>
                                <select
                                  value={group.assignedWorkerId || ''}
                                  onChange={(e) => handleAssignWorkerToGroup(group.groupId, e.target.value)}
                                  className="bg-transparent text-xs font-bold text-slate-100 focus:outline-none cursor-pointer"
                                >
                                  <option value="" className="bg-slate-900 text-slate-400">
                                    {isRtl ? '-- حدد عامل للتجهيز --' : '-- Assign Worker --'}
                                  </option>
                                  {workers.map(w => (
                                    <option key={w.id} value={w.id} className="bg-slate-900 text-slate-100">
                                      {w.name} ({w.code} - {w.experienceLevel === 'EXPERT' ? 'خبير' : w.experienceLevel === 'INTERMEDIATE' ? 'متوسط' : 'مبتدئ'})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {assignedWorker && getExperienceBadge(assignedWorker.experienceLevel)}
                            </div>

                            {/* Add Item to Group Button */}
                            <button
                              onClick={() => setAddingToGroupId(group.groupId)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                              title="إضافة صنف يدوياً إلى هذه المجموعة"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isRtl ? 'إضافة صنف' : 'Add Item'}</span>
                            </button>

                            {/* Difficulty Selector */}
                            <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">{isRtl ? 'الصعوبة:' : 'Difficulty:'}</span>
                              <select
                                value={group.difficulty}
                                onChange={(e) => handleDifficultyChange(group.groupId, e.target.value as GroupDifficultyLevel)}
                                className="bg-transparent text-xs font-bold text-slate-100 focus:outline-none cursor-pointer"
                              >
                                <option value="HIGH_EXPERT" className="bg-slate-900 text-red-300">{isRtl ? 'صعبة (خبير)' : 'High (Expert)'}</option>
                                <option value="MEDIUM_INTERMEDIATE" className="bg-slate-900 text-amber-300">{isRtl ? 'متوسطة' : 'Medium'}</option>
                                <option value="LOW_NOVICE" className="bg-slate-900 text-emerald-300">{isRtl ? 'سهلة (مبتدئ)' : 'Low (Novice)'}</option>
                              </select>
                            </div>

                            {/* PDF Worker Slip Export Button */}
                            <button
                              onClick={() => exportWorkerPickingSheetPdf(activeWave, group, assignedWorker)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                              title={isRtl ? 'طباعة كشف وتذكرة التجهيز الخاصة بالعامل' : 'Print Worker Picking Slip'}
                            >
                              <Printer className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="hidden sm:inline">{isRtl ? 'كشف العامل (PDF)' : 'Worker Slip'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Packaging Breakdown Summary Banner for Group */}
                        <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-slate-400 font-bold">{isRtl ? 'آلية تجميع العبوات للمجموعة:' : 'Packaging Breakdown:'}</span>
                            <span className="bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2.5 py-1 rounded-lg font-mono font-bold">
                              📦 {group.totalCartons} {isRtl ? 'كرتونة' : 'Cartons'}
                            </span>
                            <span className="bg-purple-950/60 text-purple-300 border border-purple-800/60 px-2.5 py-1 rounded-lg font-mono font-bold">
                              🧃 {group.totalPacks} {isRtl ? 'باكت' : 'Packs'}
                            </span>
                            <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-2.5 py-1 rounded-lg font-mono font-bold">
                              🔹 {group.totalPieces} {isRtl ? 'حبات فردية' : 'Loose Pieces'}
                            </span>
                            <span className="text-slate-400 font-mono">
                              = <strong>{group.totalQty}</strong> {isRtl ? 'إجمالي الحبات' : 'Total Pcs'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            {group.items.length} {isRtl ? 'أصناف مدمجة الكود' : 'Aggregated SKUs'}
                          </div>
                        </div>

                        {/* Group Items Table with Touch Header Locking and Manual Quantity Edit */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                              <tr>
                                <th className="p-3 text-center w-12">#</th>
                                <th className="p-3">{isRtl ? 'كود الصنف / الباركود' : 'Item Barcode'}</th>
                                <th className="p-3">{isRtl ? 'اسم وبيان الصنف' : 'Item Description'}</th>
                                <th className="p-3 text-center">{isRtl ? 'إجمالي المطلوب' : 'Total Qty'}</th>

                                {/* TOUCH LOCKABLE HEADER: Cartons */}
                                <th
                                  onClick={() => {
                                    setActiveTargetColumn('cartons');
                                    if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                                  }}
                                  className={`p-3 text-center cursor-pointer transition-all ${
                                    activeTargetColumn === 'cartons'
                                      ? 'bg-amber-500/30 text-amber-300 border-b-2 border-amber-400 font-black'
                                      : 'text-amber-300/80 hover:bg-slate-800'
                                  }`}
                                  title="المس لتثبيت تسجيل المسح في عمود الكراتين"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    {activeTargetColumn === 'cartons' && <Pin className="w-3 h-3 text-amber-400 animate-bounce" />}
                                    <span>{isRtl ? 'الكراتين' : 'Cartons'}</span>
                                  </div>
                                </th>

                                {/* TOUCH LOCKABLE HEADER: Packs */}
                                <th
                                  onClick={() => {
                                    setActiveTargetColumn('packs');
                                    if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                                  }}
                                  className={`p-3 text-center cursor-pointer transition-all ${
                                    activeTargetColumn === 'packs'
                                      ? 'bg-purple-500/30 text-purple-200 border-b-2 border-purple-400 font-black'
                                      : 'text-purple-300/80 hover:bg-slate-800'
                                  }`}
                                  title="المس لتثبيت تسجيل المسح في عمود الباكتات"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    {activeTargetColumn === 'packs' && <Pin className="w-3 h-3 text-purple-400 animate-bounce" />}
                                    <span>{isRtl ? 'الباكتات' : 'Packs'}</span>
                                  </div>
                                </th>

                                {/* TOUCH LOCKABLE HEADER: Loose */}
                                <th
                                  onClick={() => {
                                    setActiveTargetColumn('pieces');
                                    if (settings.soundEnabled) SoundEffects.playScanMatch(settings.soundVolume);
                                  }}
                                  className={`p-3 text-center cursor-pointer transition-all ${
                                    activeTargetColumn === 'pieces'
                                      ? 'bg-blue-500/30 text-blue-200 border-b-2 border-blue-400 font-black'
                                      : 'text-blue-300/80 hover:bg-slate-800'
                                  }`}
                                  title="المس لتثبيت تسجيل المسح في عمود الحبات"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    {activeTargetColumn === 'pieces' && <Pin className="w-3 h-3 text-blue-400 animate-bounce" />}
                                    <span>{isRtl ? 'حبات متبقية' : 'Loose'}</span>
                                  </div>
                                </th>

                                <th className="p-3 text-center">{isRtl ? 'المحقق / الملتقط' : 'Picked Qty'}</th>
                                <th className="p-3 text-center">{isRtl ? 'الفواتير' : 'Invoices'}</th>
                                <th className="p-3 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                                <th className="p-3 text-center w-10">{isRtl ? 'حذف' : 'Del'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {group.items.map((item, itemIdx) => {
                                const isItemDone = item.status === 'COMPLETED';
                                return (
                                  <tr
                                    key={item.id}
                                    className={`transition-colors ${
                                      isItemDone ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-slate-800/40'
                                    }`}
                                  >
                                    <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                                      {itemIdx + 1}
                                    </td>
                                    <td className="p-3">
                                      <span className="font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                        {item.itemCode}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-semibold text-slate-100">{item.itemName}</div>
                                      <div className="text-[10px] text-slate-400">
                                        {item.unit} | معامل كرتونة: ×{item.cartonFactor} | باكت: ×{item.packFactor}
                                      </div>
                                    </td>

                                    {/* Editable Total Required Qty */}
                                    <td className="p-3 text-center">
                                      {isManualEditMode ? (
                                        <div className="inline-flex flex-col items-center gap-1">
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => handleQuickAdjustItemQty(group.groupId, item.id, -1)}
                                              className="p-1 bg-slate-950 hover:bg-slate-800 rounded text-slate-400 hover:text-white border border-slate-800"
                                              title="إنقاص 1"
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>
                                            <input
                                              type="number"
                                              min="1"
                                              value={item.totalRequiredQty}
                                              onChange={(e) => {
                                                const val = Math.max(1, Number(e.target.value) || 1);
                                                const cFactor = item.cartonFactor || 24;
                                                const pFactor = item.packFactor || 6;
                                                handleUpdateWaveItem(group.groupId, item.id, {
                                                  totalRequiredQty: val,
                                                  cartonsCount: Math.floor(val / cFactor),
                                                  packsCount: Math.floor((val % cFactor) / pFactor),
                                                  piecesCount: (val % cFactor) % pFactor
                                                });
                                              }}
                                              className="w-16 bg-slate-950 border border-indigo-700/80 rounded px-1.5 py-1 text-center font-mono font-black text-indigo-300 focus:outline-none focus:border-indigo-400 shadow-inner"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleQuickAdjustItemQty(group.groupId, item.id, 1)}
                                              className="p-1 bg-slate-950 hover:bg-slate-800 rounded text-indigo-400 hover:text-indigo-300 border border-slate-800"
                                              title="زيادة 1"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>

                                          {/* Quick Adjust Buttons */}
                                          <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                                            <button
                                              type="button"
                                              onClick={() => handleQuickAdjustItemQty(group.groupId, item.id, -10)}
                                              className="px-1 py-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400"
                                              title="إنقاص 10"
                                            >
                                              -10
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleQuickAdjustItemQty(group.groupId, item.id, 10)}
                                              className="px-1 py-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400"
                                              title="زيادة 10"
                                            >
                                              +10
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRebalanceSingleItem(group.groupId, item.id)}
                                              className="px-1 py-0.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 rounded border border-amber-800/40"
                                              title="إعادة موازنة تفكيك العبوات آلياً"
                                            >
                                              ⚡
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="font-mono font-black text-indigo-300 text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block shadow-sm">
                                          {item.totalRequiredQty} <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span>
                                        </div>
                                      )}
                                    </td>

                                    {/* Editable Cartons Count */}
                                    <td className="p-3 text-center">
                                      {isManualEditMode ? (
                                        <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { cartonsCount: Math.max(0, (item.cartonsCount || 0) - 1) })}
                                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <input
                                            type="number"
                                            min="0"
                                            value={item.cartonsCount || 0}
                                            onChange={(e) => handleUpdateWaveItem(group.groupId, item.id, { cartonsCount: Number(e.target.value) || 0 })}
                                            className="w-10 bg-transparent text-center font-mono font-bold text-amber-300 focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { cartonsCount: (item.cartonsCount || 0) + 1 })}
                                            className="p-1 hover:bg-slate-800 rounded text-amber-400 hover:text-amber-300"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="font-mono font-bold text-amber-300 text-xs bg-amber-950/30 border border-amber-800/40 px-2 py-0.5 rounded inline-block">
                                          📦 {item.cartonsCount || 0}
                                        </div>
                                      )}
                                    </td>

                                    {/* Editable Packs Count */}
                                    <td className="p-3 text-center">
                                      {isManualEditMode ? (
                                        <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { packsCount: Math.max(0, (item.packsCount || 0) - 1) })}
                                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <input
                                            type="number"
                                            min="0"
                                            value={item.packsCount || 0}
                                            onChange={(e) => handleUpdateWaveItem(group.groupId, item.id, { packsCount: Number(e.target.value) || 0 })}
                                            className="w-10 bg-transparent text-center font-mono font-bold text-purple-300 focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { packsCount: (item.packsCount || 0) + 1 })}
                                            className="p-1 hover:bg-slate-800 rounded text-purple-400 hover:text-purple-300"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="font-mono font-bold text-purple-300 text-xs bg-purple-950/30 border border-purple-800/40 px-2 py-0.5 rounded inline-block">
                                          🧃 {item.packsCount || 0}
                                        </div>
                                      )}
                                    </td>

                                    {/* Editable Pieces Count */}
                                    <td className="p-3 text-center">
                                      {isManualEditMode ? (
                                        <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { piecesCount: Math.max(0, (item.piecesCount || 0) - 1) })}
                                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <input
                                            type="number"
                                            min="0"
                                            value={item.piecesCount || 0}
                                            onChange={(e) => handleUpdateWaveItem(group.groupId, item.id, { piecesCount: Number(e.target.value) || 0 })}
                                            className="w-10 bg-transparent text-center font-mono font-bold text-blue-300 focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateWaveItem(group.groupId, item.id, { piecesCount: (item.piecesCount || 0) + 1 })}
                                            className="p-1 hover:bg-slate-800 rounded text-blue-400 hover:text-blue-300"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="font-mono font-bold text-blue-300 text-xs bg-blue-950/30 border border-blue-800/40 px-2 py-0.5 rounded inline-block">
                                          🔹 {item.piecesCount || 0}
                                        </div>
                                      )}
                                    </td>

                                    {/* Picked Qty with Stepper */}
                                    <td className="p-3 text-center">
                                      <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateWaveItem(group.groupId, item.id, { pickedQty: Math.max(0, (item.pickedQty || 0) - 1) })}
                                          className="p-1 hover:bg-slate-800 rounded text-slate-400"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          max={item.totalRequiredQty}
                                          value={item.pickedQty}
                                          onChange={(e) => handleUpdateWaveItem(group.groupId, item.id, { pickedQty: Math.min(item.totalRequiredQty, Number(e.target.value) || 0) })}
                                          className="w-10 bg-transparent text-center font-mono font-bold text-emerald-400 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateWaveItem(group.groupId, item.id, { pickedQty: Math.min(item.totalRequiredQty, (item.pickedQty || 0) + 1) })}
                                          className="p-1 hover:bg-slate-800 rounded text-emerald-400"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>

                                    {/* Invoices Breakdown Button */}
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => setSelectedItemForDetails(item)}
                                        className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-900/50 px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>{item.invoiceSources.length} {isRtl ? 'فواتير' : 'Invs'}</span>
                                      </button>
                                    </td>

                                    {/* Pick Action / Toggle */}
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => handleToggleItemPicked(group.groupId, item.id)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto ${
                                          isItemDone
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                        }`}
                                      >
                                        <CheckCircle2 className={`w-3.5 h-3.5 ${isItemDone ? 'text-white' : 'text-slate-500'}`} />
                                        <span>{isItemDone ? (isRtl ? 'تم' : 'Done') : (isRtl ? 'التقاط' : 'Pick')}</span>
                                      </button>
                                    </td>

                                    {/* Delete Item */}
                                    <td className="p-3 text-center">
                                      {isManualEditMode ? (
                                        <button
                                          onClick={() => handleRemoveItemFromGroup(group.groupId, item.id)}
                                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
                                          title="حذف الصنف من قائمة التجهيز"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <span className="text-slate-600 p-1 cursor-not-allowed" title="التعديل اليدوي معطل">
                                          <Lock className="w-3 h-3" />
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-10 text-center space-y-4 max-w-xl mx-auto my-8 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mx-auto shadow-inner">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-white">
                  {isRtl ? 'ابدأ بتكوين قائمة انتقاء جديدة من الإكسيل' : 'Start a New Batch Picking Wave'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isRtl 
                    ? 'قم برفع ملف إكسيل يحتوي على بيانات كميات الفواتير مفصلة، وسيقوم النظام فوراً بتجميع الكميات ذات الكود الواحد، واحتساب الكراتين والعبوات، وإسنادها للعمال حسب مستويات الخبرة والصعوبة.'
                    : 'Upload a multi-invoice Excel file to aggregate item quantities, compute packaging breakdown, and assign wave tasks to workers based on experience.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <label className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg ring-1 ring-indigo-400">
                  <Upload className="w-4 h-4" />
                  <span>{isRtl ? 'رفع ملف إكسيل الفواتير' : 'Upload Invoices Excel'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={downloadPickingExcelTemplate}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span>{isRtl ? 'تحميل نموذج إكسيل تجريبي' : 'Download Sample'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WAREHOUSE WORKERS & EXPERIENCE MANAGEMENT                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'workers' && (
        <div className="space-y-5">
          {/* Worker Addition & Edit Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">
                  {editingWorkerId ? (isRtl ? 'تعديل بيانات عامل التجهيز' : 'Edit Warehouse Worker') : (isRtl ? 'إضافة عامل تجهيز جديد لقاعدة البيانات' : 'Add New Warehouse Worker')}
                </h3>
              </div>
              {editingWorkerId && (
                <button
                  onClick={() => {
                    setEditingWorkerId(null);
                    setNewWorkerName('');
                    setNewWorkerCode('');
                    setNewWorkerLevel('INTERMEDIATE');
                    setNewWorkerSpecialty('');
                    setNewWorkerPhone('');
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {isRtl ? 'إلغاء التعديل' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  {isRtl ? 'اسم العامل *' : 'Worker Name *'}
                </label>
                <input
                  type="text"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  placeholder={isRtl ? 'مثال: أحمد عبد الله' : 'e.g. Ahmed Ali'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  {isRtl ? 'كود / رقم العامل (Barcode/ID)' : 'Worker Code / ID'}
                </label>
                <input
                  type="text"
                  value={newWorkerCode}
                  onChange={(e) => setNewWorkerCode(e.target.value)}
                  placeholder="EMP-101"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  {isRtl ? 'مستوى الخبرة في التجهيز *' : 'Experience Level *'}
                </label>
                <select
                  value={newWorkerLevel}
                  onChange={(e) => setNewWorkerLevel(e.target.value as WorkerExperienceLevel)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
                >
                  <option value="EXPERT">{isRtl ? '⭐️⭐️⭐️ عامل خبير (للمنتجات الحساسة والصعبة)' : 'Expert (Fragile & Complex)'}</option>
                  <option value="INTERMEDIATE">{isRtl ? '⭐️⭐️ عامل متوسط (للتجهيز العادي والغذائيات)' : 'Intermediate (Standard)'}</option>
                  <option value="NOVICE">{isRtl ? '⭐️ عامل مبتدئ (للكراتين المقفلة والسريعة)' : 'Novice (Fast / Bulk)'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">
                  {isRtl ? 'التخصص أو القسم المفضل' : 'Specialty / Notes'}
                </label>
                <input
                  type="text"
                  value={newWorkerSpecialty}
                  onChange={(e) => setNewWorkerSpecialty(e.target.value)}
                  placeholder={isRtl ? 'مثال: زجاجيات، أدوية، معلبات...' : 'e.g. Fragile, Cold chain...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveWorker}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{editingWorkerId ? (isRtl ? 'تحديث بيانات العامل' : 'Update Worker') : (isRtl ? 'حفظ العامل في قاعدة البيانات' : 'Save Worker')}</span>
              </button>
            </div>
          </div>

          {/* Workers Database Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">{isRtl ? 'جدول عمال المستودع ومستويات خبراتهم المسجلة' : 'Warehouse Workers Directory'}</h3>
              </div>
              <span className="text-xs text-slate-400">
                {workers.length} {isRtl ? 'عمال مسجلين' : 'Registered Workers'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">{isRtl ? 'اسم العامل' : 'Worker Name'}</th>
                    <th className="p-3">{isRtl ? 'كود العامل' : 'Code / ID'}</th>
                    <th className="p-3">{isRtl ? 'مستوى الخبرة' : 'Experience Level'}</th>
                    <th className="p-3">{isRtl ? 'التخصص والملاحظات' : 'Specialty'}</th>
                    <th className="p-3 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {workers.map((w, idx) => (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-bold text-white">{w.name}</td>
                      <td className="p-3 font-mono text-indigo-300 font-bold">{w.code}</td>
                      <td className="p-3">{getExperienceBadge(w.experienceLevel)}</td>
                      <td className="p-3 text-slate-300 text-xs">{w.specialty || '-'}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleWorkerStatus(w)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            w.isActive
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {w.isActive ? (isRtl ? 'متاح للتجهيز' : 'Active') : (isRtl ? 'غير متاح' : 'Inactive')}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditWorker(w)}
                            className="text-slate-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800"
                            title={isRtl ? 'تعديل' : 'Edit'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWorker(w.id)}
                            className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-slate-800"
                            title={isRtl ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SAVED PICKING WAVES HISTORY (WITH RE-OPEN & READ-ONLY MODAL)       */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black text-white">{isRtl ? 'سجل قوائم وموجات الانتقاء المعتمدة والمحفوظة' : 'Saved Waves History'}</h3>
                  <p className="text-xs text-slate-400">{savedWaves.length} {isRtl ? 'موجة مسجلة في النظام' : 'Waves recorded'}</p>
                </div>
              </div>
              {savedWaves.length > 0 && (
                <button
                  onClick={() => exportAllPickingWavesToExcel(savedWaves)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isRtl ? 'تصدير كافة الموجات (Excel)' : 'Export All Waves to Excel'}</span>
                </button>
              )}
            </div>

            {savedWaves.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {isRtl ? 'لا توجد موجات انتقاء محفوظة حتى الآن' : 'No saved picking waves yet'}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {savedWaves.map((wave) => (
                  <div key={wave.id} className="p-4 hover:bg-slate-800/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-xs">
                          {wave.waveNo}
                        </span>
                        <h4 className="text-sm font-bold text-white">{wave.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          wave.status === 'COMPLETED' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}>
                          {wave.status === 'COMPLETED' ? <Lock className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-indigo-400" />}
                          <span>{wave.status === 'COMPLETED' ? (isRtl ? 'مكتمل ومقفل' : 'Completed') : wave.status}</span>
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                        <span>{wave.totalInvoicesCount} {isRtl ? 'فواتير' : 'Invoices'}</span>
                        <span>•</span>
                        <span>{wave.totalItemsCount} {isRtl ? 'أصناف مجمعة' : 'SKUs'}</span>
                        <span>•</span>
                        <span>{wave.totalQuantity} {isRtl ? 'حبة' : 'Pcs'}</span>
                        <span>•</span>
                        <span>{wave.totalCartons} {isRtl ? 'كرتونة' : 'Cartons'}</span>
                        <span>•</span>
                        <span>{new Date(wave.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Read-only Document Preview Button */}
                      <button
                        onClick={() => setViewingWave(wave)}
                        className="bg-slate-800 hover:bg-slate-700 text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-indigo-900/40"
                        title={isRtl ? 'عرض تفاصيل الموجة للقراءة فقط' : 'View Wave Document'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'عرض المستند' : 'View'}</span>
                      </button>

                      {/* Reopen Wave Button with Secure Prompt */}
                      <button
                        onClick={() => handleRequestReopenWave(wave)}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-amber-500/40"
                        title={isRtl ? 'طلب إعادة فتح موجة الانتقاء للتعديل' : 'Reopen Wave'}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'إعادة فتح' : 'Reopen'}</span>
                      </button>

                      <button
                        onClick={() => exportPickingWaveToExcel(wave)}
                        className="bg-slate-800 hover:bg-slate-700 text-emerald-400 p-2 rounded-xl"
                        title={isRtl ? 'تصدير إكسيل' : 'Export Excel'}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      <button
                        onClick={async () => {
                          if (window.confirm(isRtl ? 'حذف هذه الموجة؟' : 'Delete wave?')) {
                            await deletePickingWave(wave.id);
                            const updated = await getAllPickingWaves();
                            setSavedWaves(updated);
                            if (activeWave?.id === wave.id) setActiveWave(null);
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-red-400 p-2 rounded-xl"
                        title={isRtl ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOM ITEM TO GROUP                                           */}
      {/* ========================================================================= */}
      {addingToGroupId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>{isRtl ? 'إضافة صنف يدوياً لقائمة الانتقاء' : 'Add Item to Wave'}</span>
              </h3>
              <button onClick={() => setAddingToGroupId(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">كود الصنف / الباركود *</label>
                <input
                  type="text"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  placeholder="ITEM-101"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">اسم الصنف / البيان</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="اسم المنتج أو الصنف..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Number(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">معامل الكرتونة</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemCartonFactor}
                    onChange={(e) => setNewItemCartonFactor(Number(e.target.value) || 24)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">معامل الباكت</label>
                  <input
                    type="number"
                    min="1"
                    value={newItemPackFactor}
                    onChange={(e) => setNewItemPackFactor(Number(e.target.value) || 6)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-purple-300 font-mono text-center"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAddingToGroupId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddItemToGroup}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md"
              >
                إضافة للقائمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: READ-ONLY PREVIEW OF SAVED PICKING WAVE                            */}
      {/* ========================================================================= */}
      {viewingWave && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">
                  عرض مستند موجة الانتقاء المكتملة (للقراءة فقط)
                </h3>
              </div>
              <button onClick={() => setViewingWave(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400">رقم الموجة</div>
                <div className="text-xs font-mono font-bold text-amber-300">{viewingWave.waveNo}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">عنوان الموجة</div>
                <div className="text-xs font-bold text-white">{viewingWave.title}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">الفواتير والأصناف</div>
                <div className="text-xs font-mono font-bold text-blue-300">
                  {viewingWave.totalInvoicesCount} فواتير | {viewingWave.totalItemsCount} أصناف
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">إجمالي الحبات والكراتين</div>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {viewingWave.totalQuantity} حبة ({viewingWave.totalCartons} كرتونة)
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {viewingWave.groups.map((group, idx) => (
                <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white">{group.groupName}</span>
                    <span className="text-slate-400 font-mono">{group.items.length} أصناف | {group.totalQty} حبة</span>
                  </div>
                  <table className="w-full text-xs text-slate-300 text-right">
                    <thead className="bg-slate-900 text-slate-400 text-[10px]">
                      <tr>
                        <th className="p-1.5">الصنف</th>
                        <th className="p-1.5 text-center">المطلوب</th>
                        <th className="p-1.5 text-center">الكراتين</th>
                        <th className="p-1.5 text-center">الباكتات</th>
                        <th className="p-1.5 text-center">الحبات</th>
                        <th className="p-1.5 text-center">الملتقط</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {group.items.map((it, itIdx) => (
                        <tr key={itIdx}>
                          <td className="p-1.5">
                            <span className="font-mono text-amber-300">{it.itemCode}</span> - {it.itemName}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-indigo-300">{it.totalRequiredQty}</td>
                          <td className="p-1.5 text-center font-mono text-amber-300">{it.cartonsCount || 0}</td>
                          <td className="p-1.5 text-center font-mono text-purple-300">{it.packsCount || 0}</td>
                          <td className="p-1.5 text-center font-mono text-blue-300">{it.piecesCount || 0}</td>
                          <td className="p-1.5 text-center font-mono text-emerald-400">{it.pickedQty || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  const toReopen = viewingWave;
                  setViewingWave(null);
                  handleRequestReopenWave(toReopen);
                }}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-500/40"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>طلب إعادة فتح للتعديل</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportPickingWaveToExcel(viewingWave)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير إكسيل</span>
                </button>

                <button
                  onClick={() => setViewingWave(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RE-OPEN CONFIRMATION SECURITY MODAL (نعم / لا / إلغاء)                      */}
      {/* ========================================================================= */}
      {reopenPrompt && (
        <ReopenConfirmationModal
          isOpen={reopenPrompt.isOpen}
          onClose={() => setReopenPrompt(null)}
          onDeny={() => setReopenPrompt(null)}
          onConfirm={reopenPrompt.onConfirm}
          documentTitle={reopenPrompt.title}
          documentTypeLabel="قائمة وموجة انتقال مقفلة"
          isRtl={isRtl}
        />
      )}

      {/* Modal: Invoices Breakdown for Aggregated Item */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">
                  {isRtl ? 'تفصيل الفواتير والطلبات للصنف المجمع' : 'Invoices Breakdown for Aggregated Item'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <div className="text-xs font-mono text-amber-300 font-bold">{selectedItemForDetails.itemCode}</div>
              <div className="text-sm font-bold text-white">{selectedItemForDetails.itemName}</div>
              <div className="text-xs text-slate-400 flex items-center gap-3 pt-1">
                <span>{isRtl ? 'إجمالي الكمية المطلوبة:' : 'Total Qty:'} <strong className="text-indigo-300">{selectedItemForDetails.totalRequiredQty} {selectedItemForDetails.unit}</strong></span>
                <span>•</span>
                <span>{isRtl ? 'الكراتين:' : 'Cartons:'} <strong className="text-amber-300">{selectedItemForDetails.cartonsCount}</strong></span>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-300">
                {isRtl ? 'الفواتير التي تطلب هذا الصنف:' : 'Requested by Invoices:'}
              </div>
              <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden">
                {selectedItemForDetails.invoiceSources.map((source, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/40 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-blue-300 font-mono">
                        {isRtl ? 'فاتورة #' : 'Invoice #'}{source.invoiceNo}
                      </div>
                      {source.customerName && (
                        <div className="text-[11px] text-slate-400">{source.customerName}</div>
                      )}
                    </div>
                    <div className="font-black text-white font-mono bg-slate-800 px-2 py-0.5 rounded">
                      {source.qty} {selectedItemForDetails.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItemForDetails(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packaging Rules Modal */}
      <PackagingRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        rules={packagingRules}
        onRulesUpdated={(updated) => setPackagingRules(updated)}
        isRtl={isRtl}
      />

      {/* Pre-Report Worker Audit & Manual Adjustment Modal */}
      {activeWave && (
        <PreReportAuditModal
          isOpen={isPreReportAuditModalOpen}
          onClose={() => setIsPreReportAuditModalOpen(false)}
          wave={activeWave}
          workers={workers}
          onAssignWorker={handleAssignWorkerToGroup}
          onDifficultyChange={handleDifficultyChange}
          onUpdateItemQty={handleUpdateWaveItem}
          onExportExcel={() => exportPickingWaveToExcel(activeWave)}
          onExportWorkerSlip={(group, worker) => exportWorkerPickingSheetPdf(activeWave, group, worker)}
          onApproveAndLock={handleLockWave}
          isRtl={isRtl}
        />
      )}
    </div>
  );
};
