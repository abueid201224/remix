import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Layers, 
  Database,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { 
  parseExcelOrCsvFile, 
  generateSampleExcelFile, 
  getSampleDailyItems, 
  type ParseResult 
} from '../services/excelService';
import { saveMasterInvoiceItems } from '../services/db';
import type { SyncMetadata } from '../types';

interface ExcelSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (meta: SyncMetadata) => void;
  currentMeta: SyncMetadata;
}

export const ExcelSyncModal: React.FC<ExcelSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  currentMeta,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(null);
    setFileName(file.name);

    try {
      const result = await parseExcelOrCsvFile(file);
      setParseResult(result);
      if (result.items.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No valid invoice items found. Ensure required columns are present (Invoice_No, Item_Code, Required_Qty).',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: (err as Error).message || 'Failed to parse file. Please upload a valid .xlsx or .csv file.',
      });
      setParseResult(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.items.length === 0) return;
    setIsProcessing(true);
    try {
      const meta = await saveMasterInvoiceItems(parseResult.items, fileName);
      setStatusMessage({
        type: 'success',
        text: `Successfully saved ${meta.totalItems} items across ${meta.totalInvoices} invoices to 100% offline local storage!`,
      });
      setTimeout(() => {
        onSyncComplete(meta);
        onClose();
      }, 900);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Database write failed: ${(err as Error).message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSampleDemo = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const items = getSampleDailyItems();
      const meta = await saveMasterInvoiceItems(items, 'Daily_Warehouse_Demo_Manifest.xlsx');
      setStatusMessage({
        type: 'success',
        text: `Sample daily dataset loaded: ${meta.totalInvoices} invoices & ${meta.totalItems} line items saved to offline storage!`,
      });
      setTimeout(() => {
        onSyncComplete(meta);
        onClose();
      }, 900);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Failed to load demo data: ${(err as Error).message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Daily Excel / CSV Master Sync</h2>
              <p className="text-xs text-slate-400">Import daily dispatch manifests for 100% offline handheld scanning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Active Master Status */}
          {currentMeta.lastSyncDate && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-slate-400">Current Active Manifest: </span>
                  <strong className="text-slate-100">{currentMeta.fileName || 'Daily Data'}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-800/40">
                <span>{currentMeta.totalInvoices} Invoices</span>
                <span>&bull;</span>
                <span>{currentMeta.totalItems} Line Items</span>
              </div>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-400 bg-emerald-950/30'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center gap-2.5">
              <div className="p-3 bg-slate-800 rounded-full text-slate-300 shadow-inner">
                <Upload className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-sm font-semibold text-slate-200">
                Click or drag & drop daily <span className="text-emerald-400 font-mono">.xlsx</span> / <span className="text-emerald-400 font-mono">.csv</span> here
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Files are parsed client-side and saved into IndexedDB. No server upload required.
              </p>
            </div>
          </div>

          {/* Expected Data Structure Info */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Required Input Columns (Auto-Mapped):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
              <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">Invoice_No</div>
              <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">Item_Code</div>
              <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">Item_Name</div>
              <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">Unit</div>
              <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700">Required_Qty</div>
            </div>
          </div>

          {/* Quick Actions: Download Template & Load Demo */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              onClick={generateSampleExcelFile}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Sample Excel Template</span>
            </button>

            <button
              onClick={handleLoadSampleDemo}
              disabled={isProcessing}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 px-3 py-2 rounded-lg border border-amber-800/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load 1-Click Demo Manifest (4 Invoices)</span>
            </button>
          </div>

          {/* Parsed Preview Table */}
          {parseResult && parseResult.items.length > 0 && (
            <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950/60 space-y-2">
              <div className="bg-slate-800/90 px-3 py-2 flex items-center justify-between text-xs font-semibold border-b border-slate-700">
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Ready to Sync: {parseResult.items.length} Line Items
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  File: {fileName}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0 text-[11px]">
                    <tr>
                      <th className="p-2 border-b border-slate-800">Invoice No</th>
                      <th className="p-2 border-b border-slate-800">Item Code</th>
                      <th className="p-2 border-b border-slate-800">Item Name</th>
                      <th className="p-2 border-b border-slate-800 text-right">Req Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {parseResult.items.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2 font-semibold text-emerald-400">{item.invoiceNo}</td>
                        <td className="p-2 text-slate-300">{item.itemCode}</td>
                        <td className="p-2 truncate max-w-[160px]">{item.itemName}</td>
                        <td className="p-2 text-right font-bold">{item.requiredQty} {item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseResult.items.length > 10 && (
                <div className="px-3 py-1.5 text-[11px] text-slate-400 text-center bg-slate-900/50">
                  + {parseResult.items.length - 10} more items ready to be stored locally
                </div>
              )}
            </div>
          )}

          {/* Status Alert */}
          {statusMessage && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300' 
                : 'bg-red-950/70 border-red-700/60 text-red-300'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {parseResult && parseResult.items.length > 0 && (
            <button
              id="confirm-import-data-btn"
              onClick={handleConfirmImport}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-lg shadow transition-colors"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save & Store to Offline DB</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
