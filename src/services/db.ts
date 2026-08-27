import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { 
  MasterInvoiceItem, 
  AuditDiscrepancy, 
  WrongPickingItem,
  InvoiceAuditHistory, 
  ActiveInvoiceSession, 
  SyncMetadata,
  AppSettings,
  IncompleteInvoiceRecord,
  CompletedInvoiceRecord,
  ReturnReport,
  WarehouseWorker,
  BatchPickingWave,
  PickingProductGroup,
  PackagingGroupRule,
  AggregatedPickingItem,
  WorkerExperienceLevel,
  GroupDifficultyLevel,
  DailyAuditSnapshot,
  AppUser,
  UserRole
} from '../types';

interface InvoiceAuditorDB extends DBSchema {
  master_items: {
    key: number;
    value: MasterInvoiceItem;
    indexes: {
      'by-invoice': string;
      'by-order': string;
      'by-item-code': string;
      'by-invoice-item': [string, string];
    };
  };
  audit_errors: {
    key: number;
    value: AuditDiscrepancy;
    indexes: {
      'by-invoice': string;
      'by-order': string;
      'by-date': string;
      'by-code-status': string;
      'by-qty-status': string;
    };
  };
  wrong_pickings: {
    key: number;
    value: WrongPickingItem;
    indexes: {
      'by-active-invoice': string;
      'by-order': string;
      'by-item-code': string;
      'by-date': string;
    };
  };
  audit_history: {
    key: number;
    value: InvoiceAuditHistory;
    indexes: {
      'by-invoice': string;
      'by-order': string;
      'by-date': string;
    };
  };
  key_value: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'OfflineInvoiceAuditorDB';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<InvoiceAuditorDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<InvoiceAuditorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<InvoiceAuditorDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        // 1. Master Items store
        let masterStore: any;
        if (!db.objectStoreNames.contains('master_items')) {
          masterStore = db.createObjectStore('master_items', {
            keyPath: 'id',
            autoIncrement: true,
          });
          masterStore.createIndex('by-invoice', 'invoiceNo');
          masterStore.createIndex('by-order', 'orderNo');
          masterStore.createIndex('by-item-code', 'itemCode');
          masterStore.createIndex('by-invoice-item', ['invoiceNo', 'itemCode']);
        } else {
          masterStore = transaction.objectStore('master_items');
          if (masterStore && !masterStore.indexNames.contains('by-order')) {
            masterStore.createIndex('by-order', 'orderNo');
          }
        }

        // 2. Audit Errors Store
        let errorStore: any;
        if (!db.objectStoreNames.contains('audit_errors')) {
          errorStore = db.createObjectStore('audit_errors', {
            keyPath: 'id',
            autoIncrement: true,
          });
          errorStore.createIndex('by-invoice', 'invoiceNo');
          errorStore.createIndex('by-order', 'orderNo');
          errorStore.createIndex('by-date', 'auditedAt');
          errorStore.createIndex('by-code-status', 'codeStatus');
          errorStore.createIndex('by-qty-status', 'qtyStatus');
        } else {
          errorStore = transaction.objectStore('audit_errors');
          if (errorStore && !errorStore.indexNames.contains('by-order')) {
            errorStore.createIndex('by-order', 'orderNo');
          }
        }

        // 3. Wrong Pickings Store (Items scanned that do NOT belong to active invoice)
        let wrongStore: any;
        if (!db.objectStoreNames.contains('wrong_pickings')) {
          wrongStore = db.createObjectStore('wrong_pickings', {
            keyPath: 'id',
            autoIncrement: true,
          });
          wrongStore.createIndex('by-active-invoice', 'activeInvoiceNo');
          wrongStore.createIndex('by-order', 'orderNo');
          wrongStore.createIndex('by-item-code', 'itemCode');
          wrongStore.createIndex('by-date', 'scannedAt');
        }

        // 4. Audit History Store
        let historyStore: any;
        if (!db.objectStoreNames.contains('audit_history')) {
          historyStore = db.createObjectStore('audit_history', {
            keyPath: 'id',
            autoIncrement: true,
          });
          historyStore.createIndex('by-invoice', 'invoiceNo');
          historyStore.createIndex('by-order', 'orderNo');
          historyStore.createIndex('by-date', 'completedAt');
        } else {
          historyStore = transaction.objectStore('audit_history');
          if (historyStore && !historyStore.indexNames.contains('by-order')) {
            historyStore.createIndex('by-order', 'orderNo');
          }
        }

        // 5. Key Value Store
        if (!db.objectStoreNames.contains('key_value')) {
          db.createObjectStore('key_value');
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// Master Items Operations
export async function saveMasterInvoiceItems(
  items: MasterInvoiceItem[], 
  fileName: string | null = null
): Promise<SyncMetadata> {
  const db = await getDB();
  const tx = db.transaction(['master_items', 'key_value'], 'readwrite');
  
  // Clear previous master items
  await tx.objectStore('master_items').clear();

  // Batch insert new items
  const store = tx.objectStore('master_items');
  const invoiceSet = new Set<string>();
  
  let indexCounter = 0;
  for (const item of items) {
    const sanitized: MasterInvoiceItem = {
      orderNo: item.orderNo?.trim() || undefined,
      invoiceNo: item.invoiceNo.trim(),
      itemCode: item.itemCode.trim(),
      itemName: item.itemName.trim(),
      unit: (item.unit || 'PCS').trim().toUpperCase(),
      requiredQty: Number(item.requiredQty) || 0,
      importedAt: new Date().toISOString(),
      originalIndex: item.originalIndex !== undefined ? item.originalIndex : indexCounter++,
    };
    invoiceSet.add(sanitized.invoiceNo);
    await store.add(sanitized);
  }

  const syncMeta: SyncMetadata = {
    lastSyncDate: new Date().toISOString(),
    totalInvoices: invoiceSet.size,
    totalItems: items.length,
    fileName,
  };

  await tx.objectStore('key_value').put(syncMeta, 'sync_metadata');
  await tx.objectStore('key_value').delete('completed_invoices_map');
  await tx.objectStore('key_value').delete('incomplete_invoices_map');
  await tx.objectStore('key_value').delete('active_session');
  await tx.objectStore('key_value').delete('is_batch_closed_and_counters_zeroed');
  await tx.done;

  return syncMeta;
}

export async function saveMasterItems(items: MasterInvoiceItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('master_items', 'readwrite');
  const store = tx.objectStore('master_items');
  for (const item of items) {
    await store.add({
      ...item,
      importedAt: item.importedAt || new Date().toISOString(),
    });
  }
  await tx.done;
}

export async function getSyncMetadata(): Promise<SyncMetadata> {
  const db = await getDB();
  const meta = await db.get('key_value', 'sync_metadata');
  return (meta as SyncMetadata) || {
    lastSyncDate: null,
    totalInvoices: 0,
    totalItems: 0,
    fileName: null,
  };
}

export async function getInvoiceMasterItems(invoiceNo: string): Promise<MasterInvoiceItem[]> {
  const db = await getDB();
  const clean = invoiceNo.trim();
  const all = await db.getAll('master_items');
  
  // Search by exact or case-insensitive invoiceNo OR orderNo
  const matched = all.filter(item => 
    item.invoiceNo.toLowerCase() === clean.toLowerCase() ||
    (item.orderNo && item.orderNo.toLowerCase() === clean.toLowerCase())
  );

  return matched;
}

export async function getAllMasterItems(): Promise<MasterInvoiceItem[]> {
  const db = await getDB();
  return db.getAll('master_items');
}

export async function getAllUniqueInvoices(): Promise<{ invoiceNo: string; orderNo?: string; itemCount: number; totalQty: number }[]> {
  const db = await getDB();
  const allItems = await db.getAll('master_items');
  
  const invoiceMap = new Map<string, { orderNo?: string; itemCount: number; totalQty: number }>();
  for (const item of allItems) {
    const existing = invoiceMap.get(item.invoiceNo) || { orderNo: item.orderNo, itemCount: 0, totalQty: 0 };
    existing.itemCount += 1;
    existing.totalQty += item.requiredQty;
    if (item.orderNo && !existing.orderNo) existing.orderNo = item.orderNo;
    invoiceMap.set(item.invoiceNo, existing);
  }

  return Array.from(invoiceMap.entries()).map(([invoiceNo, stats]) => ({
    invoiceNo,
    orderNo: stats.orderNo,
    itemCount: stats.itemCount,
    totalQty: stats.totalQty,
  }));
}

export async function doesInvoiceExist(query: string): Promise<boolean> {
  const db = await getDB();
  const clean = query.trim().toLowerCase();
  const all = await db.getAll('master_items');
  return all.some(item => 
    item.invoiceNo.toLowerCase() === clean || 
    (item.orderNo && item.orderNo.toLowerCase() === clean)
  );
}

// Active Session Persistence
export async function saveActiveSession(session: ActiveInvoiceSession | null): Promise<void> {
  const db = await getDB();
  if (session) {
    await db.put('key_value', session, 'active_session');
  } else {
    await db.delete('key_value', 'active_session');
  }
}

export async function getActiveSession(): Promise<ActiveInvoiceSession | null> {
  const db = await getDB();
  const session = await db.get('key_value', 'active_session');
  return (session as ActiveInvoiceSession) || null;
}

// Incomplete (Deferred) Invoices Queue Operations
export async function saveIncompleteInvoice(record: IncompleteInvoiceRecord): Promise<void> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'incomplete_invoices_map')) as Record<string, IncompleteInvoiceRecord>) || {};
  currentMap[record.invoiceNo.toLowerCase()] = record;
  if (record.orderNo) {
    currentMap[record.orderNo.toLowerCase()] = record;
  }
  await db.put('key_value', currentMap, 'incomplete_invoices_map');
}

