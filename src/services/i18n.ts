export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    appTitle: 'مدير عمليات المستودع',
    offlineMode: '100% أوفلاين',
    scannerReady: 'قارئ الباركود الخطي 1D: جاهز',
    qrScannerBtn: 'مسح QR الفاتورة / الأوردر بالكاميرا',
    updateExcel: 'تحديث بيانات إكسيل / مزامنة',
    sync: 'مزامنة',
    
    // Core Warehouse Operations Tabs
    activeAudit: 'مدقق الفواتير والتجهيز',
    receivingTab: 'الاستلام والمطابقة',
    returnsTab: 'المرتجعات وطلبات الاسترداد',
    inventoryTab: 'الجرد وتجميع العبوات',
    
    errorReport: 'تقرير الأخطاء والنواقص',
    masterInvoices: 'الفواتير والأوردرات',
    tools: 'الأدوات والمحاكي',
    soundOn: 'الصوت مفعّل',
    soundMuted: 'صامت',
    
    // Step A & B
    stepATitle: 'الخطوة 1: امسح باركود أو QR الفاتورة / الأوردر لبدء التدقيق',
    stepADesc: 'وجّه قارئ الباركود الخطي أو استخدم كاميرا الهاتف لقراءة رمز QR الفاتورة/الأوردر. سيتم قفل الجلسة وتحميل الأصناف فوراً.',
    stepBTitle: 'الخطوة 2: امسح باركود الأصناف بقارئ الباركود الخطي (بأي ترتيب)',
    stepBDesc: 'امسح باركود كل صنف مباشرة بأي ترتيب. العداد سيزيد تلقائياً بدون أي ضغط على الشاشة.',
    
    // Active Audit
    activeInvoice: 'الفاتورة الحالية قيد الفحص',
    orderNumberLabel: 'رقم الأوردر:',
    closeInvoice: 'إنهاء الفاتورة واعتماد التقرير',
    scanPlaceholderLocked: 'امسح باركود أي صنف عشوائياً بقارئ الباركود الخطي (أو امسح فاتورة جديدة للتبديل)...',
    scanPlaceholderUnlocked: 'امسح باركود الفاتورة أو الأوردر (أو اضغط زر الكاميرا لقراءة QR)...',
    scanButton: 'مسح / إدخال',
    
    // Last Scanned Item Banner
    lastScannedTitle: 'آخر صنف تم مسحه الآن',
    scannedCount: 'العدد الممسوح',
    requiredTarget: 'العدد المطلوب',
    remaining: 'المتبقي',
    extra: 'زيادة',
    
    // Sort options
    sortBy: 'ترتيب الجدول:',
    sortLastScanned: 'الأحدث مسحاً أولاً (للإسكان العشوائي)',
    sortOriginalOrder: 'ترتيب الفاتورة الأصلي',
    sortPendingFirst: 'المتبقي والنواقص أولاً',
    sortErrorsFirst: 'الأخطاء والزيادات أولاً',
    
    // Table Columns
    colOrderNo: 'رقم الأوردر',
    colItemCode: 'كود الصنف والاسم',
    colUnit: 'الوحدة',
    colReq: 'المطلوب',
    colActual: 'الممسوح (الفعلي)',
    colCodeStatus: 'مطابقة الكود',
    colQtyStatus: 'حالة الكمية',
    colAdjust: 'تعديل سريع',
    
    // Statuses
    statusMatch: 'مطابق',
    statusMismatch: 'غير مدرج بالفاتورة',
    statusExact: 'مكتمل تماماً',
    statusShortage: 'ناقص',
    statusSurplus: 'زيادة (فائض)',
    
    // Summary Modal
    auditCompletedTitle: 'تم فحص وإنهاء الفاتورة',
    cleanDiscarded: 'أصناف سليمة 100% (تم تفريغها تلقائياً)',
    archivedErrors: 'فروقات وأخطاء (تم حفظها بالتقرير)',
    viewErrorsBtn: 'عرض تقرير الأخطاء',
    scanNextInvoice: 'مسح الفاتورة التالية',
    
    // Export & Errors
    exportExcel: 'تصدير إكسيل (.xlsx)',
    exportPdf: 'تصدير PDF',
    print: 'طباعة',
    clearAll: 'مسح السجلات',
    totalDiscrepancies: 'إجمالي الفروقات',
    itemMismatches: 'أصناف غير مدرجة',
    qtyShortages: 'نواقص بالكمية',
    qtySurpluses: 'زيادات بالكمية',
    wrongPickingTab: 'تقرير التجهيز الخاطئ والأصناف المستبعدة',
    invoiceVarianceTab: 'تقرير عجز وزيادة الفواتير',
    wrongPickingTitle: 'تقرير التجهيز الخاطئ (الأصناف التي لا تنتمي للفاتورة)',
    wrongPickingDesc: 'أصناف تم مسحها ولا تنتمي للفاتورة المفحوصة - تم استبعادها من جدول الفاتورة وترحيلها هنا مباشرة لمنع تلوث سجلات الجرد.',
    wrongPickingIntercepted: 'صنف تجهيز خاطئ تم استبعاده',
    
    // Simulator & Random scan tip
    randomScanBanner: '⚡ يدعم الإسكان العشوائي عبر قارئ الباركود الخطي 1D مع إمكانية قراءة QR للفاتورة والأوردر بالكاميرا.',
  },
  en: {
    appTitle: 'WAREHOUSE OPERATIONS MANAGER',
    offlineMode: '100% OFFLINE',
    scannerReady: '1D Linear Scanner: Active',
    qrScannerBtn: 'Scan Invoice / Order QR Code (Camera)',
    updateExcel: 'Update Excel Data / Sync',
    sync: 'Sync',
    
    // Core Warehouse Operations Tabs
    activeAudit: 'Invoice Dispatch Auditor',
    receivingTab: 'Inbound Receiving',
    returnsTab: 'Returns & Credit Notes (RMA)',
    inventoryTab: 'Cycle Count & Packaging',
    
    errorReport: 'Error Audit Report',
    masterInvoices: 'Master Invoices & Orders',
    tools: 'Tools & Simulator',
    soundOn: 'Sound ON',
    soundMuted: 'Muted',
    
    stepATitle: 'Step A: Scan Invoice or Order Barcode / QR to Begin',
    stepADesc: 'Point your 1D linear barcode scanner or tap the camera button to scan the invoice/order QR code. The app locks onto it immediately.',
    stepBTitle: 'Step B: Scan Item Barcodes with 1D Linear Scanner in Any Order',
    stepBDesc: 'Scan items randomly in any sequence. The automatic counter increments instantaneously.',
    
    activeInvoice: 'Active Audit Session',
    orderNumberLabel: 'Order #:',
    closeInvoice: 'Close & Evaluate Invoice',
    scanPlaceholderLocked: 'Scan item barcode with 1D scanner (or scan new invoice/order to switch)...',
    scanPlaceholderUnlocked: 'Scan invoice/order barcode or tap Camera for QR Code...',
    scanButton: 'Scan Item',
    
    lastScannedTitle: 'Just Scanned Item (Real-Time Focus)',
    scannedCount: 'Scanned Qty',
    requiredTarget: 'Required Target',
    remaining: 'Remaining',
    extra: 'Surplus',
    
    sortBy: 'Sort Table:',
    sortLastScanned: 'Last Scanned at Top (Random Scan Mode)',
    sortOriginalOrder: 'Original Invoice Order',
    sortPendingFirst: 'Pending / Shortages First',
    sortErrorsFirst: 'Errors & Surplus First',
    
    colOrderNo: 'Order #',
    colItemCode: 'Item Code & Name',
    colUnit: 'Unit',
    colReq: 'Req',
    colActual: 'Actual (Count)',
    colCodeStatus: 'Code Status',
    colQtyStatus: 'Qty Status',
    colAdjust: 'Adjust',
    
    statusMatch: 'MATCH',
    statusMismatch: 'MISMATCH',
    statusExact: 'EXACT',
    statusShortage: 'SHORTAGE',
    statusSurplus: 'SURPLUS',
    
    auditCompletedTitle: 'Invoice Audited & Closed',
    cleanDiscarded: 'Clean Items (Auto-Discarded)',
    archivedErrors: 'Discrepancies (Archived to Report)',
    viewErrorsBtn: 'View Error Audit Report',
    scanNextInvoice: 'Scan Next Invoice',
    
    exportExcel: 'Export Excel (.xlsx)',
    exportPdf: 'Export PDF',
    print: 'Print',
    clearAll: 'Clear All',
    totalDiscrepancies: 'Total Discrepancies',
    itemMismatches: 'Item Mismatches',
    qtyShortages: 'Qty Shortages',
    qtySurpluses: 'Qty Surpluses',
    wrongPickingTab: 'Wrong Picking & Foreign Items Report',
    invoiceVarianceTab: 'Invoice Variances (Shortage / Surplus)',
    wrongPickingTitle: 'Wrong Picking Report (Items NOT in Invoice)',
    wrongPickingDesc: 'Items scanned that do not belong to the audited invoice. Automatically excluded from invoice ledger and archived here.',
    wrongPickingIntercepted: 'Wrong Picking Item Intercepted',
    
    randomScanBanner: '⚡ Supports 1D linear barcode scanner keyboard wedge & camera QR code reader for invoices and order numbers.',
  }
};
