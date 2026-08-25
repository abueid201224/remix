import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  FileSpreadsheet, 
  Play,
  Hash
} from 'lucide-react';
import { getDB } from '../services/db';
import type { MasterInvoiceItem, SyncMetadata } from '../types';

interface MasterDatabaseViewProps {
  syncMeta: SyncMetadata;
  onOpenSyncModal: () => void;
  onSelectInvoice: (invoiceNo: string) => void;
}

export const MasterDatabaseView: React.FC<MasterDatabaseViewProps> = ({
  syncMeta,
  onOpenSyncModal,
  onSelectInvoice,
}) => {
  const [items, setItems] = useState<MasterInvoiceItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllMasterItems();
  }, [syncMeta]);

  const loadAllMasterItems = async () => {
    setIsLoading(true);
    try {
      const db = await getDB();
      const all = await db.getAll('master_items');
      setItems(all);
    } catch (err) {
      console.error('Failed to load master items', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Unique Invoices
  const invoiceGroups = React.useMemo(() => {
    const map = new Map<string, { orderNo?: string; count: number; totalQty: number; items: MasterInvoiceItem[] }>();
    for (const item of items) {
      const existing = map.get(item.invoiceNo) || { orderNo: item.orderNo, count: 0, totalQty: 0, items: [] };
      existing.count += 1;
      existing.totalQty += item.requiredQty;
      if (item.orderNo && !existing.orderNo) existing.orderNo = item.orderNo;
      existing.items.push(item);
      map.set(item.invoiceNo, existing);
    }
    return Array.from(map.entries()).map(([invoiceNo, data]) => ({
      invoiceNo,
      orderNo: data.orderNo,
      count: data.count,
      totalQty: data.totalQty,
      items: data.items,
    }));
  }, [items]);

  const filteredItems = items.filter((item) => {
    if (selectedInvoice !== 'ALL' && item.invoiceNo !== selectedInvoice) return false;
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      return (
        item.invoiceNo.toLowerCase().includes(query) ||
        (item.orderNo && item.orderNo.toLowerCase().includes(query)) ||
        item.itemCode.toLowerCase().includes(query) ||
        item.itemName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const hasAnyOrderNo = items.some(i => Boolean(i.orderNo));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Daily Master Data & Orders Explorer</h2>
              <p className="text-xs text-slate-400">
                100% offline IndexedDB cache of daily loaded invoice & order lines with barcode matching
              </p>
            </div>
          </div>

          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Update / Sync New File</span>
          </button>
        </div>

        {/* Invoice Summary Cards */}
        {invoiceGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {invoiceGroups.map((group) => (
              <div 
                key={group.invoiceNo}
                className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="font-mono font-bold text-emerald-400 text-sm">{group.invoiceNo}</span>
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      {group.count} Items
                    </span>
                  </div>
                  {group.orderNo && (
                    <div className="mt-1">
                      <span className="text-xs text-indigo-300 font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/40 inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        <span>Order: {group.orderNo}</span>
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Total Required Qty: <strong className="text-slate-200">{group.totalQty}</strong>
                  </p>
                </div>
                <button
                  onClick={() => onSelectInvoice(group.invoiceNo)}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white py-1.5 rounded text-xs font-bold transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Audit</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search master items by Order #, SKU, Name, or Invoice..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <select
            value={selectedInvoice}
            onChange={(e) => setSelectedInvoice(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
          >
            <option value="ALL">All Invoices & Orders ({invoiceGroups.length})</option>
            {invoiceGroups.map((g) => (
              <option key={g.invoiceNo} value={g.invoiceNo}>
                {g.invoiceNo} {g.orderNo ? `(${g.orderNo})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 bg-slate-950 text-xs font-semibold text-slate-400 border-b border-slate-800 flex items-center justify-between">
          <span>Showing {filteredItems.length} of {items.length} Master Line Items</span>
          <span className="font-mono text-[11px] text-emerald-400">Offline Master Store</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase tracking-wider">
              <tr>
                {hasAnyOrderNo && <th className="p-3 pl-4">Order No</th>}
                <th className={`p-3 ${!hasAnyOrderNo ? 'pl-4' : ''}`}>Invoice No</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3 text-center">Unit</th>
                <th className="p-3 text-center">Required Qty</th>
                <th className="p-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={hasAnyOrderNo ? 7 : 6} className="p-8 text-center text-slate-500 font-sans">
                    {items.length === 0 ? 'No master invoice records loaded yet. Click "Update / Sync New File" above.' : 'No records match filter.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-slate-800/40 transition-colors">
                    {hasAnyOrderNo && (
                      <td className="p-3 pl-4">
                        <span className="text-xs font-mono font-semibold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-700/40">
                          {item.orderNo || '-'}
                        </span>
                      </td>
                    )}
                    <td className={`p-3 ${!hasAnyOrderNo ? 'pl-4' : ''} font-bold text-emerald-400`}>{item.invoiceNo}</td>
                    <td className="p-3 font-semibold text-white">{item.itemCode}</td>
                    <td className="p-3 text-slate-300 font-sans">{item.itemName}</td>
                    <td className="p-3 text-center text-slate-400">{item.unit}</td>
                    <td className="p-3 text-center font-bold text-slate-100">{item.requiredQty}</td>
                    <td className="p-3 pr-4 text-right">
                      <button
                        onClick={() => onSelectInvoice(item.invoiceNo)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded text-xs font-sans font-bold transition-colors"
                      >
                        Audit This
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