export async function getAllIncompleteInvoices(): Promise<IncompleteInvoiceRecord[]> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'incomplete_invoices_map')) as Record<string, IncompleteInvoiceRecord>) || {};
  const uniqueRecords = new Map<string, IncompleteInvoiceRecord>();
  for (const record of Object.values(currentMap)) {
    uniqueRecords.set(record.invoiceNo, record);
  }
  return Array.from(uniqueRecords.values()).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export async function getIncompleteInvoice(query: string): Promise<IncompleteInvoiceRecord | null> {
  const db = await getDB();
  const clean = query.trim().toLowerCase();
  const currentMap = ((await db.get('key_value', 'incomplete_invoices_map')) as Record<string, IncompleteInvoiceRecord>) || {};
  return currentMap[clean] || null;
}

export async function deleteIncompleteInvoice(invoiceNo: string): Promise<void> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'incomplete_invoices_map')) as Record<string, IncompleteInvoiceRecord>) || {};
  const target = currentMap[invoiceNo.toLowerCase()];
  delete currentMap[invoiceNo.toLowerCase()];
  if (target?.orderNo) {
    delete currentMap[target.orderNo.toLowerCase()];
  }
  await db.put('key_value', currentMap, 'incomplete_invoices_map');
}

// Completed Invoices Operations (Blocks re-scanning)
export async function markInvoiceAsCompleted(record: CompletedInvoiceRecord): Promise<void> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'completed_invoices_map')) as Record<string, CompletedInvoiceRecord>) || {};
  currentMap[record.invoiceNo.toLowerCase()] = record;
  if (record.orderNo) {
    currentMap[record.orderNo.toLowerCase()] = record;
  }
  await db.put('key_value', currentMap, 'completed_invoices_map');
  
  // Also remove from incomplete if it was previously deferred
  await deleteIncompleteInvoice(record.invoiceNo);
}

export async function getAllCompletedInvoices(): Promise<CompletedInvoiceRecord[]> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'completed_invoices_map')) as Record<string, CompletedInvoiceRecord>) || {};
  const uniqueRecords = new Map<string, CompletedInvoiceRecord>();
  for (const record of Object.values(currentMap)) {
    uniqueRecords.set(record.invoiceNo, record);
  }
  return Array.from(uniqueRecords.values()).sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export async function isInvoiceCompleted(query: string): Promise<CompletedInvoiceRecord | null> {
  const db = await getDB();
  const clean = query.trim().toLowerCase();
  const currentMap = ((await db.get('key_value', 'completed_invoices_map')) as Record<string, CompletedInvoiceRecord>) || {};
  return currentMap[clean] || null;
}

export async function reopenCompletedInvoice(invoiceNo: string): Promise<void> {
  const db = await getDB();
  const currentMap = ((await db.get('key_value', 'completed_invoices_map')) as Record<string, CompletedInvoiceRecord>) || {};
  const target = currentMap[invoiceNo.toLowerCase()];
  delete currentMap[invoiceNo.toLowerCase()];
  if (target?.orderNo) {
    delete currentMap[target.orderNo.toLowerCase()];
  }
  await db.put('key_value', currentMap, 'completed_invoices_map');
}

// Daily Audit Snapshots and Counters History
export async function saveDailyAuditSnapshot(snapshot: DailyAuditSnapshot): Promise<void> {
  const db = await getDB();
  const currentList = ((await db.get('key_value', 'daily_audit_snapshots')) as DailyAuditSnapshot[]) || [];
  // Update if same id exists or prepend
  const filtered = currentList.filter(s => s.id !== snapshot.id);
  filtered.unshift(snapshot);
  await db.put('key_value', filtered, 'daily_audit_snapshots');
  await db.put('key_value', snapshot, 'latest_daily_audit_snapshot');
  await db.put('key_value', true, 'is_batch_closed_and_counters_zeroed');
}

export async function getLatestDailyAuditSnapshot(): Promise<DailyAuditSnapshot | null> {
  const db = await getDB();
  const snapshot = await db.get('key_value', 'latest_daily_audit_snapshot');
  return (snapshot as DailyAuditSnapshot) || null;
}

export async function getAllDailyAuditSnapshots(): Promise<DailyAuditSnapshot[]> {
  const db = await getDB();
  const list = await db.get('key_value', 'daily_audit_snapshots');
  return (list as DailyAuditSnapshot[]) || [];
}

export async function isBatchClosedAndCountersZeroed(): Promise<boolean> {
  const db = await getDB();
  const val = await db.get('key_value', 'is_batch_closed_and_counters_zeroed');
  return Boolean(val);
}

export async function resetActiveBatchCountersState(): Promise<void> {
  const db = await getDB();
  await db.delete('key_value', 'is_batch_closed_and_counters_zeroed');
  await db.delete('key_value', 'latest_daily_audit_snapshot');
}

// Global Audit Counters
export async function getInvoicesAuditSummaryStats(): Promise<{
  totalInvoices: number;
  completedCount: number;
  incompleteCount: number;
  remainingCount: number;
}> {
  const [allInvoices, completedList, incompleteList] = await Promise.all([
    getAllUniqueInvoices(),
    getAllCompletedInvoices(),
    getAllIncompleteInvoices(),
  ]);

  const totalInvoices = allInvoices.length;
  const completedCount = completedList.length;
  const incompleteCount = incompleteList.length;
  const remainingCount = Math.max(0, totalInvoices - completedCount);

  return {
    totalInvoices,
    completedCount,
    incompleteCount,
    remainingCount,
  };
}

