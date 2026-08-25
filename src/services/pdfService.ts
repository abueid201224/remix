import * as pdfjsLib from 'pdfjs-dist';
import type { MasterInvoiceItem } from '../types';

// Set worker source for pdfjs
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch {
    // fallback if cdn fails or worker already loaded
  }
}

export interface ExtractedPdfDocument {
  documentNo: string;
  orderNo?: string;
  returnReceiptNo?: string;
  documentType: 'INVOICE' | 'RETURN' | 'RECEIVING' | 'INVENTORY' | 'UNKNOWN';
  customerName?: string;
  paymentMethod?: string; // Flexible payment method string extracted directly from PDF above items table
  date?: string;
  items: ExtractedPdfItem[];
  rawText: string;
  totalPages: number;
}

export interface ExtractedPdfItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number; // المجموع الفرعي للصنف بالفاتورة
  totalPrice?: number;
  isHighlighted?: boolean;
  pageNumber: number;
  returnReason?: string;
  condition?: 'INTACT' | 'DAMAGED' | 'EXPIRED' | 'OPEN_BOX' | 'WRONG_ITEM';
}

/**
 * Extracts raw structured text and tables from PDF files using pdfjs-dist
 */
export async function parsePdfInvoice(
  file: File,
  highlightedOnly: boolean = false
): Promise<ExtractedPdfDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let fullText = '';
  const detectedLines: { text: string; page: number; y: number; x: number; isBoldOrMarked?: boolean }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Group text items by roughly same Y coordinates to form lines
    const lineMap = new Map<number, { text: string; x: number; isBold?: boolean }[]>();
    
    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === '') continue;
      const y = Math.round(item.transform[5] / 4) * 4; // Round Y to tolerance
      const x = Math.round(item.transform[4]);
      
      const currentList = lineMap.get(y) || [];
      currentList.push({
        text: item.str,
        x,
        isBold: item.fontName?.toLowerCase().includes('bold') || item.fontName?.toLowerCase().includes('black')
      });
      lineMap.set(y, currentList);
      fullText += item.str + ' ';
    }

    // Sort lines from top of page to bottom (descending Y in PDF coordinates)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const parts = lineMap.get(y) || [];
      parts.sort((a, b) => a.x - b.x);
      const combinedLineText = parts.map(p => p.text).join(' ').trim();
      if (combinedLineText) {
        detectedLines.push({
          text: combinedLineText,
          page: i,
          y,
          x: parts[0]?.x || 0,
          isBoldOrMarked: parts.some(p => p.isBold)
        });
      }
    }
  }

  // 1. Detect Document Number (Invoice #): Starts from the left with '204' (e.g. 204123456)
  let documentNo = '';
  const invoice204Match = fullText.match(/\b(204\d{3,20})\b/);
  if (invoice204Match && invoice204Match[1]) {
    documentNo = invoice204Match[1].trim();
  } else {
    const docNoRegex = /(?:فاتورة|فاتوره|invoice|inv|bill|doc)[\s#№:.\-_]*([A-Za-z0-9\-_/]{3,25})/i;
    const matchDoc = fullText.match(docNoRegex);
    if (matchDoc && matchDoc[1]) {
      documentNo = matchDoc[1].trim();
    } else {
      // General fallback regex
      const genMatch = fullText.match(/(?:أوردر|طلب|order|rma|po)[\s#№:.\-_]*([A-Za-z0-9\-_/]{3,25})/i);
      if (genMatch && genMatch[1]) {
        documentNo = genMatch[1].trim();
      } else {
        const fallbackMatch = file.name.replace(/\.[^/.]+$/, '').replace(/[^A-Za-z0-9-_]/g, '-');
        documentNo = fallbackMatch || `DOC-${Date.now().toString().slice(-6)}`;
      }
    }
  }

  // 2. Detect Order Number: Starts from the left with '200' or 'return200' / 'new200'
  let orderNo = '';
  const order200Match = fullText.match(/\b((?:return|new)?200\d{3,20})\b/i);
  if (order200Match && order200Match[1]) {
    orderNo = order200Match[1].trim();
  } else {
    const orderRegex = /(?:رقم الطلب|أوردر|الطلب|order no|order #|po #|order id)[\s#№:.\-_]*([A-Za-z0-9\-_/]{3,25})/i;
    const matchOrder = fullText.match(orderRegex);
    if (matchOrder && matchOrder[1]) {
      orderNo = matchOrder[1].trim();
    }
  }

  // 3. Return Receipt Number: Always 'return' + Order Number from the far left without delimiters
  let returnReceiptNo = '';
  if (orderNo) {
    const cleanOrder = orderNo.replace(/^(?:return|new)/i, '').trim();
    returnReceiptNo = `return${cleanOrder}`;
  }

  // Detect Customer / Vendor Name
  let customerName = '';
  const customerRegex = /(?:العميل|السيد|المورد|شركة|مؤسسة|customer|client|vendor|to|buyer)[\s:.\-_]*([\u0600-\u06FF\w\s]{3,35})/i;
  const matchCust = fullText.match(customerRegex);
  if (matchCust && matchCust[1]) {
    customerName = matchCust[1].trim().replace(/\n/g, ' ');
  }

  // 4. Identify the boundary where the items table starts (to isolate text above the table)
  const barcodePattern = /\b(\d{7,14}|SKU-[A-Za-z0-9-_]+|[A-Za-z]{2,5}-\d{3,8})\b/;
  const numberPattern = /\b(\d+(?:\.\d{1,2})?)\b/g;

  let firstTableLineIndex = detectedLines.findIndex(l => 
    barcodePattern.test(l.text) || 
    /(?:الباركود|كود الصنف|الصنف|الوصف|الكمية|السعر|المجموع|المجموع الفرعي|barcode|item code|description|qty|unit price|subtotal|amount)/i.test(l.text)
  );
  if (firstTableLineIndex < 0) firstTableLineIndex = Math.min(15, detectedLines.length);

  const headerLines = detectedLines.slice(0, Math.max(1, firstTableLineIndex));

  // Detect Payment Method strictly from the Header section (above the items table)
  let paymentMethod = '';
  for (const lineObj of headerLines) {
    const line = lineObj.text.trim();
    
    // Explicit label match (e.g. "طريقة الدفع: تمارا" or "Payment Method: Tabby")
    const labelMatch = line.match(/(?:طريقة الدفع|وسيلة الدفع|طريقة السداد|نوع الدفع|شروط الدفع|طريقة الشراء|Payment Method|Payment Type|Payment Terms|Payment Mode|Payment)[\s:.\-_/|]*([^\n\r,;|]+)/i);
    if (labelMatch && labelMatch[1]) {
      const val = labelMatch[1].replace(/[:\-]/g, '').trim();
      if (val.length >= 2 && !/^(?:لا يوجد|none|null|undefined)$/i.test(val)) {
        paymentMethod = val;
        break;
      }
    }

    // Specific payment brand keywords in header
    if (/تمارا|tamara/i.test(line)) {
      paymentMethod = 'تمارا (Tamara)';
      break;
    } else if (/تابي|tabby/i.test(line)) {
      paymentMethod = 'تابي (Tabby)';
      break;
    } else if (/apple\s*pay|ابل\s*باي|أبل\s*باي/i.test(line)) {
      paymentMethod = 'أبل باي (Apple Pay)';
      break;
    } else if (/stc\s*pay|اس\s*تي\s*سي/i.test(line)) {
      paymentMethod = 'STC Pay';
      break;
    } else if (/مدى|mada/i.test(line)) {
      paymentMethod = 'بطاقة مدى (Mada)';
      break;
    } else if (/فيزا|visa|ماستركارد|mastercard|بطاقة ائتمانية|credit card/i.test(line)) {
      paymentMethod = 'بطاقة ائتمانية (Credit Card)';
      break;
    } else if (/تحويل بنكي|حوالة|bank transfer|wire transfer/i.test(line)) {
      paymentMethod = 'تحويل بنكي (Bank Transfer)';
      break;
    } else if (/دفع عند الاستلام|عند الاستلام|cod|cash on delivery/i.test(line)) {
      paymentMethod = 'دفع عند الاستلام (COD)';
      break;
    } else if (/نقدي|كاش|cash/i.test(line) && !/non-cash/i.test(line)) {
      paymentMethod = 'نقدي (Cash)';
      break;
    } else if (/آجل|اجل|رصيد محفظة|credit balance|wallet/i.test(line)) {
      paymentMethod = 'رصيد محفظة / آجل (Credit)';
      break;
    }
  }

  // Fallback check on full text if header had no explicit match
  if (!paymentMethod) {
    if (/تمارا|tamara/i.test(fullText)) paymentMethod = 'تمارا (Tamara)';
    else if (/تابي|tabby/i.test(fullText)) paymentMethod = 'تابي (Tabby)';
    else if (/apple\s*pay|ابل\s*باي/i.test(fullText)) paymentMethod = 'أبل باي (Apple Pay)';
    else if (/مدى|mada/i.test(fullText)) paymentMethod = 'بطاقة مدى (Mada)';
    else if (/تحويل|بنك|bank|transfer/i.test(fullText)) paymentMethod = 'تحويل بنكي (Bank Transfer)';
    else if (/عند الاستلام|cod|cash on delivery/i.test(fullText)) paymentMethod = 'دفع عند الاستلام (COD)';
    else if (/نقدي|كاش|cash/i.test(fullText)) paymentMethod = 'نقدي (Cash)';
    else paymentMethod = 'نقدي (Cash)';
  }

  // Detect items from table rows - Extract all items completely from the invoice PDF
  const extractedItems: ExtractedPdfItem[] = [];
  let itemCounter = 1;

  for (const lineObj of detectedLines) {
    const line = lineObj.text;
    const barcodeMatch = line.match(barcodePattern);

    if (barcodeMatch) {
      const barcode = barcodeMatch[1];
      
      // Extract numbers in the line (quantities & prices & subtotals)
      const allNumbers: number[] = [];
      let matchNum: RegExpExecArray | null;
      while ((matchNum = numberPattern.exec(line)) !== null) {
        const val = parseFloat(matchNum[1]);
        if (matchNum[1] !== barcode && !isNaN(val)) {
          allNumbers.push(val);
        }
      }

      let qty = 1;
      let unitPrice = 0;
      let subtotal = 0;

      if (allNumbers.length >= 3) {
        // [Qty, UnitPrice, Subtotal] or [UnitPrice, Qty, Subtotal]
        const n0 = allNumbers[0];
        const n1 = allNumbers[1];
        const n2 = allNumbers[allNumbers.length - 1]; // last number is usually line subtotal

        if (Math.abs((n0 * n1) - n2) < 0.5) {
          qty = n0;
          unitPrice = n1;
          subtotal = n2;
        } else if (Math.abs((n1 * n2) - n0) < 0.5) {
          unitPrice = n1;
          qty = n2;
          subtotal = n0;
        } else {
          // Default heuristic: first integer is quantity, last is subtotal
          qty = Math.max(1, Math.round(n0));
          subtotal = n2;
          unitPrice = qty > 0 ? Number((subtotal / qty).toFixed(2)) : n1;
        }
      } else if (allNumbers.length === 2) {
        // [Qty, Subtotal]
        qty = Math.max(1, Math.round(allNumbers[0]));
        subtotal = allNumbers[1];
        unitPrice = qty > 0 ? Number((subtotal / qty).toFixed(2)) : subtotal;
      } else if (allNumbers.length === 1) {
        qty = Math.max(1, Math.round(allNumbers[0]));
        subtotal = 0;
        unitPrice = 0;
      }

      // If unit price was calculated but subtotal wasn't
      if (!subtotal && unitPrice > 0 && qty > 0) {
        subtotal = Number((qty * unitPrice).toFixed(2));
      }

      // Item description: Remove barcode and numbers
      let desc = line
        .replace(barcode, '')
        .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
        .replace(/[:|,\-_/#]/g, ' ')
        .trim();

      if (!desc || desc.length < 2) {
        desc = `صنف باركود ${barcode}`;
      }

      // Check unit
      let unit = 'PCS';
      if (/كرتون|كرتونة|ctn|box|كرتون/i.test(line)) unit = 'BOX';
      else if (/باكت|pack|باكتة/i.test(line)) unit = 'PACK';
      else if (/كجم|kg|كيلو/i.test(line)) unit = 'KG';
      else if (/حبة|قطعة|حبه|قطعه|pcs|ea/i.test(line)) unit = 'PCS';

      const isItemHighlighted = lineObj.isBoldOrMarked || line.includes('*') || line.includes('★');

      extractedItems.push({
        id: `pdf-item-${itemCounter++}`,
        itemCode: barcode,
        itemName: desc,
        unit,
        quantity: Math.max(1, qty),
        unitPrice: unitPrice || (subtotal > 0 && qty > 0 ? Number((subtotal / qty).toFixed(2)) : undefined),
        subtotal: subtotal || (unitPrice > 0 ? Number((qty * unitPrice).toFixed(2)) : undefined),
        totalPrice: subtotal || (unitPrice ? Number((qty * unitPrice).toFixed(2)) : undefined),
        isHighlighted: isItemHighlighted,
        pageNumber: lineObj.page,
        condition: 'INTACT',
        returnReason: 'طلب استرجاع من العميل',
      });
    }
  }

  // Always extract full invoice items completely
  const finalItems = (highlightedOnly && extractedItems.some(i => i.isHighlighted))
    ? extractedItems.filter(i => i.isHighlighted)
    : extractedItems;

  return {
    documentNo,
    orderNo: orderNo || undefined,
    returnReceiptNo: returnReceiptNo || undefined,
    documentType: /مرتجع|rma|return/i.test(fullText) ? 'RETURN' : /استلام|receiving|po/i.test(fullText) ? 'RECEIVING' : 'INVOICE',
    customerName: customerName || undefined,
    paymentMethod,
    date: new Date().toISOString().slice(0, 10),
    items: finalItems,
    rawText: fullText.slice(0, 3000),
    totalPages: pdf.numPages,
  };
}

/**
 * Converts Extracted PDF Items to MasterInvoiceItems format for instant auditing or session loading
 */
export function convertPdfItemsToMaster(
  extracted: ExtractedPdfDocument
): MasterInvoiceItem[] {
  const importedAt = new Date().toISOString();
  return extracted.items.map((item, idx) => ({
    invoiceNo: extracted.documentNo,
    itemCode: item.itemCode,
    itemName: item.itemName,
    unit: item.unit,
    requiredQty: item.quantity,
    importedAt,
    originalIndex: idx,
  }));
}
