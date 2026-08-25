import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { 
  MasterInvoiceItem, 
  AuditDiscrepancy, 
  WrongPickingItem, 
  PackagingGroupRule,
  BatchPickingWave,
  PickingProductGroup,
  AggregatedPickingItem,
  WarehouseWorker,
  GroupDifficultyLevel
} from '../types';
import { matchBarcodeToPackagingRule } from './db';

export interface ParseResult {
  items: MasterInvoiceItem[];
  errors: string[];
  totalRows: number;
}

// Normalizes column headers to standard schema keys including Arabic & English variants
function normalizeHeader(raw: string): string {
  const clean = String(raw || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
  
  // Order Number matches
  if ([
    'orderno', 'order', 'orderid', 'ordernum', 'po', 'ponumber', 'purchasenumber', 'ordernumber',
    'رقم_الاوردر', 'الاوردر', 'رقم_الطلب', 'الطلب', 'رقم_أمر_الشراء', 'رقم_أمر_البيع', 'اوردر', 'طلب'
  ].includes(clean) || clean.includes('order') || clean.includes('اوردر') || clean.includes('طلب')) {
    return 'orderNo';
  }

  // Invoice Number matches
  if ([
    'invoiceno', 'invoice', 'invoicenumber', 'invno', 'invoicenum', 'billno', 'bill',
    'رقم_الفاتورة', 'الفاتورة', 'فاتورة', 'رقم_الفاتوره'
  ].includes(clean) || clean.includes('invoice') || clean.includes('فاتور')) {
    return 'invoiceNo';
  }

  // Item Code / Barcode matches
  if ([
    'itemcode', 'item', 'code', 'barcode', 'sku', 'productcode', 'itemno', 'upc', 'ean',
    'كود_الصنف', 'باركود', 'كود', 'الباركود', 'الصنف', 'رمز_الصنف'
  ].includes(clean) || clean.includes('barcode') || clean.includes('باركود')) {
    return 'itemCode';
  }

  // Item Name matches
  if ([
    'itemname', 'itemdesc', 'description', 'productname', 'name', 'product', 'desc',
    'اسم_الصنف', 'اسم_المنتج', 'الوصف', 'بيان_الصنف'
  ].includes(clean) || clean.includes('name') || clean.includes('اسم')) {
    return 'itemName';
  }

  // Unit matches
  if ([
    'unit', 'uom', 'unitofmeasure', 'package', 'pack',
    'الوحدة', 'وحدة_القياس', 'العبوة'
  ].includes(clean) || clean.includes('unit') || clean.includes('وحد')) {
    return 'unit';
  }

  // Required Quantity matches
  if ([
    'requiredqty', 'reqqty', 'quantity', 'qty', 'orderqty', 'expectedqty', 'planqty', 'count',
    'الكمية_المطلوبة', 'الكمية', 'العدد_المطلوب', 'العدد', 'مطلوب'
  ].includes(clean) || clean.includes('qty') || clean.includes('كمي') || clean.includes('عدد')) {
    return 'requiredQty';
  }

  // Supplier matches
  if ([
    'supplier', 'suppliername', 'vendor', 'vendorname',
    'المورد', 'اسم_المورد', 'الشركة_الموردة'
  ].includes(clean) || clean.includes('supplier') || clean.includes('مورد')) {
    return 'supplierName';
  }

  // Batch / Lot matches
  if ([
    'batch', 'batchno', 'batchnumber', 'lot', 'lotno', 'lotnumber',
    'رقم_التشغيلة', 'التشغيلة', 'رقم_اللوط', 'اللوط'
  ].includes(clean) || clean.includes('batch') || clean.includes('تشغيل')) {
    return 'batchNumber';
  }

  // Expiry Date matches
  if ([
    'expiry', 'expdate', 'expirydate', 'expiration', 'exp',
    'تاريخ_الصلاحية', 'الصلاحية', 'تاريخ_الانتهاء', 'الانتهاء'
  ].includes(clean) || clean.includes('expir') || clean.includes('صلاحي')) {
    return 'expiryDate';
  }

  return clean;
}

export interface ReceivingExcelItem {
  itemCode: string;
  itemName: string;
  unit: string;
  expectedQty: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface ReceivingParseResult {
  poNumber?: string;
  supplierName?: string;
  deliveryNoteNo?: string;
  items: ReceivingExcelItem[];
  errors: string[];
}

export async function parseExcelReceivingFile(file: File): Promise<ReceivingParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve({ items: [], errors: ['No sheet found in workbook.'], poNumber: '', supplierName: '' });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          return resolve({ items: [], errors: ['Sheet is empty.'], poNumber: '', supplierName: '' });
        }

        const items: ReceivingExcelItem[] = [];
        const errors: string[] = [];
        let detectedPO = '';
        let detectedSupplier = '';
        let detectedDN = '';

        rawJson.forEach((row, index) => {
          const rowObj: Record<string, unknown> = {};
          for (const key of Object.keys(row)) {
            const normalizedKey = normalizeHeader(key);
            rowObj[normalizedKey] = row[key];
          }

          const po = String(rowObj['orderNo'] ?? rowObj['invoiceNo'] ?? '').trim();
          const supp = String(rowObj['supplierName'] ?? '').trim();
          const dn = String(rowObj['deliveryNoteNo'] ?? '').trim();

          if (po && !detectedPO) detectedPO = po;
          if (supp && !detectedSupplier) detectedSupplier = supp;
          if (dn && !detectedDN) detectedDN = dn;

          const itemCode = String(rowObj['itemCode'] ?? '').trim();
          const itemName = String(rowObj['itemName'] ?? itemCode).trim();
          const unit = String(rowObj['unit'] ?? 'PCS').trim().toUpperCase();
          const reqQtyRaw = rowObj['requiredQty'] ?? 0;
          const expectedQty = Number(reqQtyRaw);
          const batchNumber = String(rowObj['batchNumber'] ?? '').trim();
          const expiryDate = String(rowObj['expiryDate'] ?? '').trim();

          if (!itemCode) {
            errors.push(`Row ${index + 2}: Missing Item_Code`);
            return;
          }

          items.push({
            itemCode,
            itemName: itemName || itemCode,
            unit: unit || 'PCS',
            expectedQty: isNaN(expectedQty) || expectedQty <= 0 ? 1 : expectedQty,
            batchNumber: batchNumber || undefined,
            expiryDate: expiryDate || undefined,
          });
        });

        resolve({
          poNumber: detectedPO,
          supplierName: detectedSupplier,
          deliveryNoteNo: detectedDN,
          items,
          errors
        });
      } catch (err) {
        reject(new Error(`Failed to parse file: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('File reading error.'));
    reader.readAsArrayBuffer(file);
  });
}

// Download Sample Receiving Excel Template
export function downloadReceivingExcelTemplate(): void {
  const sampleData = [
    {
      'رقم_أمر_الشراء (PO_No)': 'PO-2026-9081',
      'اسم_المورد (Supplier)': 'شركة الدلتا للصناعات والتوزيع',
      'رقم_بوليصة_الشحن (Delivery_Note)': 'DN-8841',
      'كود_الصنف (Item_Code)': '6221001234567',
      'اسم_الصنف (Item_Name)': 'منظف مركز أوتوماتيك 3 لتر',
      'الوحدة (Unit)': 'PCS',
      'الكمية_المطلوبة (Expected_Qty)': 120,
      'رقم_التشغيلة (Batch_No)': 'LOT-26A',
      'تاريخ_الصلاحية (Expiry_Date)': '2028-06-30'
    },
    {
      'رقم_أمر_الشراء (PO_No)': 'PO-2026-9081',
      'اسم_المورد (Supplier)': 'شركة الدلتا للصناعات والتوزيع',
      'رقم_بوليصة_الشحن (Delivery_Note)': 'DN-8841',
      'كود_الصنف (Item_Code)': '6221001234574',
      'اسم_الصنف (Item_Name)': 'معطر جو عبوة اقتصادية 450 مل',
      'الوحدة (Unit)': 'PCS',
      'الكمية_المطلوبة (Expected_Qty)': 240,
      'رقم_التشغيلة (Batch_No)': 'LOT-26B',
      'تاريخ_الصلاحية (Expiry_Date)': '2027-12-15'
    },
    {
      'رقم_أمر_الشراء (PO_No)': 'PO-2026-9081',
      'اسم_المورد (Supplier)': 'شركة الدلتا للصناعات والتوزيع',
      'رقم_بوليصة_الشحن (Delivery_Note)': 'DN-8841',
      'كود_الصنف (Item_Code)': '6221001234581',
      'اسم_الصنف (Item_Name)': 'صابون سائل مضاد للبكتيريا 500 مل',
      'الوحدة (Unit)': 'PCS',
      'الكمية_المطلوبة (Expected_Qty)': 300,
      'رقم_التشغيلة (Batch_No)': 'LOT-26C',
      'تاريخ_الصلاحية (Expiry_Date)': '2028-01-20'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'قالب استلام بضاعة PO');
  XLSX.writeFile(workbook, 'Receiving_PO_Template_قالب_استلام.xlsx');
}

export async function parseExcelOrCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve({ items: [], errors: ['No sheet found in workbook.'], totalRows: 0 });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          return resolve({ items: [], errors: ['Sheet is empty.'], totalRows: 0 });
        }

        const items: MasterInvoiceItem[] = [];
        const errors: string[] = [];
        const importedAt = new Date().toISOString();

        rawJson.forEach((row, index) => {
          const rowObj: Record<string, unknown> = {};
          
          for (const key of Object.keys(row)) {
            const normalizedKey = normalizeHeader(key);
            rowObj[normalizedKey] = row[key];
          }

          const invoiceNo = String(rowObj['invoiceNo'] ?? rowObj['invoiceno'] ?? '').trim();
          const orderNo = String(rowObj['orderNo'] ?? rowObj['orderno'] ?? '').trim();
          const itemCode = String(rowObj['itemCode'] ?? rowObj['itemcode'] ?? '').trim();
          const itemName = String(rowObj['itemName'] ?? rowObj['itemname'] ?? itemCode).trim();
          const unit = String(rowObj['unit'] ?? 'PCS').trim().toUpperCase();
          const reqQtyRaw = rowObj['requiredQty'] ?? rowObj['requiredqty'] ?? rowObj['qty'] ?? 0;
          const requiredQty = Number(reqQtyRaw);

          if (!invoiceNo && !orderNo) {
            errors.push(`Row ${index + 2}: Missing Invoice_No or Order_No`);
            return;
          }

          const effectiveInvoiceNo = invoiceNo || orderNo;

          if (!itemCode) {
            errors.push(`Row ${index + 2} (Inv ${effectiveInvoiceNo}): Missing Item_Code`);
            return;
          }
          if (isNaN(requiredQty) || requiredQty <= 0) {
            errors.push(`Row ${index + 2} (Inv ${effectiveInvoiceNo}, Item ${itemCode}): Invalid Required_Qty '${reqQtyRaw}'`);
            return;
          }

          items.push({
            orderNo: orderNo || undefined,
            invoiceNo: effectiveInvoiceNo,
            itemCode,
            itemName: itemName || itemCode,
            unit: unit || 'PCS',
            requiredQty,
            importedAt,
            originalIndex: index,
          });
        });

        resolve({ items, errors, totalRows: rawJson.length });
      } catch (err) {
        reject(new Error(`Failed to parse file: ${(err as Error).message}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

// Generates sample Excel file with Order_No and Invoice_No for quick testing & immediate offline download
export function generateSampleExcelFile(): void {
  const sampleData = [
    { Order_No: 'ORD-8801', Invoice_No: 'INV-2024-001', Item_Code: 'SKU-APPLE-01', Item_Name: 'Fresh Gala Apples (1kg)', Unit: 'KG', Required_Qty: 5 },
    { Order_No: 'ORD-8801', Invoice_No: 'INV-2024-001', Item_Code: 'SKU-MILK-02', Item_Name: 'Whole Organic Milk 1L', Unit: 'BTL', Required_Qty: 3 },
    { Order_No: 'ORD-8801', Invoice_No: 'INV-2024-001', Item_Code: 'SKU-BREAD-03', Item_Name: 'Artisan Sourdough Loaf', Unit: 'PCS', Required_Qty: 2 },
    { Order_No: 'ORD-8801', Invoice_No: 'INV-2024-001', Item_Code: 'SKU-COFFEE-04', Item_Name: 'Arabica Whole Beans 500g', Unit: 'BAG', Required_Qty: 4 },
    
    { Order_No: 'ORD-8802', Invoice_No: 'INV-2024-002', Item_Code: 'SKU-LOGI-M185', Item_Name: 'Logitech Wireless Mouse M185', Unit: 'PCS', Required_Qty: 6 },
    { Order_No: 'ORD-8802', Invoice_No: 'INV-2024-002', Item_Code: 'SKU-DELL-KB216', Item_Name: 'Dell Wired Keyboard KB216', Unit: 'PCS', Required_Qty: 4 },
    { Order_No: 'ORD-8802', Invoice_No: 'INV-2024-002', Item_Code: 'SKU-HDMI-2M', Item_Name: 'High Speed 4K HDMI Cable 2m', Unit: 'PCS', Required_Qty: 10 },
    
    { Order_No: 'ORD-8803', Invoice_No: 'INV-2024-003', Item_Code: 'SKU-SAFETY-GLOVE', Item_Name: 'Heavy Duty Nitrile Gloves', Unit: 'BOX', Required_Qty: 8 },
    { Order_No: 'ORD-8803', Invoice_No: 'INV-2024-003', Item_Code: 'SKU-TAPE-CLEAR', Item_Name: 'Packing Tape Transparent 48mm', Unit: 'ROLL', Required_Qty: 12 },
    { Order_No: 'ORD-8803', Invoice_No: 'INV-2024-003', Item_Code: 'SKU-BOX-MED', Item_Name: 'Corrugated Shipping Box Med', Unit: 'PCS', Required_Qty: 20 },
    { Order_No: 'ORD-8803', Invoice_No: 'INV-2024-003', Item_Code: 'SKU-BUBBLE-50M', Item_Name: 'Air Bubble Wrap Roll 50m', Unit: 'ROLL', Required_Qty: 2 },
    
    { Order_No: 'ORD-8804', Invoice_No: 'INV-2024-004', Item_Code: '8901234567890', Item_Name: 'Industrial Barcode Label 100x50mm', Unit: 'ROLL', Required_Qty: 5 },
    { Order_No: 'ORD-8804', Invoice_No: 'INV-2024-004', Item_Code: '8901234567891', Item_Name: 'Thermal Transfer Ribbon Wax/Resin', Unit: 'ROLL', Required_Qty: 5 },
    { Order_No: 'ORD-8804', Invoice_No: 'INV-2024-004', Item_Code: '8901234567892', Item_Name: 'Handheld Barcode Scanner Stand', Unit: 'PCS', Required_Qty: 3 },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  
  worksheet['!cols'] = [
    { wch: 14 }, // Order_No
    { wch: 18 }, // Invoice_No
    { wch: 20 }, // Item_Code
    { wch: 38 }, // Item_Name
    { wch: 10 }, // Unit
    { wch: 14 }, // Required_Qty
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Invoices & Orders');
  
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Daily_Invoice_Data_${today}.xlsx`);
}

// Built-in Sample dataset generator with Order numbers for instant 1-click loading without local file
export function getSampleDailyItems(): MasterInvoiceItem[] {
  const importedAt = new Date().toISOString();
  return [
    { orderNo: 'ORD-8801', invoiceNo: 'INV-2024-001', itemCode: 'SKU-APPLE-01', itemName: 'Fresh Gala Apples (1kg)', unit: 'KG', requiredQty: 5, importedAt, originalIndex: 0 },
    { orderNo: 'ORD-8801', invoiceNo: 'INV-2024-001', itemCode: 'SKU-MILK-02', itemName: 'Whole Organic Milk 1L', unit: 'BTL', requiredQty: 3, importedAt, originalIndex: 1 },
    { orderNo: 'ORD-8801', invoiceNo: 'INV-2024-001', itemCode: 'SKU-BREAD-03', itemName: 'Artisan Sourdough Loaf', unit: 'PCS', requiredQty: 2, importedAt, originalIndex: 2 },
    { orderNo: 'ORD-8801', invoiceNo: 'INV-2024-001', itemCode: 'SKU-COFFEE-04', itemName: 'Arabica Whole Beans 500g', unit: 'BAG', requiredQty: 4, importedAt, originalIndex: 3 },
    
    { orderNo: 'ORD-8802', invoiceNo: 'INV-2024-002', itemCode: 'SKU-LOGI-M185', itemName: 'Logitech Wireless Mouse M185', unit: 'PCS', requiredQty: 6, importedAt, originalIndex: 4 },
    { orderNo: 'ORD-8802', invoiceNo: 'INV-2024-002', itemCode: 'SKU-DELL-KB216', itemName: 'Dell Wired Keyboard KB216', unit: 'PCS', requiredQty: 4, importedAt, originalIndex: 5 },
    { orderNo: 'ORD-8802', invoiceNo: 'INV-2024-002', itemCode: 'SKU-HDMI-2M', itemName: 'High Speed 4K HDMI Cable 2m', unit: 'PCS', requiredQty: 10, importedAt, originalIndex: 6 },
    
    { orderNo: 'ORD-8803', invoiceNo: 'INV-2024-003', itemCode: 'SKU-SAFETY-GLOVE', itemName: 'Heavy Duty Nitrile Gloves', unit: 'BOX', requiredQty: 8, importedAt, originalIndex: 7 },
    { orderNo: 'ORD-8803', invoiceNo: 'INV-2024-003', itemCode: 'SKU-TAPE-CLEAR', itemName: 'Packing Tape Transparent 48mm', unit: 'ROLL', requiredQty: 12, importedAt, originalIndex: 8 },
    { orderNo: 'ORD-8803', invoiceNo: 'INV-2024-003', itemCode: 'SKU-BOX-MED', itemName: 'Corrugated Shipping Box Med', unit: 'PCS', requiredQty: 20, importedAt, originalIndex: 9 },
    { orderNo: 'ORD-8803', invoiceNo: 'INV-2024-003', itemCode: 'SKU-BUBBLE-50M', itemName: 'Air Bubble Wrap Roll 50m', unit: 'ROLL', requiredQty: 2, importedAt, originalIndex: 10 },
    
    { orderNo: 'ORD-8804', invoiceNo: 'INV-2024-004', itemCode: '8901234567890', itemName: 'Industrial Barcode Label 100x50mm', unit: 'ROLL', requiredQty: 5, importedAt, originalIndex: 11 },
    { orderNo: 'ORD-8804', invoiceNo: 'INV-2024-004', itemCode: '8901234567891', itemName: 'Thermal Transfer Ribbon Wax/Resin', unit: 'ROLL', requiredQty: 5, importedAt, originalIndex: 12 },
    { orderNo: 'ORD-8804', invoiceNo: 'INV-2024-004', itemCode: '8901234567892', itemName: 'Handheld Barcode Scanner Stand', unit: 'PCS', requiredQty: 3, importedAt, originalIndex: 13 },
  ];
}

// Export permanent Error Audit Report to Excel (.xlsx) with Order_No & Auditor metadata
export function exportErrorReportToExcel(
  discrepancies: AuditDiscrepancy[], 
  auditorInfo?: { name?: string; id?: string; title?: string }
): void {
  if (discrepancies.length === 0) {
    alert('No discrepancies in Error Audit Report to export.');
    return;
  }

  const exportRows = discrepancies.map((d, index) => ({
    'No': index + 1,
    'Order_No': d.orderNo || '-',
    'Invoice_No': d.invoiceNo,
    'Auditor_Name': d.auditorName || auditorInfo?.name || 'Ahmed Hamada',
    'Auditor_ID': d.auditorId || auditorInfo?.id || 'AUD-101',
    'Item_Code': d.itemCode,
    'Item_Name': d.itemName,
    'Unit': d.unit,
    'Required_Qty': d.requiredQty,
    'Actual_Qty': d.actualQty,
    'Variance_Diff': d.difference > 0 ? `+${d.difference}` : d.difference,
    'Code_Status': d.codeStatus,
    'Qty_Status': d.qtyStatus,
    'Discrepancy_Type': d.codeStatus === 'MISMATCH' ? 'ITEM MISMATCH (Not in Invoice)' : d.qtyStatus,
    'Audited_Timestamp': new Date(d.auditedAt).toLocaleString(),
    'Notes': d.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Order_No
    { wch: 18 }, // Invoice_No
    { wch: 20 }, // Auditor_Name
    { wch: 14 }, // Auditor_ID
    { wch: 20 }, // Item_Code
    { wch: 34 }, // Item_Name
    { wch: 10 }, // Unit
    { wch: 14 }, // Required_Qty
    { wch: 14 }, // Actual_Qty
    { wch: 14 }, // Variance_Diff
    { wch: 14 }, // Code_Status
    { wch: 14 }, // Qty_Status
    { wch: 32 }, // Discrepancy_Type
    { wch: 22 }, // Audited_Timestamp
    { wch: 20 }, // Notes
  ];

  // Summary sheet
  const summaryMap: Record<string, { orderNo?: string; shortages: number; surpluses: number; mismatches: number }> = {};
  for (const d of discrepancies) {
    if (!summaryMap[d.invoiceNo]) {
      summaryMap[d.invoiceNo] = { orderNo: d.orderNo, shortages: 0, surpluses: 0, mismatches: 0 };
    }
    if (d.codeStatus === 'MISMATCH') summaryMap[d.invoiceNo].mismatches += 1;
    else if (d.qtyStatus === 'SHORTAGE') summaryMap[d.invoiceNo].shortages += 1;
    else if (d.qtyStatus === 'SURPLUS') summaryMap[d.invoiceNo].surpluses += 1;
  }

  const summaryRows = Object.entries(summaryMap).map(([inv, counts]) => ({
    'Order_No': counts.orderNo || '-',
    'Invoice_No': inv,
    'Auditor': `${auditorInfo?.name || 'Ahmed Hamada'} (${auditorInfo?.id || 'AUD-101'})`,
    'Item_Mismatches': counts.mismatches,
    'Quantity_Shortages': counts.shortages,
    'Quantity_Surpluses': counts.surpluses,
    'Total_Discrepancies': counts.mismatches + counts.shortages + counts.surpluses,
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Discrepancy Details');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Invoice Summary');

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(workbook, `Audit_Error_Report_${timestamp}.xlsx`);
}

// Export permanent Error Audit Report to PDF with Auditor Sign-off & Stamp
export function exportErrorReportToPdf(
  discrepancies: AuditDiscrepancy[],
  auditorInfo?: { name?: string; id?: string; title?: string; signature?: string }
): void {
  if (discrepancies.length === 0) {
    alert('No discrepancies in Error Audit Report to export.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();
  const auditorLabel = `${auditorInfo?.name || 'Ahmed Hamada'} [${auditorInfo?.id || 'AUD-101'}] - ${auditorInfo?.title || 'Certified Warehouse Auditor'}`;

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL WAREHOUSE INVOICE AUDIT - ERROR & DISCREPANCY REPORT', 14, 14);

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${timestamp} | Mode: 100% Offline | Total Discrepancies: ${discrepancies.length}`, 14, 20);
  doc.text(`Lead Auditor: ${auditorLabel}`, 14, 24);

  const tableData = discrepancies.map((d, index) => [
    index + 1,
    d.orderNo || '-',
    d.invoiceNo,
    d.itemCode,
    d.itemName,
    `${d.requiredQty} ${d.unit}`,
    `${d.actualQty} ${d.unit}`,
    d.difference > 0 ? `+${d.difference}` : `${d.difference}`,
    d.codeStatus === 'MISMATCH' ? 'MISMATCH' : d.qtyStatus,
    d.auditorId || auditorInfo?.id || 'AUD-101',
    d.notes || '',
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Order #', 'Invoice #', 'Item Code', 'Item Name', 'Req Qty', 'Actual', 'Diff', 'Status', 'Auditor ID', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: 50 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { cellWidth: 14 },
      8: { cellWidth: 20 },
      9: { cellWidth: 18 },
      10: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = discrepancies[data.row.index];
        if (row) {
          if (row.codeStatus === 'MISMATCH') {
            data.cell.styles.textColor = [185, 28, 28]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (row.qtyStatus === 'SHORTAGE') {
            data.cell.styles.textColor = [180, 83, 9]; // Amber
          } else if (row.qtyStatus === 'SURPLUS') {
            data.cell.styles.textColor = [124, 58, 237]; // Purple
          }
        }
      }
    },
  });

  // Footer Auditor Sign-off box
  const lastTableY = (doc as any).lastAutoTable?.finalY || 160;
  const signBlockY = Math.min(lastTableY + 8, 175);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, signBlockY, 268, 20, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('AUDIT SIGN-OFF & CERTIFICATION (ISA 500 COMPLIANT):', 18, signBlockY + 6);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Audited & Verified By: ${auditorInfo?.name || 'Ahmed Hamada'} (${auditorInfo?.id || 'AUD-101'})`, 18, signBlockY + 12);
  doc.text(`Title: ${auditorInfo?.title || 'Certified Warehouse Auditor'} | Status: OFFICIALLY SEALED`, 18, signBlockY + 16);

  doc.text('Auditor Signature / Seal:', 190, signBlockY + 6);
  if (auditorInfo?.signature && auditorInfo.signature.startsWith('data:image/')) {
    try {
      doc.addImage(auditorInfo.signature, 'PNG', 190, signBlockY + 7, 36, 11);
    } catch {
      doc.text('_________________________', 190, signBlockY + 14);
    }
  } else {
    doc.text('_________________________', 190, signBlockY + 14);
  }

  const pdfTimestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  doc.save(`Audit_Error_Report_${pdfTimestamp}.pdf`);
}

// Export dedicated Wrong Picking & Foreign Items Report to Excel (.xlsx)
export function exportWrongPickingToExcel(
  items: WrongPickingItem[],
  auditorInfo?: { name?: string; id?: string; title?: string }
): void {
  if (items.length === 0) {
    alert('No items in Wrong Picking Report to export.');
    return;
  }

  const exportRows = items.map((w, index) => ({
    'No': index + 1,
    'Active_Invoice_Under_Audit': w.activeInvoiceNo,
    'Active_Order_No': w.orderNo || '-',
    'Auditor_Name': w.auditorName || auditorInfo?.name || 'Ahmed Hamada',
    'Auditor_ID': w.auditorId || auditorInfo?.id || 'AUD-101',
    'Wrong_Scanned_Barcode': w.itemCode,
    'Detected_Item_Name': w.itemName || 'Unknown Foreign Item',
    'Scanned_Quantity': w.quantity,
    'Unit': w.unit || 'PCS',
    'Belongs_To_Invoice': w.actualBelongingInvoiceNo || 'NOT FOUND IN MASTER DATA',
    'Belongs_To_Order': w.actualBelongingOrderNo || '-',
    'Audit_Verdict': 'REJECTED FROM INVOICE - WRONG PICKING',
    'Timestamp': new Date(w.scannedAt).toLocaleString(),
    'Notes': w.notes || 'Misplaced Item / Incorrect Preparation',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  worksheet['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // Active_Invoice_Under_Audit
    { wch: 16 }, // Active_Order_No
    { wch: 20 }, // Auditor_Name
    { wch: 14 }, // Auditor_ID
    { wch: 22 }, // Wrong_Scanned_Barcode
    { wch: 32 }, // Detected_Item_Name
    { wch: 16 }, // Scanned_Quantity
    { wch: 10 }, // Unit
    { wch: 26 }, // Belongs_To_Invoice
    { wch: 18 }, // Belongs_To_Order
    { wch: 34 }, // Audit_Verdict
    { wch: 22 }, // Timestamp
    { wch: 28 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wrong Picking Audit Log');

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(workbook, `Wrong_Picking_Report_${timestamp}.xlsx`);
}

// Export dedicated Wrong Picking & Foreign Items Report to PDF
export function exportWrongPickingToPdf(
  items: WrongPickingItem[],
  auditorInfo?: { name?: string; id?: string; title?: string; signature?: string }
): void {
  if (items.length === 0) {
    alert('No items in Wrong Picking Report to export.');
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();
  const auditorLabel = `${auditorInfo?.name || 'Ahmed Hamada'} [${auditorInfo?.id || 'AUD-101'}] - ${auditorInfo?.title || 'Certified Warehouse Auditor'}`;

  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38);
  doc.text('OFFICIAL WAREHOUSE AUDIT - WRONG PICKING & MISPLACED ITEMS REPORT', 14, 14);

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${timestamp} | Mode: 100% Offline | Total Intercepted Items: ${items.length}`, 14, 20);
  doc.text(`Lead Auditor: ${auditorLabel} | Policy: Excluded from Invoice Ledger`, 14, 24);

  const tableData = items.map((w, index) => [
    index + 1,
    w.activeInvoiceNo,
    w.orderNo || '-',
    w.itemCode,
    w.itemName || 'Unknown Item',
    `${w.quantity} ${w.unit || 'PCS'}`,
    w.actualBelongingInvoiceNo ? `Belongs to: ${w.actualBelongingInvoiceNo}` : 'NOT IN DATABASE',
    w.auditorId || auditorInfo?.id || 'AUD-101',
    new Date(w.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Audited Invoice', 'Order #', 'Wrong Barcode', 'Item Name', 'Qty', 'Origin / Belonging', 'Auditor ID', 'Time']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [185, 28, 28], // Red header
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 26 },
      2: { cellWidth: 20 },
      3: { cellWidth: 28 },
      4: { cellWidth: 50 },
      5: { cellWidth: 16 },
      6: { cellWidth: 44 },
      7: { cellWidth: 20 },
      8: { cellWidth: 'auto' },
    },
  });

  // Footer Auditor Sign-off box
  const lastTableY = (doc as any).lastAutoTable?.finalY || 160;
  const signBlockY = Math.min(lastTableY + 8, 175);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(14, signBlockY, 268, 20, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(153, 27, 27);
  doc.text('WRONG PICKING AUDIT CERTIFICATION (ISA 500 COMPLIANT):', 18, signBlockY + 6);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Audited & Documented By: ${auditorInfo?.name || 'Ahmed Hamada'} (${auditorInfo?.id || 'AUD-101'})`, 18, signBlockY + 12);
  doc.text(`Action: Intercepted and rerouted. Zero contamination in invoice inventory records.`, 18, signBlockY + 16);

  doc.text('Auditor Signature / Seal:', 190, signBlockY + 6);
  if (auditorInfo?.signature && auditorInfo.signature.startsWith('data:image/')) {
    try {
      doc.addImage(auditorInfo.signature, 'PNG', 190, signBlockY + 7, 36, 11);
    } catch {
      doc.text('_________________________', 190, signBlockY + 14);
    }
  } else {
    doc.text('_________________________', 190, signBlockY + 14);
  }

  const pdfTimestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  doc.save(`Wrong_Picking_Report_${pdfTimestamp}.pdf`);
}

// ===================================================================
// 1. Export Returns & Credit Note Refund Request Reports (Excel & PDF)
// ===================================================================

const PAYMENT_METHOD_NAMES: Record<string, string> = {
  CASH: 'نقدي (Cash)',
  BANK_TRANSFER: 'تحويل بنكي (Bank Transfer)',
  CARD: 'بطاقة / مدى (Card)',
  CREDIT_BALANCE: 'رصيد آجل / محفظة (Credit Balance)',
  COD: 'دفع عند الاستلام (COD)'
};

const CONDITION_NAMES: Record<string, string> = {
  VALID_FOR_RESTOCK: 'صالحة للارتجاع للمستودع',
  TRANSFERRED_TO_LAB: 'محولة للمعمل (تحت الفحص)',
  INTACT: 'صالحة للارتجاع للمستودع',
  DAMAGED: 'محولة للمعمل (تالف/فحص)'
};

export function exportReturnReportToExcel(report: any): void {
  const receiptNo = report.returnReceiptNo || report.rmaNo || `RET-${Date.now()}`;
  const exportRows = report.items.map((item: any, idx: number) => ({
    'م': idx + 1,
    'رقم_إذن_المرتجع (Receipt_No)': receiptNo,
    'رقم_الفاتورة_الأصلية (Invoice_No)': report.originalInvoiceNo,
    'رقم_الطلب (Order_No)': report.orderNo || '-',
    'اسم_العميل (Customer_Name)': report.customerName || 'عميل نقدي',
    'طريقة_الدفع (Payment_Method)': PAYMENT_METHOD_NAMES[report.paymentMethod] || report.paymentMethod || 'نقدي',
    'كود_الصنف (Item_Code)': item.itemCode,
    'اسم_الصنف (Item_Name)': item.itemName,
    'الوحدة (Unit)': item.unit,
    'الكمية_بالفاتورة (Invoiced_Qty)': item.invoicedQty,
    'الكمية_المرتجعة_الفعلية (Actual_Returned)': item.actualReturnedQty,
    'حالة_الحبة (Item_Condition)': CONDITION_NAMES[item.condition] || item.condition,
    'قرار_المعمل (Lab_Decision)': item.labDecision === 'APPROVED_FOR_RESTOCK' ? 'معتمد من المعمل صالح للمستودع' : item.labDecision === 'REJECTED_SCRAP' ? 'مرفوض من المعمل (هالك)' : item.condition === 'TRANSFERRED_TO_LAB' ? 'معلق بانتظار فحص المعمل' : 'لا يتطلب معمل',
    'سعر_الوحدة (Unit_Price)': Number(item.unitPrice || 0).toFixed(2),
    'إجمالي_الاسترداد (Refund_Total)': (Number(item.actualReturnedQty || 0) * Number(item.unitPrice || 0)).toFixed(2),
    'حالة_التقرير (Report_Status)': report.status === 'COMPLETED' ? 'مكتمل كارتجاع للمستودع' : 'معلق لمراجعة المعمل',
    'المراجع_المسؤول (Auditor)': `${report.auditorName || ''} (${report.auditorId || ''})`,
    'تاريخ_الاستلام (Date)': new Date(report.createdAt).toLocaleString('ar-EG'),
    'ملاحظات (Notes)': item.notes || report.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 24 },
    { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 14 },
    { wch: 16 }, { wch: 22 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
    { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 25 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'بيان استلام المرتجع والفحص');
  XLSX.writeFile(workbook, `Return_Receipt_${receiptNo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export All Completed Returns (المرتجعات المكتملة كارتجاع للمستودع)
export function exportCompletedReturnsToExcel(reports: any[]): void {
  const completedList = reports.filter(r => r.status === 'COMPLETED');
  if (completedList.length === 0) {
    alert('لا توجد تقارير مرتجعات مكتملة حالياً للتصدير.');
    return;
  }

  // Summary Sheet
  const summaryRows = completedList.map((r, idx) => ({
    'م': idx + 1,
    'رقم_إذن_المرتجع (Receipt_No)': r.returnReceiptNo || r.rmaNo,
    'رقم_الفاتورة (Invoice_No)': r.originalInvoiceNo,
    'رقم_الطلب (Order_No)': r.orderNo || '-',
    'اسم_العميل (Customer)': r.customerName || 'عميل عام',
    'طريقة_الدفع (Payment_Method)': PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي',
    'إجمالي_الحبات_المرتجعة': r.totalReturnedQty,
    'حبات_صالحة_للمستودع': r.totalValidForRestockQty ?? r.totalReturnedQty,
    'إجمالي_مبلغ_الاسترداد': (Number(r.totalRefundAmount) || 0).toFixed(2),
    'حالة_الارتجاع': 'مكتمل - تم الاستلام بالمستودع 100%',
    'تاريخ_الإنهاء_والاستلام': new Date(r.createdAt).toLocaleString('ar-EG'),
    'المراجع_المعتمد': `${r.auditorName || ''} (${r.auditorId || ''})`,
    'ملاحظات': r.notes || ''
  }));

  // Detailed Items Sheet
  const detailedRows: any[] = [];
  let counter = 1;
  completedList.forEach(r => {
    const receiptNo = r.returnReceiptNo || r.rmaNo;
    (r.items || []).forEach((item: any) => {
      detailedRows.push({
        'م': counter++,
        'رقم_إذن_المرتجع': receiptNo,
        'رقم_الفاتورة': r.originalInvoiceNo,
        'رقم_الطلب': r.orderNo || '-',
        'العميل': r.customerName || '-',
        'طريقة_الدفع': PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي',
        'كود_الصنف_المرتجع': item.itemCode,
        'اسم_الصنف': item.itemName,
        'الوحدة': item.unit,
        'الكمية_المستلمة_بالمستودع': item.actualReturnedQty,
        'سعر_الوحدة': Number(item.unitPrice || 0).toFixed(2),
        'إجمالي_القيمة': (Number(item.actualReturnedQty || 0) * Number(item.unitPrice || 0)).toFixed(2),
        'حالة_الحبة_المعتمدة': 'صالحة للارتجاع للمستودع',
        'المراجع': r.auditorName,
        'تاريخ_الاستلام': new Date(r.createdAt).toLocaleString('ar-EG')
      });
    });
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const detailedSheet = XLSX.utils.json_to_sheet(detailedRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص المرتجعات المكتملة');
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'تفاصيل الأصناف المستلمة');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `تقرير_المرتجعات_المكتملة_المستودع_${timestamp}.xlsx`);
}

// Export All Completed Refunds for Emailing to Finance/Officer (طلبات الاسترداد المكتملة)
export function exportCompletedRefundsToExcel(reports: any[]): void {
  const completedReturns = reports.filter(r => r.status === 'COMPLETED');
  if (completedReturns.length === 0) {
    alert('لا توجد طلبات استرداد مكتملة ومطابقة لتقارير الارتجاع المكتملة.');
    return;
  }

  // 1. Main Refund Disbursement Orders Sheet
  const refundRows = completedReturns.map((r, idx) => {
    const itemCodesList = (r.items || [])
      .map((i: any) => `${i.itemCode} (${i.actualReturnedQty} ${i.unit})`)
      .join(' ، ');

    return {
      'م': idx + 1,
      'رقم_الفاتورة_الأصلية (Invoice_No)': r.originalInvoiceNo,
      'رقم_الطلب (Order_No)': r.orderNo || '-',
      'رقم_إذن_المرتجع (Receipt_No)': r.returnReceiptNo || r.rmaNo,
      'اسم_العميل (Customer_Name)': r.customerName || 'عميل نقدي',
      'طريقة_الدفع (Payment_Method)': PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي',
      'أكواد_الأصناف_المرتجعة': itemCodesList,
      'عدد_الأصناف_المختلفة': (r.items || []).length,
      'إجمالي_القطع_المستلمة_بالمستودع': r.totalReturnedQty,
      'إجمالي_المبلغ_المسترد (ر.س/ج.م)': Number(r.totalRefundAmount || 0).toFixed(2),
      'حالة_طلب_الاسترداد': 'معتمد ومكتمل بعد استلام المستودع 100%',
      'تاريخ_الاعتماد_والاستلام': new Date(r.createdAt).toLocaleString('ar-EG'),
      'المراجع_المعتمد': `${r.auditorName || ''} (${r.auditorId || ''})`,
      'حالة_الإرسال_والصرف': 'جاهز للإرسال بالبريد الإلكتروني والصرف للموظف المختص',
      'ملاحظات_الصرف': r.notes || ''
    };
  });

  // 2. Itemized Refund Details Sheet
  const itemizedRefundRows: any[] = [];
  let itemCounter = 1;
  completedReturns.forEach(r => {
    (r.items || []).forEach((item: any) => {
      itemizedRefundRows.push({
        'م': itemCounter++,
        'رقم_إذن_المرتجع': r.returnReceiptNo || r.rmaNo,
        'رقم_الفاتورة': r.originalInvoiceNo,
        'رقم_الطلب': r.orderNo || '-',
        'العميل': r.customerName || '-',
        'كود_الصنف': item.itemCode,
        'اسم_الصنف': item.itemName,
        'الوحدة': item.unit || 'حبة',
        'الكمية_المستردة': item.actualReturnedQty,
        'سعر_الوحدة': Number(item.unitPrice || 0).toFixed(2),
        'إجمالي_قيمة_البند': (Number(item.actualReturnedQty || 0) * Number(item.unitPrice || 0)).toFixed(2),
        'طريقة_الدفع_للصرف': PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي',
        'حالة_الصنف_بالمستودع': 'سليم ومستلم بالمستودع',
        'تاريخ_الاستلام': new Date(r.createdAt).toLocaleString('ar-EG')
      });
    });
  });

  // 3. Payment Method Reconciliation Summary Sheet
  const paymentTotals: Record<string, { count: number; totalPieces: number; totalAmount: number }> = {};
  completedReturns.forEach(r => {
    const method = PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي';
    if (!paymentTotals[method]) {
      paymentTotals[method] = { count: 0, totalPieces: 0, totalAmount: 0 };
    }
    paymentTotals[method].count += 1;
    paymentTotals[method].totalPieces += Number(r.totalReturnedQty || 0);
    paymentTotals[method].totalAmount += Number(r.totalRefundAmount || 0);
  });

  const reconciliationRows = Object.entries(paymentTotals).map(([method, data], idx) => ({
    'م': idx + 1,
    'طريقة_الدفع_والتسوية': method,
    'عدد_طلبات_الاسترداد': data.count,
    'إجمالي_القطع_المستلمة': data.totalPieces,
    'إجمالي_المبلغ_المستحق_للصرف (ر.س/ج.م)': data.totalAmount.toFixed(2),
    'توجيه_الموظف_المختص': method.includes('نقدي') 
      ? 'صرف نقدي من الخزينة' 
      : method.includes('بطاقة') || method.includes('شبكة')
      ? 'عكس عملية الدفع عبر ماكينة POS / البنك'
      : method.includes('تحويل')
      ? 'تحويل بنكي لحساب العميل'
      : 'إصدار إشعار دائن (Credit Note) على حساب العميل'
  }));

  const mainSheet = XLSX.utils.json_to_sheet(refundRows);
  mainSheet['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 24 },
    { wch: 18 }, { wch: 35 }, { wch: 16 }, { wch: 20 }, { wch: 22 },
    { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 35 }, { wch: 25 }
  ];

  const itemizedSheet = XLSX.utils.json_to_sheet(itemizedRefundRows);
  itemizedSheet['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
    { wch: 18 }, { wch: 35 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 20 }
  ];

  const reconSheet = XLSX.utils.json_to_sheet(reconciliationRows);
  reconSheet['!cols'] = [
    { wch: 6 }, { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 45 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'طلبات الاسترداد المالي المعتمدة');
  XLSX.utils.book_append_sheet(workbook, itemizedSheet, 'تفاصيل الأصناف والأسعار');
  XLSX.utils.book_append_sheet(workbook, reconSheet, 'تسوية طرق الدفع والصرف');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `كشف_طلبات_الاسترداد_المالي_المكتملة_${timestamp}.xlsx`);
}

// Export Pending Lab Suspensions Report (قائمة المعلقات بمراجعة المعمل)
export function exportPendingLabReportsToExcel(reports: any[]): void {
  const pendingList = reports.filter(r => r.status === 'PENDING_LAB');
  if (pendingList.length === 0) {
    alert('لا توجد تقارير مرتجعات معلقة بالمعمل حالياً.');
    return;
  }

  const now = Date.now();
  const rows = pendingList.map((r, idx) => {
    const createdTime = new Date(r.createdAt).getTime();
    const elapsedHours = Math.floor((now - createdTime) / (1000 * 60 * 60));
    const isOverdue = elapsedHours >= 24;

    const labItems = (r.items || [])
      .filter((i: any) => i.condition === 'TRANSFERRED_TO_LAB')
      .map((i: any) => `${i.itemCode} - ${i.itemName} (${i.actualReturnedQty} ${i.unit})`)
      .join(' | ');

    return {
      'م': idx + 1,
      'رقم_إذن_المرتجع': r.returnReceiptNo || r.rmaNo,
      'رقم_الفاتورة': r.originalInvoiceNo,
      'رقم_الطلب': r.orderNo || '-',
      'العميل': r.customerName || '-',
      'طريقة_الدفع': PAYMENT_METHOD_NAMES[r.paymentMethod] || r.paymentMethod || 'نقدي',
      'حالة_التعليق': 'معلق لمراجعة معمل الجودة',
      'تنبيه_تجاوز_يوم_عمل': isOverdue ? `⚠️ متأخر (${elapsedHours} ساعة مضت)` : `ضمن المهلة (${elapsedHours} ساعة)`,
      'الحبات_المحولة_للمعمل': labItems,
      'تاريخ_الإدخال_والتحويل': new Date(r.createdAt).toLocaleString('ar-EG'),
      'ملاحظات_المعمل': r.labNotes || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'المعلقات ومراجعات المعمل');
  XLSX.writeFile(workbook, `سجل_المرتجعات_المعلقة_بالمعمل_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportReturnReportToPdf(report: any): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const receiptNo = report.returnReceiptNo || report.rmaNo || 'RET-000';
  
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL WAREHOUSE RETURN & QUALITY INSPECTION RECEIPT', 14, 14);

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Receipt #: ${receiptNo} | Invoice #: ${report.originalInvoiceNo} | Order #: ${report.orderNo || '-'} | Customer: ${report.customerName || 'N/A'}`, 14, 20);
  doc.text(`Payment: ${PAYMENT_METHOD_NAMES[report.paymentMethod] || report.paymentMethod || 'Cash'} | Status: ${report.status === 'COMPLETED' ? 'COMPLETED (RESTOCKED)' : 'PENDING LAB REVIEW'} | Date: ${new Date(report.createdAt).toLocaleString()}`, 14, 24);

  const tableData = report.items.map((item: any, idx: number) => [
    idx + 1,
    item.itemCode,
    item.itemName,
    `${item.invoicedQty} ${item.unit}`,
    `${item.actualReturnedQty} ${item.unit}`,
    CONDITION_NAMES[item.condition] || item.condition,
    item.labDecision === 'APPROVED_FOR_RESTOCK' ? 'LAB APPROVED' : item.condition === 'TRANSFERRED_TO_LAB' ? 'PENDING LAB' : 'RESTOCK DIRECT',
    (item.unitPrice || 0).toFixed(2),
    ((item.actualReturnedQty || 0) * (item.unitPrice || 0)).toFixed(2),
    item.notes || ''
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['#', 'Barcode', 'Item Name', 'Invoiced', 'Actual Ret', 'Condition', 'Lab Verdict', 'Price', 'Refund Total', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: report.status === 'COMPLETED' ? [16, 185, 129] : [217, 119, 6], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
  });

  const lastTableY = (doc as any).lastAutoTable?.finalY || 160;
  const signBlockY = Math.min(lastTableY + 8, 175);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(14, signBlockY, 268, 20, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text(`TOTAL REFUND: ${Number(report.totalRefundAmount || 0).toFixed(2)} | RESTOCK PIECES: ${report.totalValidForRestockQty ?? report.totalReturnedQty} | PENDING LAB: ${report.totalTransferredToLabQty ?? 0}`, 18, signBlockY + 6);
  doc.text(`Lead Warehouse Auditor: ${report.auditorName} (${report.auditorId}) | ISA 500 Compliant`, 18, signBlockY + 14);

  doc.save(`Return_Receipt_${receiptNo}.pdf`);
}

// ===================================================================
// 2. Export Inbound Receiving & PO Reports (Excel & PDF)
// ===================================================================
export function exportReceivingReportToExcel(report: any): void {
  const exportRows = report.items.map((item: any, idx: number) => ({
    'No': idx + 1,
    'PO_Number': report.poNumber,
    'Supplier_Name': report.supplierName,
    'Delivery_Note_No': report.deliveryNoteNo || '-',
    'Item_Code': item.itemCode,
    'Item_Name': item.itemName,
    'Unit': item.unit,
    'Expected_Qty': item.expectedQty,
    'Received_Qty': item.receivedQty,
    'Variance_Diff': item.receivedQty - item.expectedQty,
    'Damaged_Qty': item.damagedQty || 0,
    'Batch_No': item.batchNumber || '-',
    'Expiry_Date': item.expiryDate || '-',
    'Status': item.status === 'EXACT' ? 'مكتمل' : item.status === 'SHORTAGE' ? 'عجز / ناقص' : 'زيادة',
    'Notes': item.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'إذن استلام بضائع واردة');
  XLSX.writeFile(workbook, `إذن_استلام_${report.poNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export All Receiving Reports (كافة تقارير وأذون الاستلام المعتمدة)
export function exportAllReceivingReportsToExcel(reports: any[]): void {
  if (!reports || reports.length === 0) {
    alert('لا توجد تقارير استلام محفوظة حالياً للتصدير.');
    return;
  }

  // 1. PO Summary Sheet
  const summaryRows = reports.map((rep, idx) => ({
    'م': idx + 1,
    'رقم_أمر_الشراء (PO_Number)': rep.poNumber,
    'المورد (Supplier)': rep.supplierName,
    'رقم_بوليصة_الشحن (Delivery_Note)': rep.deliveryNoteNo || '-',
    'عدد_الأصناف': rep.items?.length || 0,
    'إجمالي_الكمية_المتوقعة': rep.totalExpectedQty,
    'إجمالي_الكمية_المستلمة': rep.totalReceivedQty,
    'فارق_الاستلام': rep.totalReceivedQty - rep.totalExpectedQty,
    'إجمالي_التالف': rep.totalDamagedQty || 0,
    'حالة_الاستلام': rep.totalReceivedQty === rep.totalExpectedQty 
      ? 'مكتمل ومطابق 100%' 
      : rep.totalReceivedQty < rep.totalExpectedQty 
      ? 'يوجد عجز في التوريد' 
      : 'يوجد زيادة في التوريد',
    'مراجع_الاستلام': `${rep.auditorName || ''} (${rep.auditorId || ''})`,
    'تاريخ_الاستلام': new Date(rep.createdAt).toLocaleString('ar-EG'),
    'ملاحظات': rep.notes || ''
  }));

  // 2. All Items Detailed Sheet
  const allItemsRows: any[] = [];
  let itemIdx = 1;
  reports.forEach(rep => {
    (rep.items || []).forEach((it: any) => {
      allItemsRows.push({
        'م': itemIdx++,
        'رقم_أمر_الشراء': rep.poNumber,
        'اسم_المورد': rep.supplierName,
        'كود_الصنف': it.itemCode,
        'اسم_الصنف': it.itemName,
        'الوحدة': it.unit,
        'الكمية_المتوقعة': it.expectedQty,
        'الكمية_المستلمة_فعلياً': it.receivedQty,
        'الفارق (عجز/زيادة)': it.receivedQty - it.expectedQty,
        'الكمية_التالفة': it.damagedQty || 0,
        'رقم_التشغيلة (Batch_No)': it.batchNumber || '-',
        'تاريخ_الصلاحية': it.expiryDate || '-',
        'حالة_الصنف': it.status === 'EXACT' ? 'مطابق' : it.status === 'SHORTAGE' ? 'عجز' : 'زيادة',
        'تاريخ_الاستلام': new Date(rep.createdAt).toLocaleString('ar-EG'),
        'ملاحظات_الفحص': it.notes || ''
      });
    });
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 14 },
    { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 24 },
    { wch: 22 }, { wch: 22 }, { wch: 25 }
  ];

  const itemsSheet = XLSX.utils.json_to_sheet(allItemsRows);
  itemsSheet['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 35 },
    { wch: 10 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
    { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 25 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص أذون الاستلام');
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'كافة الأصناف المستلمة');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `سجل_كافة_تقارير_الاستلام_المعتمدة_${timestamp}.xlsx`);
}

// ===================================================================
// 3. Export Cycle Count with Packaging Breakdown (Excel & PDF)
// ===================================================================
export function exportInventoryReportToExcel(report: any): void {
  const exportRows = report.items.map((item: any, idx: number) => ({
    'No': idx + 1,
    'Section_Aisle': report.sectionOrAisle || 'All Warehouses',
    'Packaging_Group': item.groupName || 'Standard Single',
    'Item_Code': item.itemCode,
    'Item_Name': item.itemName,
    'Unit': item.unit,
    'Book_Quantity': item.bookQty,
    'Cartons_Count': item.cartonsCount,
    'Carton_Factor': item.cartonFactor,
    'Packs_Count': item.packsCount,
    'Pack_Factor': item.packFactor,
    'Loose_Pieces': item.piecesCount,
    'Calculated_Actual_Total': item.calculatedActualQty,
    'Variance_Difference': item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty,
    'Stock_Status': item.status === 'EXACT' ? 'مطابق' : item.status === 'SHORTAGE' ? 'عجز' : 'زيادة',
    'Auditor': `${report.auditorName} (${report.auditorId})`,
    'Timestamp': new Date(report.createdAt).toLocaleString(),
    'Notes': item.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الجرد وتجميع العبوات');
  XLSX.writeFile(workbook, `تقرير_الجرد_الدوري_${report.title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export All Inventory Reports (كافة تقارير الجرد الدوري وتجميع العبوات)
export function exportAllInventoryReportsToExcel(reports: any[]): void {
  if (!reports || reports.length === 0) {
    alert('لا توجد تقارير جرد دوري محفوظة حالياً للتصدير.');
    return;
  }

  // 1. Sessions Summary Sheet
  const summaryRows = reports.map((rep, idx) => ({
    'م': idx + 1,
    'عنوان_جلسة_الجرد': rep.title,
    'الممر_أو_القطاع': rep.sectionOrAisle,
    'عدد_الأصناف_المجرودة': rep.items?.length || 0,
    'إجمالي_الرصيد_الدفترى': rep.totalBookQty,
    'إجمالي_الرصيد_الفعلي_المحسوب': rep.totalActualQty,
    'فارق_الجرد_الإجمالي': rep.totalVarianceQty > 0 ? `+${rep.totalVarianceQty}` : rep.totalVarianceQty,
    'حالة_الجرد_العامة': rep.totalVarianceQty === 0 
      ? 'مطابق 100%' 
      : rep.totalVarianceQty < 0 
      ? `عجز إجمالي (${Math.abs(rep.totalVarianceQty)})` 
      : `زيادة إجمالية (+${rep.totalVarianceQty})`,
    'مراجع_الجرد_المعتمد': `${rep.auditorName || ''} (${rep.auditorId || ''})`,
    'تاريخ_الاعتماد_والحفظ': new Date(rep.createdAt).toLocaleString('ar-EG'),
  }));

  // 2. All Inventory Items & Packaging Multipliers
  const allItemsRows: any[] = [];
  let itemCounter = 1;
  reports.forEach(rep => {
    (rep.items || []).forEach((item: any) => {
      allItemsRows.push({
        'م': itemCounter++,
        'جلسة_الجرد': rep.title,
        'الممر_أو_القطاع': rep.sectionOrAisle,
        'مجموعة_العبوة': item.groupName || 'عبوة قياسية',
        'كود_الصنف': item.itemCode,
        'اسم_الصنف': item.itemName,
        'الوحدة': item.unit,
        'الرصيد_الدفترى': item.bookQty,
        'عدد_الكراتين': item.cartonsCount,
        'معامل_الكرتونة': item.cartonFactor,
        'عدد_الباكتات': item.packsCount,
        'معامل_الباكت': item.packFactor,
        'حبات_فردية': item.piecesCount,
        'الإجمالي_الفعلي_المحسوب': item.calculatedActualQty,
        'فارق_الجرد': item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty,
        'حالة_الصنف': item.status === 'EXACT' ? 'مطابق' : item.status === 'SHORTAGE' ? 'عجز' : 'زيادة',
        'المراجع': rep.auditorName,
        'تاريخ_الجرد': new Date(rep.createdAt).toLocaleString('ar-EG'),
        'ملاحظات': item.notes || ''
      });
    });
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 18 }, { wch: 20 },
    { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }
  ];

  const itemsSheet = XLSX.utils.json_to_sheet(allItemsRows);
  itemsSheet['!cols'] = [
    { wch: 6 }, { wch: 25 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
    { wch: 35 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص جلسات الجرد');
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'تفاصيل الأصناف وتجميع العبوات');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `سجل_كافة_تقارير_الجرد_الدوري_${timestamp}.xlsx`);
}

// ===================================================================
// 4. Batch Picking List from Multi-Invoice Excel (قوائم الانتقاء والتقاط الفواتير المجمعة)
// ===================================================================

export interface MultiInvoiceRow {
  invoiceNo: string;
  orderNo?: string;
  customerName?: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  category?: string;
  location?: string;
  notes?: string;
}

export interface PickingParseResult {
  waveTitle: string;
  totalInvoicesCount: number;
  invoiceNumbers: string[];
  totalItemsCount: number;
  totalQuantity: number;
  totalCartons: number;
  totalPacks: number;
  totalPieces: number;
  groups: PickingProductGroup[];
  rawRowCount: number;
}

export async function parseMultiInvoicePickingExcel(
  file: File,
  packagingRules: PackagingGroupRule[] = []
): Promise<PickingParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawJson.length === 0) {
    throw new Error('الملف فارغ أو لا يحتوي على بيانات صالحة.');
  }

  // Parse raw rows and normalize
  const rows: MultiInvoiceRow[] = [];
  const invoiceSet = new Set<string>();

  for (const raw of rawJson) {
    let invoiceNo = '';
    let orderNo = '';
    let customerName = '';
    let itemCode = '';
    let itemName = '';
    let unit = 'PCS';
    let quantity = 0;
    let category = '';
    let location = '';
    let notes = '';

    for (const [key, val] of Object.entries(raw)) {
      const normalizedKey = normalizeHeader(key);
      const strVal = String(val).trim();

      if (normalizedKey === 'invoiceNo') {
        invoiceNo = strVal;
      } else if (normalizedKey === 'orderNo') {
        orderNo = strVal;
      } else if (normalizedKey === 'customerName' || key.toLowerCase().includes('customer') || key.includes('عميل')) {
        customerName = strVal;
      } else if (normalizedKey === 'itemCode') {
        itemCode = strVal;
      } else if (normalizedKey === 'itemName') {
        itemName = strVal;
      } else if (normalizedKey === 'unit') {
        unit = strVal || 'PCS';
      } else if (normalizedKey === 'requiredQty' || normalizedKey === 'quantity') {
        const num = parseFloat(strVal.replace(/,/g, ''));
        quantity = isNaN(num) ? 0 : num;
      } else if (key.toLowerCase().includes('category') || key.toLowerCase().includes('group') || key.includes('مجموعة') || key.includes('تصنيف') || key.includes('قسم')) {
        category = strVal;
      } else if (key.toLowerCase().includes('location') || key.toLowerCase().includes('aisle') || key.toLowerCase().includes('bin') || key.includes('موقع') || key.includes('ممر') || key.includes('رف')) {
        location = strVal;
      } else if (key.toLowerCase().includes('note') || key.includes('ملاحظ')) {
        notes = strVal;
      }
    }

    if (!itemCode && raw['كود الصنف']) itemCode = String(raw['كود الصنف']).trim();
    if (!itemCode && raw['الباركود']) itemCode = String(raw['الباركود']).trim();
    if (!itemCode && raw['الكود']) itemCode = String(raw['الكود']).trim();
    if (!itemName && raw['اسم الصنف']) itemName = String(raw['اسم الصنف']).trim();
    if (!invoiceNo && raw['رقم الفاتورة']) invoiceNo = String(raw['رقم الفاتورة']).trim();

    // Fallback invoice if missing
    if (!invoiceNo) {
      invoiceNo = orderNo ? `ORD-${orderNo}` : 'INV-BATCH-001';
    }

    if (itemCode && quantity > 0) {
      invoiceSet.add(invoiceNo);
      rows.push({
        invoiceNo,
        orderNo,
        customerName,
        itemCode,
        itemName: itemName || `صنف كود ${itemCode}`,
        unit: unit || 'حبة',
        quantity,
        category,
        location,
        notes
      });
    }
  }

  if (rows.length === 0) {
    throw new Error('لم يتم العثور على أعمدة صالحة للأصناف والكميات (تأكد من وجود أعمدة: كود الصنف، اسم الصنف، الكمية، رقم الفاتورة).');
  }

  // 1. Group by itemCode and aggregate quantities
  const itemMap = new Map<string, {
    itemCode: string;
    itemName: string;
    unit: string;
    category?: string;
    location?: string;
    totalRequiredQty: number;
    sources: { invoiceNo: string; orderNo?: string; customerName?: string; qty: number }[];
  }>();

  for (const row of rows) {
    const existing = itemMap.get(row.itemCode);
    if (existing) {
      existing.totalRequiredQty += row.quantity;
      if (!existing.itemName && row.itemName) existing.itemName = row.itemName;
      if (!existing.category && row.category) existing.category = row.category;
      if (!existing.location && row.location) existing.location = row.location;

      const srcIdx = existing.sources.findIndex(s => s.invoiceNo === row.invoiceNo);
      if (srcIdx !== -1) {
        existing.sources[srcIdx].qty += row.quantity;
      } else {
        existing.sources.push({
          invoiceNo: row.invoiceNo,
          orderNo: row.orderNo,
          customerName: row.customerName,
          qty: row.quantity
        });
      }
    } else {
      itemMap.set(row.itemCode, {
        itemCode: row.itemCode,
        itemName: row.itemName,
        unit: row.unit,
        category: row.category,
        location: row.location,
        totalRequiredQty: row.quantity,
        sources: [{
          invoiceNo: row.invoiceNo,
          orderNo: row.orderNo,
          customerName: row.customerName,
          qty: row.quantity
        }]
      });
    }
  }

  // 2. Group items into Product Groups with Packaging Breakdown
  const groupMap = new Map<string, {
    groupId: string;
    groupName: string;
    difficulty: GroupDifficultyLevel;
    items: AggregatedPickingItem[];
  }>();

  let waveTotalQty = 0;
  let waveTotalCartons = 0;
  let waveTotalPacks = 0;
  let waveTotalPieces = 0;

  for (const itemData of Array.from(itemMap.values())) {
    // Match packaging rule
    const matchedRule = matchBarcodeToPackagingRule(itemData.itemCode, packagingRules);
    const cartonFactor = matchedRule ? matchedRule.cartonFactor : 24;
    const packFactor = matchedRule ? matchedRule.packFactor : 6;
    
    // Determine group identifier and name
    let gId = 'general';
    let gName = 'مجموعة عامة (تجهيز عادي)';
    let difficulty: GroupDifficultyLevel = 'MEDIUM_INTERMEDIATE';

    if (itemData.category) {
      gName = itemData.category;
      gId = itemData.category.toLowerCase().replace(/\s+/g, '-');
    } else if (matchedRule) {
      gName = matchedRule.name;
      gId = matchedRule.id;
    }

    // Auto-detect difficulty based on keywords
    const lowerName = (gName + ' ' + itemData.itemName).toLowerCase();
    if (
      lowerName.includes('زجاج') || 
      lowerName.includes('دواء') || 
      lowerName.includes('ادوية') || 
      lowerName.includes('أدوية') || 
      lowerName.includes('حساس') || 
      lowerName.includes('عطر') || 
      lowerName.includes('كسر') || 
      lowerName.includes('الكترون') || 
      lowerName.includes('صعب') ||
      lowerName.includes('مبرد') ||
      lowerName.includes('مجمد')
    ) {
      difficulty = 'HIGH_EXPERT';
    } else if (
      lowerName.includes('كرتون') || 
      lowerName.includes('سريع') || 
      lowerName.includes('حجم كبير') || 
      lowerName.includes('مستلزمات') || 
      lowerName.includes('بلاستيك') || 
      lowerName.includes('مناديل') || 
      lowerName.includes('سهل')
    ) {
      difficulty = 'LOW_NOVICE';
    }

    // Packaging Calculation
    const totalQty = itemData.totalRequiredQty;
    const cartonsCount = Math.floor(totalQty / cartonFactor);
    const remainder = totalQty % cartonFactor;
    const packsCount = Math.floor(remainder / packFactor);
    const piecesCount = remainder % packFactor;

    waveTotalQty += totalQty;
    waveTotalCartons += cartonsCount;
    waveTotalPacks += packsCount;
    waveTotalPieces += piecesCount;

    const aggregatedItem: AggregatedPickingItem = {
      id: `pick-item-${itemData.itemCode}-${Date.now()}`,
      itemCode: itemData.itemCode,
      itemName: itemData.itemName,
      unit: itemData.unit,
      groupId: gId,
      groupName: gName,
      totalRequiredQty: totalQty,
      pickedQty: 0,
      cartonFactor,
      packFactor,
      cartonsCount,
      packsCount,
      piecesCount,
      invoiceSources: itemData.sources,
      status: 'PENDING',
      location: itemData.location || 'Aisle-01',
    };

    if (!groupMap.has(gId)) {
      groupMap.set(gId, {
        groupId: gId,
        groupName: gName,
        difficulty,
        items: [aggregatedItem]
      });
    } else {
      groupMap.get(gId)!.items.push(aggregatedItem);
      // Upgrade difficulty if any item is high expert
      if (difficulty === 'HIGH_EXPERT') {
        groupMap.get(gId)!.difficulty = 'HIGH_EXPERT';
      }
    }
  }

  // Convert to PickingProductGroup array
  const groups: PickingProductGroup[] = Array.from(groupMap.values()).map(g => {
    const groupQty = g.items.reduce((sum, it) => sum + it.totalRequiredQty, 0);
    const groupCartons = g.items.reduce((sum, it) => sum + it.cartonsCount, 0);
    const groupPacks = g.items.reduce((sum, it) => sum + it.packsCount, 0);
    const groupPieces = g.items.reduce((sum, it) => sum + it.piecesCount, 0);
    
    // Count unique invoices in this group
    const grpInvoices = new Set<string>();
    g.items.forEach(it => it.invoiceSources.forEach(s => grpInvoices.add(s.invoiceNo)));

    return {
      groupId: g.groupId,
      groupName: g.groupName,
      difficulty: g.difficulty,
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
    waveTitle: `قائمة انتقاء مجمعة (${invoiceSet.size} فواتير) - ${new Date().toLocaleDateString()}`,
    totalInvoicesCount: invoiceSet.size,
    invoiceNumbers: Array.from(invoiceSet),
    totalItemsCount: itemMap.size,
    totalQuantity: waveTotalQty,
    totalCartons: waveTotalCartons,
    totalPacks: waveTotalPacks,
    totalPieces: waveTotalPieces,
    groups,
    rawRowCount: rows.length
  };
}

export function downloadPickingExcelTemplate(): void {
  const sampleRows = [
    {
      'رقم الفاتورة': '204001',
      'رقم الطلب': '200501',
      'اسم العميل': 'سوبرماركت النور',
      'كود الصنف': '6221000101',
      'اسم الصنف': 'عصير برتقال طبيعي 250 مل عبوة زجاجية',
      'الوحدة': 'حبة',
      'الكمية المطلوبة': 48,
      'المجموعة / التصنيف': 'مجموعة المشروبات والعصائر',
      'موقع التخزين': 'ممر A-01-02',
      'ملاحظات': 'يحتاج لخبرة وعناية بالزجاج'
    },
    {
      'رقم الفاتورة': '204002',
      'رقم الطلب': '200502',
      'اسم العميل': 'أسواق البركة المركزية',
      'كود الصنف': '6221000101',
      'اسم الصنف': 'عصير برتقال طبيعي 250 مل عبوة زجاجية',
      'الوحدة': 'حبة',
      'الكمية المطلوبة': 24,
      'المجموعة / التصنيف': 'مجموعة المشروبات والعصائر',
      'موقع التخزين': 'ممر A-01-02',
      'ملاحظات': 'دمج مع الفاتورة الأولى'
    },
    {
      'رقم الفاتورة': '204001',
      'رقم الطلب': '200501',
      'اسم العميل': 'سوبرماركت النور',
      'كود الصنف': '6222000201',
      'اسم الصنف': 'مناديل ورقية فاخرة عبوة 500 منديل',
      'الوحدة': 'حبة',
      'الكمية المطلوبة': 60,
      'المجموعة / التصنيف': 'مجموعة المناديل والاستهلاكيات',
      'موقع التخزين': 'ممر B-04-01',
      'ملاحظات': 'تجهيز سريع بالكراتين'
    },
    {
      'رقم الفاتورة': '204003',
      'رقم الطلب': '200503',
      'اسم العميل': 'مجمع الصيدليات المتحدة',
      'كود الصنف': '6223000301',
      'اسم الصنف': 'محلول معقم طبي مركز 500 مل',
      'الوحدة': 'حبة',
      'الكمية المطلوبة': 15,
      'المجموعة / التصنيف': 'مجموعة الأدوية والمستلزمات الطبية',
      'موقع التخزين': 'ممر C-02-05',
      'ملاحظات': 'منتج حساس يحتاج لعامل خبير'
    },
    {
      'رقم الفاتورة': '204002',
      'رقم الطلب': '200502',
      'اسم العميل': 'أسواق البركة المركزية',
      'كود الصنف': '6224000401',
      'اسم الصنف': 'تونة خفيفة قطع بزيت دوار الشمس 185 جم',
      'الوحدة': 'حبة',
      'الكمية المطلوبة': 120,
      'المجموعة / التصنيف': 'مجموعة المعلبات الغذائية',
      'موقع التخزين': 'ممر D-01-03',
      'ملاحظات': 'تجهيز متوسط'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج_انتقاء_الفواتير');
  XLSX.writeFile(workbook, `Picking_Wave_Template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportPickingWaveToExcel(wave: BatchPickingWave, filterGroupId?: string): void {
  const workbook = XLSX.utils.book_new();

  const groupsToExport = filterGroupId 
    ? wave.groups.filter(g => g.groupId === filterGroupId) 
    : wave.groups;

  // 1. Overview Sheet
  const summaryRows = groupsToExport.map((grp, idx) => ({
    'رقم المجموعة': idx + 1,
    'اسم مجموعة المنتجات': grp.groupName,
    'مستوى الصعوبة': grp.difficulty === 'HIGH_EXPERT' ? 'عالي (خبير)' : grp.difficulty === 'MEDIUM_INTERMEDIATE' ? 'متوسط' : 'سهل (مبتدئ)',
    'العامل المسند إليه': grp.assignedWorkerName || 'غير مسند',
    'مستوى خبرة العامل': grp.assignedWorkerLevel || '-',
    'عدد الأصناف': grp.items.length,
    'إجمالي الكمية (حبة)': grp.totalQty,
    'إجمالي الكراتين': grp.totalCartons,
    'إجمالي الباكتات': grp.totalPacks,
    'إجمالي الحبات الفردية': grp.totalPieces,
    'عدد الفواتير المخدومة': grp.invoicesCount,
    'حالة التجهيز': grp.status === 'COMPLETED' ? 'مكتمل' : grp.status === 'IN_PROGRESS' ? 'قيد التجهيز' : 'معلق'
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص المجموعات والتجهيز');

  // 2. Detailed Items per Group Sheet
  for (const grp of groupsToExport) {
    const detailRows = grp.items.map((it, i) => {
      const invList = it.invoiceSources.map(s => `${s.invoiceNo} (${s.qty})`).join(' + ');
      return {
        'م': i + 1,
        'كود الصنف / الباركود': it.itemCode,
        'اسم الصنف': it.itemName,
        'الموقع بالمستودع': it.location || '-',
        'إجمالي الكمية المطلوبة': it.totalRequiredQty,
        'الكمية المجهزة': it.pickedQty,
        'عدد الكراتين': it.cartonsCount,
        'معامل الكرتونة': it.cartonFactor,
        'عدد الباكتات': it.packsCount,
        'معامل الباكت': it.packFactor,
        'حبات متبقية': it.piecesCount,
        'تفصيل الفواتير والكميات': invList,
        'حالة البند': it.status === 'COMPLETED' ? 'تم الالتقاط' : 'معلق',
        'العامل المسؤول': grp.assignedWorkerName || 'غير محدد'
      };
    });

    const safeSheetName = grp.groupName.slice(0, 28).replace(/[\\/?*[\]]/g, '_');
    const groupSheet = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(workbook, groupSheet, safeSheetName);
  }

  XLSX.writeFile(workbook, `Picking_Wave_${wave.waveNo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export All Picking Waves (كافة موجات وقوائم الانتقاء المجمعة)
export function exportAllPickingWavesToExcel(waves: BatchPickingWave[]): void {
  if (!waves || waves.length === 0) {
    alert('لا توجد موجات انتقاء محفوظة حالياً للتصدير.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  // 1. All Waves Overview Sheet
  const wavesSummaryRows = waves.map((w, idx) => ({
    'م': idx + 1,
    'رقم_الموجة': w.waveNo,
    'عنوان_موجة_الانتقاء': w.title,
    'عدد_الفواتير': w.totalInvoicesCount,
    'عدد_الأصناف_المجمعة': w.totalItemsCount,
    'إجمالي_الكمية_المطلوبة': w.totalQuantity,
    'إجمالي_الكراتين': w.totalCartons,
    'إجمالي_الباكتات': w.totalPacks,
    'إجمالي_الحبات_الفردية': w.totalPieces,
    'عدد_المجموعات_المفصولة': w.groups?.length || 0,
    'حالة_الموجة': w.status === 'COMPLETED' ? 'مكتملة التجهيز 100%' : w.status === 'IN_PROGRESS' ? 'قيد التجهيز' : 'جديدة / مسودة',
    'تاريخ_الإنشاء': new Date(w.createdAt).toLocaleString('ar-EG'),
  }));

  // 2. All Groups & Worker Assignments across all waves
  const allGroupsRows: any[] = [];
  let groupCounter = 1;
  waves.forEach(w => {
    (w.groups || []).forEach(grp => {
      allGroupsRows.push({
        'م': groupCounter++,
        'رقم_الموجة': w.waveNo,
        'عنوان_الموجة': w.title,
        'مجموعة_المنتجات': grp.groupName,
        'مستوى_الصعوبة': grp.difficulty === 'HIGH_EXPERT' ? 'عالي (خبير)' : grp.difficulty === 'MEDIUM_INTERMEDIATE' ? 'متوسط' : 'سهل (مبتدئ)',
        'العامل_المسند_إليه': grp.assignedWorkerName || 'غير مسند',
        'مستوى_خبرة_العامل': grp.assignedWorkerLevel || '-',
        'عدد_الأصناف': grp.items.length,
        'إجمالي_الكمية': grp.totalQty,
        'الكراتين': grp.totalCartons,
        'الباكتات': grp.totalPacks,
        'الحبات_الفردية': grp.totalPieces,
        'الفواتير_المخدومة': grp.invoicesCount,
        'حالة_المجموعة': grp.status === 'COMPLETED' ? 'مكتمل' : grp.status === 'IN_PROGRESS' ? 'قيد التجهيز' : 'معلق'
      });
    });
  });

  // 3. Consolidated SKUs & Invoices details
  const allItemsRows: any[] = [];
  let itemCounter = 1;
  waves.forEach(w => {
    (w.groups || []).forEach(grp => {
      grp.items.forEach(it => {
        const invList = it.invoiceSources.map(s => `${s.invoiceNo} (${s.qty})`).join(' + ');
        allItemsRows.push({
          'م': itemCounter++,
          'رقم_الموجة': w.waveNo,
          'المجموعة': grp.groupName,
          'كود_الصنف': it.itemCode,
          'اسم_الصنف': it.itemName,
          'الموقع': it.location || '-',
          'إجمالي_المطلوب': it.totalRequiredQty,
          'الكمية_المجهزة': it.pickedQty,
          'الكراتين': it.cartonsCount,
          'معامل_الكرتونة': it.cartonFactor,
          'الباكتات': it.packsCount,
          'معامل_الباكت': it.packFactor,
          'الحبات_المتبقية': it.piecesCount,
          'تفصيل_الفواتير_المخدومة': invList,
          'حالة_الصنف': it.status === 'COMPLETED' ? 'تم الالتقاط' : 'معلق',
          'العامل_المسؤول': grp.assignedWorkerName || 'غير محدد'
        });
      });
    });
  });

  const wavesSummarySheet = XLSX.utils.json_to_sheet(wavesSummaryRows);
  wavesSummarySheet['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 20 },
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }
  ];

  const groupsSheet = XLSX.utils.json_to_sheet(allGroupsRows);
  groupsSheet['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 25 }, { wch: 25 }, { wch: 18 },
    { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 16 }
  ];

  const allItemsSheet = XLSX.utils.json_to_sheet(allItemsRows);
  allItemsSheet['!cols'] = [
    { wch: 6 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 35 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 35 }, { wch: 14 },
    { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(workbook, wavesSummarySheet, 'ملخص موجات الانتقاء');
  XLSX.utils.book_append_sheet(workbook, groupsSheet, 'توزيع المجموعات والعمال');
  XLSX.utils.book_append_sheet(workbook, allItemsSheet, 'كافة الأصناف المجمعة والفواتير');

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `سجل_كافة_موجات_الانتقاء_المجمعة_${timestamp}.xlsx`);
}

export function exportWorkerPickingSheetPdf(
  wave: BatchPickingWave, 
  group: PickingProductGroup,
  worker?: WarehouseWorker
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const isExpert = group.difficulty === 'HIGH_EXPERT';

  // Header Banner
  doc.setFillColor(isExpert ? 153 : 30, isExpert ? 27 : 41, isExpert ? 27 : 59);
  doc.rect(10, 10, 277, 24, 'F');

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(`BATCH WAVE PICKING SHEET - ${wave.waveNo}`, 16, 20);

  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  const workerDisplay = worker ? `${worker.name} (${worker.code} - ${worker.experienceLevel})` : (group.assignedWorkerName || 'UNASSIGNED');
  doc.text(`Product Group: ${group.groupName} | Difficulty: ${group.difficulty} | Assigned Worker: ${workerDisplay}`, 16, 29);

  // Stats bar
  doc.setFillColor(241, 245, 249);
  doc.rect(10, 36, 277, 12, 'F');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `TOTAL ITEMS: ${group.items.length} | TOTAL QTY: ${group.totalQty} PCS | CARTONS: ${group.totalCartons} CTN | PACKS: ${group.totalPacks} PK | LOOSE PIECES: ${group.totalPieces} | INVOICES: ${group.invoicesCount}`,
    14,
    44
  );

  // Table rows
  const tableData = group.items.map((it, idx) => {
    const invDetails = it.invoiceSources.map(s => `${s.invoiceNo}:${s.qty}`).join(', ');
    return [
      String(idx + 1),
      it.location || 'Aisle-1',
      it.itemCode,
      it.itemName,
      String(it.totalRequiredQty),
      `${it.cartonsCount} Ctn (x${it.cartonFactor})`,
      `${it.packsCount} Pk (x${it.packFactor})`,
      `${it.piecesCount} Pcs`,
      invDetails,
      '[  ] PICKED'
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [['#', 'Location', 'Item Barcode', 'Item Description', 'Total Qty', 'Cartons Breakdown', 'Packs Breakdown', 'Loose Pcs', 'Invoices Breakdown', 'Check']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: isExpert ? [185, 28, 28] : [15, 23, 42], 
      textColor: [255, 255, 255], 
      fontSize: 8.5,
      halign: 'center' 
    },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 32, fontStyle: 'bold' },
      3: { cellWidth: 55 },
      4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 25, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 50 },
      9: { cellWidth: 24, halign: 'center' }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  const signY = Math.min(finalY + 8, 185);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, signY, 277, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Picker Signature: ______________________     Supervisor Approval: ______________________     Wave Pick Time: ${new Date().toLocaleString()}`, 16, signY + 11);

  doc.save(`Picking_Sheet_${wave.waveNo}_${group.groupId}.pdf`);
}

// ===================================================================
// Specialized Quality Lab Weekly Saturday Transfer Report (Screenshot 1 Format)
// ===================================================================
export function exportSaturdayWeeklyLabReportToExcel(
  reports: any[],
  filterLabOnly: boolean = false
): void {
  // Extract items from reports
  const allItems: any[] = [];
  let reportCounter = 1;

  reports.forEach(r => {
    const isLabReport = r.status === 'PENDING_LAB' || (r.items || []).some((i: any) => i.condition === 'TRANSFERRED_TO_LAB');
    if (filterLabOnly && !isLabReport) return;

    (r.items || []).forEach((item: any) => {
      if (filterLabOnly && item.condition !== 'TRANSFERRED_TO_LAB') return;

      const inspectionNo = String(reportCounter).padStart(6, '0');
      const inspectionDate = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
      const magentoOrderNo = r.orderNo ? r.orderNo.replace(/^(?:return|new)/i, '') : '-';
      const oracleRmaNo = r.returnReceiptNo || (r.orderNo ? `return${r.orderNo.replace(/^(?:return|new)/i, '')}` : '-');
      
      // Extract size & color if not explicitly defined
      let extractedSize = item.size || '';
      let extractedColor = item.color || '-';
      if (!extractedSize) {
        const sizeMatch = (item.itemName || '').match(/\b(XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|6XL|\d{2}[RSL]?)\b/i);
        if (sizeMatch) extractedSize = sizeMatch[1].toUpperCase();
        else extractedSize = 'L';
      }
      if (extractedColor === '-') {
        if (/أبيض|ابيض|white/i.test(item.itemName || '')) extractedColor = 'أبيض';
        else if (/أسود|اسود|black/i.test(item.itemName || '')) extractedColor = 'أسود';
        else if (/أزرق|ازرق|blue/i.test(item.itemName || '')) extractedColor = 'كحلي/أزرق';
      }

      const packagingCond = item.packagingCondition || 'مغلق بتغليف المصنع';
      const reason = item.reasonText || (item.reason === 'CUSTOMER_REFUSED' ? 'رفض العميل الاستلام' : item.reason === 'DEFECTIVE' ? 'عيب صناعة' : 'مرتجع');
      const decision = item.condition === 'TRANSFERRED_TO_LAB' || item.inspectionDecision === 'LAB' 
        ? 'تحويل للمعمل الفني' 
        : 'إعادة للمخزن الصالح';
      const inspector = item.inspectorName || r.auditorName || 'أحمد عيد';

      allItems.push({
        inspectionNo,
        inspectionDate,
        magentoOrderNo,
        oracleRmaNo,
        sku: item.itemCode,
        productName: item.itemName,
        size: extractedSize,
        color: extractedColor,
        packagingCondition: packagingCond,
        returnReason: reason,
        decision,
        inspectorName: inspector,
        qty: item.actualReturnedQty || item.scannedQty || 1,
      });

      reportCounter++;
    });
  });

  if (allItems.length === 0) {
    alert('لا توجد أصناف محولة للمعمل أو مرتجعات مطابقة للفحص للتصدير.');
    return;
  }

  // Construct structured 2D array matching Screenshot 1 exactly
  const aoa: any[][] = [];

  // Row 1: Headers
  aoa.push([
    'رقم تقرير الفحص',
    'تاريخ الفحص',
    'رقم طلب مجينتو',
    'رقم أوراكل RMA',
    'رمز المنتج SKU',
    'اسم المنتج',
    'المقاس',
    'اللون',
    'حالة التغليف للملابس الداخلية',
    'سبب الإرجاع',
    'قرار الفحص المبدئي',
    'اسم فاحص الجودة'
  ]);

  // Data rows
  allItems.forEach(row => {
    aoa.push([
      row.inspectionNo,
      row.inspectionDate,
      row.magentoOrderNo,
      row.oracleRmaNo,
      row.sku,
      row.productName,
      row.size,
      row.color,
      row.packagingCondition,
      row.returnReason,
      row.decision,
      row.inspectorName
    ]);
  });

  // Empty spacer rows
  aoa.push([]);
  aoa.push([]);

  // Lab Transfer Bottom Section (Screenshot 1 Section)
  const transferHeaderRowIndex = aoa.length;
  aoa.push(['بيانات التحويل للمعمل الفني']);
  aoa.push(['اسم معمل الاستلام:', 'معمل النسيج وفحص الجودة المركزي']);
  aoa.push(['طبيعة الاختبار:', 'فحص عيوب التصنيع ومطابقة التغليف والقياسات']);
  aoa.push(['تاريخ التحويل:', new Date().toLocaleDateString('ar-EG')]);
  aoa.push([]);
  aoa.push([
    'موظف المستودع: _____________________  التوقيع:',
    '',
    '',
    'مسؤول الجودة: _____________________  التوقيع:',
    '',
    '',
    '',
    'مستلم المعمل: _____________________  التوقيع:'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  worksheet['!cols'] = [
    { wch: 18 }, // رقم تقرير الفحص
    { wch: 14 }, // تاريخ الفحص
    { wch: 18 }, // رقم طلب مجينتو
    { wch: 22 }, // رقم أوراكل RMA
    { wch: 18 }, // رمز المنتج SKU
    { wch: 32 }, // اسم المنتج
    { wch: 10 }, // المقاس
    { wch: 12 }, // اللون
    { wch: 28 }, // حالة التغليف
    { wch: 22 }, // سبب الإرجاع
    { wch: 22 }, // قرار الفحص
    { wch: 20 }  // اسم فاحص الجودة
  ];

  // Merges for Lab Transfer Header
  worksheet['!merges'] = [
    { s: { r: transferHeaderRowIndex, c: 0 }, e: { r: transferHeaderRowIndex, c: 11 } }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير فحص وتحويل المعمل');

  const saturdayDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `تقرير_الحبات_المحولة_للمعمل_الاسبوعي_سبت_${saturdayDate}.xlsx`);
}

// ===================================================================
// Specialized Refund Request Excel Generator (Screenshot 2 Format)
// ===================================================================
export function exportRefundRequestExcelFormatted(report: any): void {
  if (!report || !report.items || report.items.length === 0) {
    alert('لا توجد أصناف في طلب الاسترداد للتصدير.');
    return;
  }

  const cleanOrderNo = report.orderNo ? report.orderNo.replace(/^(?:return|new)/i, '') : '-';
  const reportDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
  const invoiceNo = report.originalInvoiceNo || '-';

  // Construct AOA matching Screenshot 2 precisely
  const aoa: any[][] = [];

  // Row 1: Header Banner "Refund Request"
  aoa.push(['Refund Request', '']);

  // Row 2: Date
  aoa.push(['Date:', reportDate]);

  // Row 3: Order No
  aoa.push(['Order No:', cleanOrderNo]);

  // Row 4: Invoice No
  aoa.push(['Invoice No:', invoiceNo]);

  // Row 5: Table Header
  aoa.push(['Refund SKU', 'Quantity']);

  // Rows 6..N: SKUs and Quantities
  const startDataRow = 6; // 1-indexed
  const refundItems = (report.items || []).filter((i: any) => i.isIncludedInRefund !== false && (Number(i.actualReturnedQty) > 0 || Number(i.scannedQty) > 0));
  const activeItems = refundItems.length > 0 ? refundItems : report.items;

  activeItems.forEach((item: any) => {
    aoa.push([
      item.itemCode,
      Number(item.actualReturnedQty || item.scannedQty || 1)
    ]);
  });

  const endDataRow = startDataRow + activeItems.length - 1;

  // Payment Method Name
  let paymentInfo = PAYMENT_METHOD_NAMES[report.paymentMethod] || report.paymentMethod || 'نقدي (Cash)';
  if (report.paymentMethod === 'CARD') {
    paymentInfo = 'بطاقة مدى / ائتمانية (Card Payment)';
  } else if (report.paymentMethod === 'COD') {
    paymentInfo = 'دفع عند الاستلام (Cash on Delivery)';
  } else if (report.paymentMethod === 'BANK_TRANSFER') {
    paymentInfo = 'تحويل بنكي لحساب العميل (Bank Wire)';
  } else if (report.paymentMethod === 'CREDIT_BALANCE') {
    paymentInfo = 'رصيد دائن / تابي - تمارا 4 دفعات بدون فوائد';
  }

  // Reason for refund
  const refundReason = report.notes || (activeItems[0]?.reasonText) || (activeItems[0]?.reason === 'CUSTOMER_REFUSED' ? 'رفض العميل الاستلام' : 'مرتجع');

  // Payment Information Row
  aoa.push(['Payment Information:', paymentInfo]);

  // Reason for Refund Row
  aoa.push(['Reason for Refund:', refundReason]);

  // Total Refund Amount Row (with Excel Formula SUM or calculated total amount)
  const totalRefund = Number(report.totalRefundAmount || activeItems.reduce((s: number, i: any) => s + (Number(i.refundTotal) || (Number(i.actualReturnedQty || 1) * Number(i.unitPrice || 0))), 0)).toFixed(2);
  aoa.push(['Total Refund Amount:', `${totalRefund} SAR`]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Column Widths
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 36 }
  ];

  // Merge Row 1 Title
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Refund Request');

  const receiptRef = report.returnReceiptNo || `return${cleanOrderNo}`;
  XLSX.writeFile(workbook, `Refund_Request_${receiptRef}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export All Refund Requests in the Screenshot 2 Layout (Multi-Sheet Workbook)
export function exportAllRefundRequestsExcelFormatted(reports: any[]): void {
  const completedRefunds = reports.filter(r => r.status === 'COMPLETED' || r.totalRefundAmount > 0);
  if (completedRefunds.length === 0) {
    alert('لا توجد طلبات استرداد مكتملة للتصدير.');
    return;
  }

  const workbook = XLSX.utils.book_new();

  completedRefunds.forEach((report, index) => {
    const cleanOrderNo = report.orderNo ? report.orderNo.replace(/^(?:return|new)/i, '') : `ORD-${index + 1}`;
    const reportDate = report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
    const invoiceNo = report.originalInvoiceNo || '-';

    const aoa: any[][] = [];
    aoa.push(['Refund Request', '']);
    aoa.push(['Date:', reportDate]);
    aoa.push(['Order No:', cleanOrderNo]);
    aoa.push(['Invoice No:', invoiceNo]);
    aoa.push(['Refund SKU', 'Quantity']);

    const refundItems = (report.items || []).filter((i: any) => i.isIncludedInRefund !== false);
    const activeItems = refundItems.length > 0 ? refundItems : report.items;

    activeItems.forEach((item: any) => {
      aoa.push([
        item.itemCode,
        Number(item.actualReturnedQty || item.scannedQty || 1)
      ]);
    });

    let paymentInfo = PAYMENT_METHOD_NAMES[report.paymentMethod] || report.paymentMethod || 'نقدي (Cash)';
    const refundReason = report.notes || 'مرتجع من العميل';
    const totalRefund = Number(report.totalRefundAmount || 0).toFixed(2);

    aoa.push(['Payment Information:', paymentInfo]);
    aoa.push(['Reason for Refund:', refundReason]);
    aoa.push(['Total Refund Amount:', `${totalRefund} SAR`]);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 36 }];
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    const sheetName = `Refund_${cleanOrderNo}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `طلبات_الاسترداد_المالي_المجمعة_Excel_${timestamp}.xlsx`);
}