// Audit Errors Operations
export async function saveAuditDiscrepancies(discrepancies: AuditDiscrepancy[]): Promise<void> {
  if (discrepancies.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('audit_errors', 'readwrite');
  for (const disc of discrepancies) {
    await tx.store.add(disc);
  }
  await tx.done;
}

export async function getAllAuditDiscrepancies(): Promise<AuditDiscrepancy[]> {
  const db = await getDB();
  const all = await db.getAll('audit_errors');
  return all.sort((a, b) => new Date(b.auditedAt).getTime() - new Date(a.auditedAt).getTime());
}

export async function clearAllAuditDiscrepancies(): Promise<void> {
  const db = await getDB();
  await db.clear('audit_errors');
  await db.clear('audit_history');
}

export async function deleteAuditDiscrepancy(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('audit_errors', id);
}

// Wrong Pickings Operations (Items scanned that do NOT belong to active invoice)
export async function saveWrongPicking(record: Omit<WrongPickingItem, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('wrong_pickings', record as WrongPickingItem);
}

export async function getAllWrongPickings(): Promise<WrongPickingItem[]> {
  const db = await getDB();
  const all = await db.getAll('wrong_pickings');
  return all.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
}

export async function getWrongPickingsByInvoice(invoiceNo: string): Promise<WrongPickingItem[]> {
  const db = await getDB();
  const clean = invoiceNo.trim().toLowerCase();
  const all = await db.getAll('wrong_pickings');
  return all.filter(item => item.activeInvoiceNo.toLowerCase() === clean);
}

export async function clearAllWrongPickings(): Promise<void> {
  const db = await getDB();
  await db.clear('wrong_pickings');
}

export async function deleteWrongPicking(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('wrong_pickings', id);
}

// Helper to look up if a scanned barcode belongs to ANY invoice in master database
export async function findItemBelonging(barcode: string): Promise<{
  invoiceNo: string;
  orderNo?: string;
  itemName: string;
  unit: string;
  requiredQty: number;
} | null> {
  const db = await getDB();
  const clean = barcode.trim().toLowerCase();
  const allMaster = await db.getAll('master_items');
  
  const found = allMaster.find(m => m.itemCode.toLowerCase() === clean);
  if (!found) return null;

  return {
    invoiceNo: found.invoiceNo,
    orderNo: found.orderNo,
    itemName: found.itemName,
    unit: found.unit,
    requiredQty: found.requiredQty,
  };
}

// Audit History Operations
export async function saveAuditHistory(history: InvoiceAuditHistory): Promise<void> {
  const db = await getDB();
  await db.add('audit_history', history);
}

export async function getAllAuditHistory(): Promise<InvoiceAuditHistory[]> {
  const db = await getDB();
  const all = await db.getAll('audit_history');
  return all.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

// Settings
export const DEFAULT_SETTINGS: AppSettings = {
  language: 'ar',
  soundEnabled: true,
  soundVolume: 0.8,
  vibrationEnabled: true,
  scannerPrefixInvoice: 'INV-',
  scannerMinLength: 3,
  autoSwitchOnNewInvoice: true,
  itemSortMode: 'LAST_SCANNED',
  enableCameraQr: true,
  longBarcodeThreshold: 10,
  auditorName: 'أحمد حمادة',
  auditorId: 'AUD-101',
  auditorTitle: 'مدير ومراقب عمليات المستودع',
};

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get('key_value', 'app_settings');
  return { ...DEFAULT_SETTINGS, ...((settings as AppSettings) || {}) };
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('key_value', settings, 'app_settings');
}

// -------------------------------------------------------------------
// Packaging Grouping Rules (قائمة شروط ومعادلات وقوائم العبوات والاسناد)
// -------------------------------------------------------------------
export const DEFAULT_PACKAGING_RULES: PackagingGroupRule[] = [
  {
    id: 'grp-knife-steel-1',
    name: 'أطقم سكاكين ستيل',
    startBarcode: '114110001',
    endBarcode: '115412004',
    systemUnit: 'DZ',
    baseUnit: 'HDZ',
    unitName: 'HDZ',
    cartonSizeSystemUnit: '6 DZ',
    cartonSizeBaseUnit: '12 HDZ',
    packSizeDesc: '6 PCS',
    boxesPerCarton: 12,
    conversionEquation: 'HDZ=.5DZ',
    cartonEquation: '1CARTON=12BOX(HDZ)=6DZ',
    cartonFactor: 12,
    packFactor: 1,
    difficultyLevel: 'HIGH_EXPERT',
    assignedRoleDesc: 'خبير (عامل خبرة)',
    category: 'أدوات مطبخ وسكاكين',
    isActive: true,
    notes: 'من باركود 114110001 الى باركود 115412004',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-knife-steel-v-2',
    name: 'أطقم سكاكين ستيل V',
    startBarcode: '184000571',
    endBarcode: '184100017',
    systemUnit: 'DZ',
    baseUnit: 'HDZ',
    unitName: 'HDZ',
    cartonSizeSystemUnit: '6 DZ',
    cartonSizeBaseUnit: '12 HDZ',
    packSizeDesc: '6 PCS',
    boxesPerCarton: 12,
    conversionEquation: 'HDZ=.5DZ',
    cartonEquation: '1CARTON=12BOX(HDZ)=6DZ',
    cartonFactor: 12,
    packFactor: 1,
    difficultyLevel: 'HIGH_EXPERT',
    assignedRoleDesc: 'خبير (عامل خبرة)',
    category: 'أدوات مطبخ وسكاكين',
    isActive: true,
    notes: 'من باركود 184000571 الى باركود 184100017',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-cutlery-forks-spoons-3',
    name: 'أطقم شوك وملاعق',
    startBarcode: '130110001',
    endBarcode: '138412003',
    systemUnit: 'DZ',
    baseUnit: 'HDZ',
    unitName: 'HDZ',
    cartonSizeSystemUnit: '6 DZ',
    cartonSizeBaseUnit: '12 HDZ',
    packSizeDesc: '6 PCS',
    boxesPerCarton: 12,
    conversionEquation: 'HDZ=.5DZ',
    cartonEquation: '1CARTON=12BOX(HDZ)=6DZ',
    cartonFactor: 12,
    packFactor: 1,
    difficultyLevel: 'HIGH_EXPERT',
    assignedRoleDesc: 'خبير (عامل خبرة)',
    category: 'شوك وملاعق',
    isActive: true,
    notes: 'من باركود 130110001 الى باركود 138412003',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-cutlery-box-dz-4',
    name: 'أطقم شوك وملاعق فردية بوكس بالدستة',
    startBarcode: '116100551',
    endBarcode: '116190191',
    systemUnit: 'DZ',
    baseUnit: 'DZ',
    unitName: 'DZ',
    cartonSizeSystemUnit: '1 DZ',
    cartonSizeBaseUnit: '12 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 2,
    conversionEquation: 'EA=1/12DZ',
    cartonEquation: '1CARTON=2BOX=12EA',
    cartonFactor: 1,
    packFactor: 0.5,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'شوك وملاعق فردية',
    isActive: true,
    notes: 'من باركود 116100551 الى باركود 116190191',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-cutlery-box-ea-5',
    name: 'أطقم شوك وملاعق فردية بوكس بالحبة',
    startBarcode: '116100551',
    endBarcode: '116190191',
    systemUnit: 'EA',
    baseUnit: 'EA',
    unitName: 'EA',
    cartonSizeSystemUnit: '12 EA',
    cartonSizeBaseUnit: '12 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 2,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=2BOX=12EA',
    cartonFactor: 12,
    packFactor: 6,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'شوك وملاعق فردية',
    isActive: true,
    notes: 'من باركود 116100551 الى باركود 116190191',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-cups-paper-plastic-6',
    name: 'أكواب ورق',
    startBarcode: '511107155',
    endBarcode: '740103760',
    systemUnit: 'PCS',
    baseUnit: 'PCS',
    unitName: 'PCS',
    cartonSizeSystemUnit: '20 PCS',
    cartonSizeBaseUnit: '20 PCS',
    packSizeDesc: '5 PCS',
    boxesPerCarton: 4,
    conversionEquation: 'PCS=PCS',
    cartonEquation: '1CARTON=4BOX=20PCS',
    cartonFactor: 20,
    packFactor: 5,
    difficultyLevel: 'LOW_NOVICE',
    assignedRoleDesc: 'مبتدئ (عامل عادي / تجهيز سريع)',
    category: 'مستهلكات وأكواب',
    isActive: true,
    notes: 'من باركود 511107155 الى باركود 740103760',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-food-storage-boxes-7',
    name: 'علب طعام بلاستيك شفاف معتم',
    startBarcode: '361100706',
    endBarcode: '371230207',
    systemUnit: 'PCS',
    baseUnit: 'PCS',
    unitName: 'PCS',
    cartonSizeSystemUnit: '12 PCS',
    cartonSizeBaseUnit: '12 PCS',
    packSizeDesc: '3 PCS',
    boxesPerCarton: 4,
    conversionEquation: 'PCS=PCS',
    cartonEquation: '1CARTON=4BOX=12PCS',
    cartonFactor: 12,
    packFactor: 3,
    difficultyLevel: 'LOW_NOVICE',
    assignedRoleDesc: 'مبتدئ (عامل عادي / تجهيز سريع)',
    category: 'علب وتخزين',
    isActive: true,
    notes: 'من باركود 361100789 الى باركود 371230207',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-serving-pots-8',
    name: 'علب تقديم',
    startBarcode: '910371598',
    endBarcode: '910371695',
    systemUnit: 'EA',
    baseUnit: 'EA',
    unitName: 'EA',
    cartonSizeSystemUnit: '24 EA',
    cartonSizeBaseUnit: '24 EA',
    packSizeDesc: '12 PCS',
    boxesPerCarton: 2,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=2BOX=24EA',
    cartonFactor: 24,
    packFactor: 12,
    difficultyLevel: 'LOW_NOVICE',
    assignedRoleDesc: 'مبتدئ (عامل عادي / تجهيز سريع)',
    category: 'أواني تقديم',
    isActive: true,
    notes: 'من باركود 910371598 الى باركود 910371695',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-serving-boxes-trays-9',
    name: 'علب تقديم مقسم',
    startBarcode: '910375602',
    endBarcode: '910376554',
    systemUnit: 'PCS',
    baseUnit: 'PCS',
    unitName: 'PCS',
    cartonSizeSystemUnit: '12 PCS',
    cartonSizeBaseUnit: '12 PCS',
    packSizeDesc: '6 PCS',
    boxesPerCarton: 2,
    conversionEquation: 'PCS=PCS',
    cartonEquation: '1CARTON=2BOX=12PCS',
    cartonFactor: 12,
    packFactor: 6,
    difficultyLevel: 'LOW_NOVICE',
    assignedRoleDesc: 'مبتدئ (عامل عادي / تجهيز سريع)',
    category: 'صواني وعلب تقديم',
    isActive: true,
    notes: 'من باركود 910375602 الى باركود 910376554',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-plates-melamine-10',
    name: 'أطباق تقديم ميلامين',
    startBarcode: '910376690',
    endBarcode: '910378505',
    systemUnit: 'PCS',
    baseUnit: 'PCS',
    unitName: 'PCS',
    cartonSizeSystemUnit: '12 PCS',
    cartonSizeBaseUnit: '12 PCS',
    packSizeDesc: '4 PCS',
    boxesPerCarton: 3,
    conversionEquation: 'PCS=PCS',
    cartonEquation: '1CARTON=3BOX=12PCS',
    cartonFactor: 12,
    packFactor: 4,
    difficultyLevel: 'LOW_NOVICE',
    assignedRoleDesc: 'مبتدئ (عامل عادي / تجهيز سريع)',
    category: 'أطباق تقديم',
    isActive: true,
    notes: 'من باركود 910376690 الى باركود 910378505',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-luxury-cutlery-dz-11',
    name: 'أطقم سكاكين وملاعق مذهبة بالدستة',
    startBarcode: '910378516',
    endBarcode: '910378632',
    systemUnit: 'DZ',
    baseUnit: 'DZ',
    unitName: 'DZ',
    cartonSizeSystemUnit: '2 DZ',
    cartonSizeBaseUnit: '24 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 4,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=4BOX=24EA',
    cartonFactor: 2,
    packFactor: 0.5,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'أطقم فاخرة',
    isActive: true,
    notes: 'من باركود 910378516 الى باركود 910378632',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-luxury-cutlery-ea-12',
    name: 'أطقم سكاكين وملاعق مذهبة بالحبة',
    startBarcode: '910378516',
    endBarcode: '910378632',
    systemUnit: 'EA',
    baseUnit: 'EA',
    unitName: 'EA',
    cartonSizeSystemUnit: '24 EA',
    cartonSizeBaseUnit: '24 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 4,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=4BOX=24EA',
    cartonFactor: 24,
    packFactor: 6,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'أطقم فاخرة',
    isActive: true,
    notes: 'من باركود 910378516 الى باركود 910378632',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-large-cutlery-dz-13',
    name: 'أطقم شوك وملاعق مقاس كبير بالدستة',
    startBarcode: '910378633',
    endBarcode: '910378999',
    systemUnit: 'DZ',
    baseUnit: 'DZ',
    unitName: 'DZ',
    cartonSizeSystemUnit: '4 DZ',
    cartonSizeBaseUnit: '48 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 8,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=8BOX=48EA',
    cartonFactor: 4,
    packFactor: 0.5,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'شوك وسكاكين مقاس كبير',
    isActive: true,
    notes: 'من باركود 910378633 الى باركود 910378999',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'grp-large-cutlery-ea-14',
    name: 'أطقم شوك وملاعق مقاس كبير بالحبة',
    startBarcode: '910378633',
    endBarcode: '910378999',
    systemUnit: 'EA',
    baseUnit: 'EA',
    unitName: 'EA',
    cartonSizeSystemUnit: '48 EA',
    cartonSizeBaseUnit: '48 EA',
    packSizeDesc: '6 EA',
    boxesPerCarton: 8,
    conversionEquation: 'EA=EA',
    cartonEquation: '1CARTON=8BOX=48EA',
    cartonFactor: 48,
    packFactor: 6,
    difficultyLevel: 'MEDIUM_INTERMEDIATE',
    assignedRoleDesc: 'متوسط (عامل متوسط الخبرة)',
    category: 'شوك وسكاكين مقاس كبير',
    isActive: true,
    notes: 'من باركود 910378633 الى باركود 910378999',
    createdAt: new Date().toISOString(),
  }
];

// جدول مصفوفة الصعوبة والإسناد المرجعي
export const WORKER_ASSIGNMENT_MATRIX = [
  {
    difficulty: 'سهل',
    assignment: 'مبتدئ',
    workerLevelDesc: 'عامل عادي / تجهيز سريع',
  },
  {
    difficulty: 'متوسط',
    assignment: 'متوسط',
    workerLevelDesc: 'عامل متوسط الخبرة',
  },
  {
    difficulty: 'صعب',
    assignment: 'خبير',
    workerLevelDesc: 'عامل خبرة',
  },
  {
    difficulty: 'ممتاز / حرج',
    assignment: 'خبير + مساعد',
    workerLevelDesc: 'عامل خبرة ومعه مساعد أو عمالين',
  },
];

export async function getPackagingGroupRules(): Promise<PackagingGroupRule[]> {
  const db = await getDB();
  const rules = await db.get('key_value', 'packaging_group_rules');
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    await db.put('key_value', DEFAULT_PACKAGING_RULES, 'packaging_group_rules');
    return DEFAULT_PACKAGING_RULES;
  }
  return rules as PackagingGroupRule[];
}

export async function savePackagingGroupRules(rules: PackagingGroupRule[]): Promise<void> {
  const db = await getDB();
  await db.put('key_value', rules, 'packaging_group_rules');
}

export async function resetPackagingGroupRulesToDefault(): Promise<PackagingGroupRule[]> {
  const db = await getDB();
  await db.put('key_value', DEFAULT_PACKAGING_RULES, 'packaging_group_rules');
  return DEFAULT_PACKAGING_RULES;
}

/**
 * Calculates accurate packaging breakdown (Cartons, Packs/Boxes, Loose Pieces)
 * based on item quantity, item unit, and packaging rule formulas.
 */
export function calculatePackagingBreakdown(
  qty: number,
  itemUnit: string,
  rule?: PackagingGroupRule | null
): {
  cartonsCount: number;
  packsCount: number;
  piecesCount: number;
  cartonFactor: number;
  packFactor: number;
  cartonEquation: string;
  conversionEquation: string;
  formattedBreakdown: string;
} {
  const unit = String(itemUnit || '').toUpperCase().trim();
  
  if (!rule) {
    const cf = 24;
    const pf = 6;
    const cartons = Math.floor(qty / cf);
    const rem = qty % cf;
    const packs = Math.floor(rem / pf);
    const pieces = rem % pf;
    return {
      cartonsCount: cartons,
      packsCount: packs,
      piecesCount: pieces,
      cartonFactor: cf,
      packFactor: pf,
      cartonEquation: '1CARTON=4BOX=24PCS',
      conversionEquation: 'PCS=PCS',
      formattedBreakdown: `${cartons} كرتونة + ${packs} باكت + ${pieces} حبة`,
    };
  }

  const cartonEq = rule.cartonEquation || '';
  const convEq = rule.conversionEquation || '';

  // 1. Formula: 1CARTON=12BOX(HDZ)=6DZ
  if (cartonEq.includes('12BOX') && cartonEq.includes('6DZ')) {
    if (unit === 'DZ' || unit === 'دستة') {
      const cartons = Math.floor(qty / 6);
      const remDZ = qty % 6;
      const hdzTotal = remDZ * 2; // 1 DZ = 2 HDZ
      const packs = Math.floor(hdzTotal);
      const pieces = Math.round((hdzTotal - packs) * 6);
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 6,
        packFactor: 0.5,
        cartonEquation: rule.cartonEquation || '1CARTON=12BOX(HDZ)=6DZ',
        conversionEquation: rule.conversionEquation || 'HDZ=.5DZ',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس(نصف دستة) + ${pieces} حبة`,
      };
    } else if (unit === 'HDZ' || unit === 'نصف دستة') {
      const cartons = Math.floor(qty / 12);
      const remHDZ = qty % 12;
      const packs = Math.floor(remHDZ);
      const pieces = 0;
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 12,
        packFactor: 1,
        cartonEquation: rule.cartonEquation || '1CARTON=12BOX(HDZ)=6DZ',
        conversionEquation: rule.conversionEquation || 'HDZ=.5DZ',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس(نصف دستة)`,
      };
    } else {
      // PCS / EA
      const totalPieces = qty;
      const cartons = Math.floor(totalPieces / 72);
      const rem = totalPieces % 72;
      const packs = Math.floor(rem / 6);
      const pieces = rem % 6;
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 72,
        packFactor: 6,
        cartonEquation: rule.cartonEquation || '1CARTON=12BOX(HDZ)=6DZ',
        conversionEquation: rule.conversionEquation || 'HDZ=.5DZ',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    }
  }

  // 2. Formula: 1CARTON=2BOX=12EA
  if (cartonEq.includes('2BOX') && cartonEq.includes('12EA')) {
    if (unit === 'DZ' || unit === 'دستة') {
      const cartons = Math.floor(qty);
      const remDZ = qty % 1;
      const packs = Math.floor(remDZ * 2);
      const pieces = Math.round((remDZ * 2 - packs) * 6);
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 1,
        packFactor: 0.5,
        cartonEquation: rule.cartonEquation || '1CARTON=2BOX=12EA',
        conversionEquation: rule.conversionEquation || 'EA=1/12DZ',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    } else {
      const cartons = Math.floor(qty / 12);
      const rem = qty % 12;
      const packs = Math.floor(rem / 6);
      const pieces = rem % 6;
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 12,
        packFactor: 6,
        cartonEquation: rule.cartonEquation || '1CARTON=2BOX=12EA',
        conversionEquation: rule.conversionEquation || 'EA=EA',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    }
  }

  // 3. Formula: 1CARTON=4BOX=24EA
  if (cartonEq.includes('4BOX') && cartonEq.includes('24EA')) {
    if (unit === 'DZ' || unit === 'دستة') {
      const cartons = Math.floor(qty / 2);
      const remDZ = qty % 2;
      const packs = Math.floor(remDZ * 2);
      const pieces = Math.round((remDZ * 2 - packs) * 6);
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 2,
        packFactor: 0.5,
        cartonEquation: rule.cartonEquation || '1CARTON=4BOX=24EA',
        conversionEquation: rule.conversionEquation || 'EA=EA',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    } else {
      const cartons = Math.floor(qty / 24);
      const rem = qty % 24;
      const packs = Math.floor(rem / 6);
      const pieces = rem % 6;
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 24,
        packFactor: 6,
        cartonEquation: rule.cartonEquation || '1CARTON=4BOX=24EA',
        conversionEquation: rule.conversionEquation || 'EA=EA',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    }
  }

  // 4. Formula: 1CARTON=8BOX=48EA
  if (cartonEq.includes('8BOX') && cartonEq.includes('48EA')) {
    if (unit === 'DZ' || unit === 'دستة') {
      const cartons = Math.floor(qty / 4);
      const remDZ = qty % 4;
      const packs = Math.floor(remDZ * 2);
      const pieces = Math.round((remDZ * 2 - packs) * 6);
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 4,
        packFactor: 0.5,
        cartonEquation: rule.cartonEquation || '1CARTON=8BOX=48EA',
        conversionEquation: rule.conversionEquation || 'EA=EA',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    } else {
      const cartons = Math.floor(qty / 48);
      const rem = qty % 48;
      const packs = Math.floor(rem / 6);
      const pieces = rem % 6;
      return {
        cartonsCount: cartons,
        packsCount: packs,
        piecesCount: pieces,
        cartonFactor: 48,
        packFactor: 6,
        cartonEquation: rule.cartonEquation || '1CARTON=8BOX=48EA',
        conversionEquation: rule.conversionEquation || 'EA=EA',
        formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} حبة`,
      };
    }
  }

  // Standard / Direct Factor Calculation
  const cf = rule.cartonFactor || 24;
  const pf = rule.packFactor || 6;
  const cartons = Math.floor(qty / cf);
  const rem = qty % cf;
  const packs = pf > 0 ? Math.floor(rem / pf) : 0;
  const pieces = pf > 0 ? rem % pf : rem;

  return {
    cartonsCount: cartons,
    packsCount: packs,
    piecesCount: pieces,
    cartonFactor: cf,
    packFactor: pf,
    cartonEquation: rule.cartonEquation || `1CARTON=${rule.boxesPerCarton || 4}BOX=${cf}${rule.unitName || 'PCS'}`,
    conversionEquation: rule.conversionEquation || `${rule.unitName || 'PCS'}=${rule.unitName || 'PCS'}`,
    formattedBreakdown: `${cartons} كرتونة + ${packs} بوكس + ${pieces} ${rule.unitName || 'حبة'}`,
  };
}

/**
 * Creates a 2-Phase Consolidated Picking Wave directly from all Master Invoices in DB
 * Aggregates all SKU quantities across all invoices for the day (Phase 1)
 * and attaches detailed invoice sources for individual preparation (Phase 2).
 */
export function createPickingWaveFromMasterItems(
  items: MasterInvoiceItem[], 
  rules: PackagingGroupRule[],
  creatorName = 'مشرف التجهيز'
): BatchPickingWave {
  const invoiceSet = new Set<string>();
  // Map keyed by itemCode to aggregate across all invoices
  const itemMap = new Map<string, {
    itemCode: string;
    itemName: string;
    unit: string;
    totalRequiredQty: number;
    sources: { invoiceNo: string; orderNo?: string; qty: number }[];
  }>();

  items.forEach(item => {
    const inv = item.invoiceNo.trim();
    invoiceSet.add(inv);
    const code = item.itemCode.trim();
    const qty = Number(item.requiredQty) || 0;

    if (!itemMap.has(code)) {
      itemMap.set(code, {
        itemCode: code,
        itemName: item.itemName.trim(),
        unit: item.unit || 'PCS',
        totalRequiredQty: qty,
        sources: [{ invoiceNo: inv, orderNo: item.orderNo, qty }]
      });
    } else {
      const existing = itemMap.get(code)!;
      existing.totalRequiredQty += qty;
      const src = existing.sources.find(s => s.invoiceNo === inv);
      if (src) {
        src.qty += qty;
      } else {
        existing.sources.push({ invoiceNo: inv, orderNo: item.orderNo, qty });
      }
    }
  });

  const groupMap = new Map<string, {
    groupId: string;
    groupName: string;
    difficulty: GroupDifficultyLevel;
    cartonEquation?: string;
    conversionEquation?: string;
    systemUnit?: string;
    baseUnit?: string;
    items: AggregatedPickingItem[];
  }>();

  let waveTotalQty = 0;
  let waveTotalCartons = 0;
  let waveTotalPacks = 0;
  let waveTotalPieces = 0;

  for (const itemData of itemMap.values()) {
    const matchedRule = matchBarcodeToPackagingRule(itemData.itemCode, rules);
    const breakdown = calculatePackagingBreakdown(itemData.totalRequiredQty, itemData.unit, matchedRule);

    const systemUnit = matchedRule?.systemUnit || itemData.unit || 'حبة';
    const baseUnit = matchedRule?.baseUnit || matchedRule?.unitName || itemData.unit || 'حبة';
    const gId = matchedRule ? matchedRule.id : 'general';
    const gName = matchedRule ? matchedRule.name : 'مجموعة عامة (تجهيز قياسي)';
    const difficulty: GroupDifficultyLevel = matchedRule?.difficultyLevel || 'MEDIUM_INTERMEDIATE';

    waveTotalQty += itemData.totalRequiredQty;
    waveTotalCartons += breakdown.cartonsCount;
    waveTotalPacks += breakdown.packsCount;
    waveTotalPieces += breakdown.piecesCount;

    const aggregatedItem: AggregatedPickingItem = {
      id: `pick-item-${itemData.itemCode}-${Date.now()}`,
      itemCode: itemData.itemCode,
      itemName: itemData.itemName,
      unit: itemData.unit,
      systemUnit,
      baseUnit,
      groupId: gId,
      groupName: gName,
      totalRequiredQty: itemData.totalRequiredQty,
      pickedQty: 0,
      cartonFactor: breakdown.cartonFactor,
      packFactor: breakdown.packFactor,
      cartonsCount: breakdown.cartonsCount,
      packsCount: breakdown.packsCount,
      piecesCount: breakdown.piecesCount,
      boxesPerCarton: matchedRule?.boxesPerCarton,
      cartonEquation: breakdown.cartonEquation,
      conversionEquation: breakdown.conversionEquation,
      packSizeDesc: matchedRule?.packSizeDesc,
      cartonSizeDesc: matchedRule?.cartonSizeSystemUnit,
      invoiceSources: itemData.sources,
      status: 'PENDING',
      location: 'ممر التخزين الرئيسي',
      notes: matchedRule?.notes || '',
    };

    if (!groupMap.has(gId)) {
      groupMap.set(gId, {
        groupId: gId,
        groupName: gName,
        difficulty,
        cartonEquation: breakdown.cartonEquation,
        conversionEquation: breakdown.conversionEquation,
        systemUnit,
        baseUnit,
        items: [aggregatedItem]
      });
    } else {
      groupMap.get(gId)!.items.push(aggregatedItem);
      if (difficulty === 'HIGH_EXPERT') {
        groupMap.get(gId)!.difficulty = 'HIGH_EXPERT';
      }
    }
  }

  const groups: PickingProductGroup[] = Array.from(groupMap.values()).map(g => {
    const groupQty = g.items.reduce((sum, it) => sum + it.totalRequiredQty, 0);
    const groupCartons = g.items.reduce((sum, it) => sum + it.cartonsCount, 0);
    const groupPacks = g.items.reduce((sum, it) => sum + it.packsCount, 0);
    const groupPieces = g.items.reduce((sum, it) => sum + it.piecesCount, 0);
    
    const grpInvoices = new Set<string>();
    g.items.forEach(it => it.invoiceSources.forEach(s => grpInvoices.add(s.invoiceNo)));

    return {
      groupId: g.groupId,
      groupName: g.groupName,
      difficulty: g.difficulty,
      cartonEquation: g.cartonEquation,
      conversionEquation: g.conversionEquation,
      systemUnit: g.systemUnit,
      baseUnit: g.baseUnit,
      items: g.items,
      totalQty: groupQty,
      totalCartons: groupCartons,
      totalPacks: groupPacks,
      totalPieces: groupPieces,
      invoicesCount: grpInvoices.size,
      status: 'PENDING'
    };
  });

  return {
    id: `wave-${Date.now()}`,
    waveNo: `WAVE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    title: `قائمة انتقاء مجمعة لطلبات اليوم (${invoiceSet.size} فواتير - ${itemMap.size} صنف)`,
    createdAt: new Date().toISOString(),
    createdBy: creatorName,
    totalInvoicesCount: invoiceSet.size,
    invoiceNumbers: Array.from(invoiceSet),
    totalItemsCount: itemMap.size,
    totalQuantity: waveTotalQty,
    totalCartons: waveTotalCartons,
    totalPacks: waveTotalPacks,
    totalPieces: waveTotalPieces,
    groups,
    status: 'DRAFT',
    phase1Completed: false,
    preparedInvoices: []
  };
}

/**
 * Performs smart automatic assignment of picking product groups to warehouse workers
 * according to difficulty levels and worker experience.
 */
export function performSmartWorkerAssignment(
  groups: PickingProductGroup[],
  workers: WarehouseWorker[]
): PickingProductGroup[] {
  const activeWorkers = workers.filter(w => w.isActive);
  if (activeWorkers.length === 0) return groups;

  const expertWorkers = activeWorkers.filter(w => w.experienceLevel === 'EXPERT');
  const intermediateWorkers = activeWorkers.filter(w => w.experienceLevel === 'INTERMEDIATE');
  const noviceWorkers = activeWorkers.filter(w => w.experienceLevel === 'NOVICE');

  // Track workload count per worker
  const workerLoad = new Map<string, number>();
  activeWorkers.forEach(w => workerLoad.set(w.id, 0));

  const getBestWorker = (preferredPool: WarehouseWorker[], fallbackPools: WarehouseWorker[][]): WarehouseWorker => {
    const pickLeastLoaded = (pool: WarehouseWorker[]) => {
      if (pool.length === 0) return null;
      let minWorker = pool[0];
      let minLoad = workerLoad.get(minWorker.id) || 0;
      for (const w of pool) {
        const load = workerLoad.get(w.id) || 0;
        if (load < minLoad) {
          minLoad = load;
          minWorker = w;
        }
      }
      return minWorker;
    };

    let selected = pickLeastLoaded(preferredPool);
    if (!selected) {
      for (const pool of fallbackPools) {
        selected = pickLeastLoaded(pool);
        if (selected) break;
      }
    }
    if (!selected) {
      selected = activeWorkers[0];
    }
    workerLoad.set(selected.id, (workerLoad.get(selected.id) || 0) + 1);
    return selected;
  };

  return groups.map(group => {
    let chosenWorker: WarehouseWorker;

    if (group.difficulty === 'HIGH_EXPERT') {
      chosenWorker = getBestWorker(expertWorkers, [intermediateWorkers, noviceWorkers]);
    } else if (group.difficulty === 'MEDIUM_INTERMEDIATE') {
      chosenWorker = getBestWorker(intermediateWorkers, [expertWorkers, noviceWorkers]);
    } else {
      // LOW_NOVICE
      chosenWorker = getBestWorker(noviceWorkers, [intermediateWorkers, expertWorkers]);
    }

    return {
      ...group,
      assignedWorkerId: chosenWorker.id,
      assignedWorkerName: chosenWorker.name,
      assignedWorkerLevel: chosenWorker.experienceLevel,
    };
  });
}

/**
 * Matches a scanned or imported barcode against active grouping rules
 */
export function matchBarcodeToPackagingRule(barcode: string, rules: any[]): any | null {
  const clean = barcode.trim();
  if (!clean) return null;

  for (const rule of rules) {
    if (!rule.isActive) continue;
    
    // Check if barcode falls lexicographically or numerically within startBarcode and endBarcode
    const start = String(rule.startBarcode || '').trim();
    const end = String(rule.endBarcode || '').trim();

    if (start && end) {
      if (/^\d+$/.test(clean) && /^\d+$/.test(start) && /^\d+$/.test(end)) {
        const numVal = BigInt(clean);
        const numStart = BigInt(start);
        const numEnd = BigInt(end);
        if (numVal >= numStart && numVal <= numEnd) {
          return rule;
        }
      } else {
        if (clean >= start && clean <= end) {
          return rule;
        }
      }
    }
  }
  return null;
}

/**
 * Searches for a packaging group rule by group barcode (e.g. GRP-1, rule ID, start/end barcode, or product barcode)
 */
export function findPackagingRuleByGroupScan(scanCode: string, rules: any[]): any | null {
  const clean = scanCode.trim().toLowerCase();
  if (!clean) return null;

  // 1. Check exact ID or prefix
  const byId = rules.find(r => 
    r.id?.toLowerCase() === clean || 
    clean === `grp-${r.id?.toLowerCase()}` ||
    clean === `group-${r.id?.toLowerCase()}`
  );
  if (byId) return byId;

  // 2. Check rule start/end barcode
  const byBoundary = rules.find(r => 
    String(r.startBarcode || '').trim() === scanCode.trim() ||
    String(r.endBarcode || '').trim() === scanCode.trim()
  );
  if (byBoundary) return byBoundary;

  // 3. Check rule name or category match
  const byName = rules.find(r => 
    r.name?.toLowerCase().includes(clean) || 
    (r.category && r.category.toLowerCase() === clean)
  );
  if (byName) return byName;

  // 4. Fallback to range match
  return matchBarcodeToPackagingRule(scanCode, rules);
}

// -------------------------------------------------------------------
// Returns & Quality Inspection & Refund Reports Operations
// -------------------------------------------------------------------
export async function getAllReturnReports(): Promise<ReturnReport[]> {
  const db = await getDB();
  const list = (await db.get('key_value', 'saved_return_reports')) as ReturnReport[] || [];
  
  // Calculate overdue status (> 24 hours / 1 business day) dynamically
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  return list.map(r => {
    const createdTime = new Date(r.createdAt).getTime();
    const isOverdue = r.status === 'PENDING_LAB' && (now - createdTime >= ONE_DAY_MS);
    return {
      ...r,
      returnReceiptNo: r.returnReceiptNo || r.rmaNo || `RET-${r.id.slice(-6)}`,
      paymentMethod: r.paymentMethod || 'CASH',
      isOverdueForLab: isOverdue,
    };
  });
}

export async function getOverdueLabReportsCount(): Promise<number> {
  const all = await getAllReturnReports();
  return all.filter(r => r.isOverdueForLab).length;
}

export async function saveReturnReport(report: ReturnReport): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_return_reports') as ReturnReport[]) || [];
  const receiptNo = report.returnReceiptNo || report.rmaNo || `RET-${Date.now()}`;
  
  const sanitizedReport: ReturnReport = {
    ...report,
    returnReceiptNo: receiptNo,
    rmaNo: receiptNo,
  };

  const filtered = current.filter(r => r.id !== sanitizedReport.id && (r.returnReceiptNo !== receiptNo && r.rmaNo !== receiptNo));
  filtered.unshift(sanitizedReport);
  await db.put('key_value', filtered, 'saved_return_reports');
}

export async function deleteReturnReport(id: string): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_return_reports') as ReturnReport[]) || [];
  const filtered = current.filter(r => r.id !== id);
  await db.put('key_value', filtered, 'saved_return_reports');
}

// -------------------------------------------------------------------
// Inbound Receiving Reports Operations (سجلات الاستلام والتوريدات)
// -------------------------------------------------------------------
export async function getAllReceivingReports(): Promise<any[]> {
  const db = await getDB();
  const list = await db.get('key_value', 'saved_receiving_reports');
  return (list as any[]) || [];
}

export async function saveReceivingReport(report: any): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_receiving_reports') as any[]) || [];
  const filtered = current.filter(r => r.id !== report.id && r.poNumber !== report.poNumber);
  filtered.unshift(report);
  await db.put('key_value', filtered, 'saved_receiving_reports');
}

export async function deleteReceivingReport(id: string): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_receiving_reports') as any[]) || [];
  const filtered = current.filter(r => r.id !== id);
  await db.put('key_value', filtered, 'saved_receiving_reports');
}

// -------------------------------------------------------------------
// Cycle Count & Inventory Reports Operations (سجلات الجرد وتجميع العبوات)
// -------------------------------------------------------------------
export async function getAllInventoryReports(): Promise<any[]> {
  const db = await getDB();
  const list = await db.get('key_value', 'saved_inventory_reports');
  return (list as any[]) || [];
}

export async function saveInventoryReport(report: any): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_inventory_reports') as any[]) || [];
  const filtered = current.filter(r => r.id !== report.id);
  filtered.unshift(report);
  await db.put('key_value', filtered, 'saved_inventory_reports');
}

export async function deleteInventoryReport(id: string): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_inventory_reports') as any[]) || [];
  const filtered = current.filter(r => r.id !== id);
  await db.put('key_value', filtered, 'saved_inventory_reports');
}

// -------------------------------------------------------------------
// Warehouse Workers & Experience Management (إدارة عمال التجهيز والمستودع)
// -------------------------------------------------------------------
export const DEFAULT_WAREHOUSE_WORKERS: WarehouseWorker[] = [
  {
    id: 'worker-1',
    name: 'أحمد إبراهيم (خبير تجهيز)',
    code: 'EMP-EXP-101',
    experienceLevel: 'EXPERT',
    isActive: true,
    specialty: 'المنتجات الحساسة، الأدوية، والزجاجيات والأصناف المعقدة',
    phone: '0501234567',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'worker-2',
    name: 'محمود عبد الرحمن (خبير تجهيز)',
    code: 'EMP-EXP-102',
    experienceLevel: 'EXPERT',
    isActive: true,
    specialty: 'الأصناف المتشابهة بالباركود وذات الدقة العالية',
    phone: '0502345678',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'worker-3',
    name: 'سالم الدوسري (متوسط الخبرة)',
    code: 'EMP-MED-201',
    experienceLevel: 'INTERMEDIATE',
    isActive: true,
    specialty: 'المواد الغذائية، العبوات المتوسطة، والمشروبات',
    phone: '0503456789',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'worker-4',
    name: 'طارق العلي (متوسط الخبرة)',
    code: 'EMP-MED-202',
    experienceLevel: 'INTERMEDIATE',
    isActive: true,
    specialty: 'المنظفات والعبوات الاستهلاكية والتجهيز العادي',
    phone: '0504567890',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'worker-5',
    name: 'عمر خالد (مبتدئ / تجهيز سريع)',
    code: 'EMP-NOV-301',
    experienceLevel: 'NOVICE',
    isActive: true,
    specialty: 'الكراتين الكاملة، الأصناف الضخمة، والمنتجات السهلة',
    phone: '0505678901',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'worker-6',
    name: 'فهد المنصور (مبتدئ / تجهيز سريع)',
    code: 'EMP-NOV-302',
    experienceLevel: 'NOVICE',
    isActive: true,
    specialty: 'الأصناف الفردية السريعة والكراتين المقفلة',
    phone: '0506789012',
    createdAt: new Date().toISOString(),
  }
];

export async function getWarehouseWorkers(): Promise<WarehouseWorker[]> {
  const db = await getDB();
  const list = await db.get('key_value', 'warehouse_workers');
  return (list as WarehouseWorker[]) || DEFAULT_WAREHOUSE_WORKERS;
}

export async function saveWarehouseWorkers(workers: WarehouseWorker[]): Promise<void> {
  const db = await getDB();
  await db.put('key_value', workers, 'warehouse_workers');
}

export async function addWarehouseWorker(worker: WarehouseWorker): Promise<void> {
  const workers = await getWarehouseWorkers();
  const filtered = workers.filter(w => w.id !== worker.id && w.code !== worker.code);
  filtered.push(worker);
  await saveWarehouseWorkers(filtered);
}

export async function updateWarehouseWorker(worker: WarehouseWorker): Promise<void> {
  const workers = await getWarehouseWorkers();
  const updated = workers.map(w => w.id === worker.id ? worker : w);
  await saveWarehouseWorkers(updated);
}

export async function deleteWarehouseWorker(id: string): Promise<void> {
  const workers = await getWarehouseWorkers();
  const filtered = workers.filter(w => w.id !== id);
  await saveWarehouseWorkers(filtered);
}

// -------------------------------------------------------------------
// Batch Picking Waves Operations (قوائم التقاط الفواتير المجمعة)
// -------------------------------------------------------------------
export async function getAllPickingWaves(): Promise<BatchPickingWave[]> {
  const db = await getDB();
  const list = await db.get('key_value', 'saved_picking_waves');
  return (list as BatchPickingWave[]) || [];
}

export async function savePickingWave(wave: BatchPickingWave): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_picking_waves') as BatchPickingWave[]) || [];
  const filtered = current.filter(w => w.id !== wave.id && w.waveNo !== wave.waveNo);
  filtered.unshift(wave);
  await db.put('key_value', filtered, 'saved_picking_waves');
}

export async function deletePickingWave(id: string): Promise<void> {
  const db = await getDB();
  const current = (await db.get('key_value', 'saved_picking_waves') as BatchPickingWave[]) || [];
  const filtered = current.filter(w => w.id !== id);
  await db.put('key_value', filtered, 'saved_picking_waves');
}

// -------------------------------------------------------------------
// User Management & RBAC Authentication (إدارة المستخدمين والصلاحيات)
// -------------------------------------------------------------------
export const DEFAULT_DEMO_USERS: AppUser[] = [
  {
    id: 'usr-aud-101',
    jobId: 'AUD-101',
    phone: '0501112233',
    name: 'أحمد حمادة',
    role: 'AUDITOR',
    pinCode: '1234',
    department: 'إدارة الرقابة والجودة والتطوير',
    title: 'مراجع ومفتش رقابي أول',
    signatureText: 'المراجع أحمد حمادة - معتمد',
    avatarColor: 'emerald',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-sup-201',
    jobId: 'SUP-201',
    phone: '0502223344',
    name: 'م. خالد الشمري',
    role: 'SUPERVISOR',
    pinCode: '1234',
    department: 'إدارة العمليات واللوجستيات',
    title: 'مشرف المستودع والورديات',
    signatureText: 'المشرف خالد الشمري',
    avatarColor: 'amber',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-wms-301',
    jobId: 'WMS-301',
    phone: '0503334455',
    name: 'محمد إبراهيم',
    role: 'WAREHOUSE_KEEPER',
    pinCode: '1234',
    department: 'قسم الاستلام والتجهيز المركزي',
    title: 'أمين مستودع رئيسي',
    signatureText: 'أمين المستودع م. إبراهيم',
    avatarColor: 'blue',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-gst-001',
    jobId: 'GUEST-01',
    phone: '0500000000',
    name: 'ضيف المستودع التجريبي',
    role: 'GUEST',
    pinCode: '1234',
    department: 'زائر / تدريب',
    title: 'مستخدم تجريبي (قراءة فقط)',
    avatarColor: 'slate',
    createdAt: new Date().toISOString(),
  },
];

export async function getAllAppUsers(): Promise<AppUser[]> {
  const db = await getDB();
  const users = await db.get('key_value', 'app_users');
  if (!users || !Array.isArray(users) || users.length === 0) {
    // Seed default demo accounts
    await db.put('key_value', DEFAULT_DEMO_USERS, 'app_users');
    return DEFAULT_DEMO_USERS;
  }
  return users as AppUser[];
}

export async function saveAppUser(user: AppUser): Promise<void> {
  const db = await getDB();
  const users = await getAllAppUsers();
  const filtered = users.filter(u => u.id !== user.id && u.jobId.toLowerCase() !== user.jobId.toLowerCase());
  filtered.push(user);
  await db.put('key_value', filtered, 'app_users');
}

export async function deleteAppUser(userId: string): Promise<void> {
  const db = await getDB();
  const users = await getAllAppUsers();
  const filtered = users.filter(u => u.id !== userId);
  await db.put('key_value', filtered, 'app_users');
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const db = await getDB();
  const current = await db.get('key_value', 'current_app_user');
  if (current) return current as AppUser;

  // Default to Lead Auditor if not set
  const all = await getAllAppUsers();
  const defaultUser = all.find(u => u.role === 'AUDITOR') || all[0] || DEFAULT_DEMO_USERS[0];
  await setCurrentAppUser(defaultUser);
  return defaultUser;
}

export async function setCurrentAppUser(user: AppUser | null): Promise<void> {
  const db = await getDB();
  await db.put('key_value', user, 'current_app_user');
  if (user) {
    // Also sync with auditor profile settings
    const settings = await getAppSettings();
    await saveAppSettings({
      ...settings,
      auditorName: user.name,
      auditorId: user.jobId,
      auditorTitle: user.title,
      auditorSignature: user.signatureText || `${user.title || user.role} - ${user.name}`,
    });
  }
}

export async function authenticateAppUser(identifier: string, pin: string): Promise<AppUser | null> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPin = pin.trim();
  const users = await getAllAppUsers();

  const user = users.find(u => 
    (u.jobId.toLowerCase() === cleanId || (u.phone && u.phone.trim() === cleanId)) &&
    u.pinCode.trim() === cleanPin
  );

  if (user) {
    const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };
    await saveAppUser(updatedUser);
    await setCurrentAppUser(updatedUser);
    return updatedUser;
  }

  return null;
}

