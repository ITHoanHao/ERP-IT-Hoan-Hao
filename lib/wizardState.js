const { hasEnoughStock } = require('./orderPipeline');

// Tinh toan chi tiet 8 buoc cua 1 don hang (bat dau tu 1 Bao gia) de hien thi tren man hinh Wizard.
// Moi buoc: { key, label, status: 'done'|'current'|'locked'|'skipped', link (huong dan lam buoc nay),
//             note (giai thich them, VD ly do bi bo qua) }
// QUAN TRONG: day CHI la lop hien thi/dieu huong. Viec chan cung thuc su nam o phia server (xem cac
// route quotations/purchaseOrders/deliveries/... da duoc sua de tu choi neu thieu du lieu buoc truoc).
function getWizardState(db, quotationId) {
  const q = db.prepare(
    `SELECT q.*, c.name as customer_name FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?`
  ).get(quotationId);
  if (!q) return null;

  const so = db.prepare(`SELECT * FROM sales_orders WHERE quotation_id=?`).get(q.id);
  const soLines = so ? db.prepare(`SELECT * FROM sales_order_lines WHERE so_id=?`).all(so.id) : [];
  const pos = so ? db.prepare(
    `SELECT po.* FROM purchase_orders po WHERE po.related_so_id=? AND po.status != 'cancelled'`
  ).all(so.id) : [];

  let stockSufficientForAll = soLines.length > 0;
  soLines.forEach(line => {
    if (!line.product_id) return; // dich vu tu do, khong tinh ton kho
    if (!hasEnoughStock(db, line.product_id, line.quantity)) stockSufficientForAll = false;
  });

  const poIds = pos.map(p => p.id);
  let receipts = [];
  if (poIds.length) {
    const placeholders = poIds.map(() => '?').join(',');
    receipts = db.prepare(`SELECT * FROM goods_receipts WHERE po_id IN (${placeholders})`).all(...poIds);
  }
  const allPOsReceived = pos.length > 0 && pos.every(po => po.status === 'completed');

  const delivery = so ? db.prepare(`SELECT * FROM deliveries WHERE so_id=?`).get(so.id) : null;
  const invoice = so ? db.prepare(`SELECT * FROM invoices WHERE so_id=?`).get(so.id) : null;
  const hasEInvoiceFile = invoice
    ? !!db.prepare(`SELECT 1 FROM attachments WHERE entity_type='invoice' AND entity_id=?`).get(invoice.id)
    : false;
  const payment = invoice
    ? db.prepare(`SELECT * FROM payments WHERE source_doc_type='invoice' AND source_doc_id=?`).get(invoice.id)
    : null;

  const steps = [];
  const w = quotationId; // rut gon ten bien dung lam query param ?wizard=

  // Buoc 1: Tao bao gia (luon "done" vi da co ban ghi quotation)
  steps.push({ key: 'quote', label: '1. Tạo báo giá', status: 'done', link: `/quotations/${q.id}/edit` });

  // Buoc 2: Gui khach
  if (q.status === 'draft') {
    steps.push({ key: 'send', label: '2. Gửi báo giá cho khách', status: 'current', link: `/quotations/${q.id}?wizard=${w}`,
      actionLabel: 'Xem lại & Gửi báo giá' });
    return finalize(q, so, steps);
  }
  steps.push({ key: 'send', label: '2. Gửi báo giá cho khách', status: 'done' });

  // Buoc 3: Khach chot
  if (q.status === 'sent') {
    steps.push({ key: 'confirm', label: '3. Khách chốt đơn', status: 'current', link: `/quotations/${q.id}?wizard=${w}`,
      actionLabel: 'Đánh dấu khách đã chốt' });
    return finalize(q, so, steps);
  }
  if (q.status === 'rejected') {
    steps.push({ key: 'confirm', label: '3. Khách chốt đơn', status: 'rejected', note: 'Khách đã từ chối báo giá này — đơn hàng dừng lại ở đây.' });
    return finalize(q, so, steps);
  }
  steps.push({ key: 'confirm', label: '3. Khách chốt đơn', status: 'done' });

  if (!so) return finalize(q, so, steps); // an toan: ly thuyet khong xay ra vi confirm luon tao SO

  // Buoc 4: Don mua hang NCC (bo qua neu da du ton kho san co)
  // QUAN TRONG: uu tien kiem tra "da co PO that chua" (pos.length) TRUOC khi xet ton kho hien tai -
  // vi sau khi da Nhan hang xong, ton kho luc do se hien "du" (chinh la hang vua nhan ve), neu xet
  // ton kho truoc se bi bao nham la "Bo qua" trong khi thuc ra da lam that (chi la lam roi).
  if (pos.length > 0) {
    steps.push({ key: 'po', label: '4. Đơn mua hàng (từ NCC)', status: 'done' });
  } else if (stockSufficientForAll) {
    steps.push({ key: 'po', label: '4. Đơn mua hàng (từ NCC)', status: 'skipped', note: 'Đã đủ tồn kho sẵn có — không cần đặt hàng NCC.' });
  } else {
    steps.push({ key: 'po', label: '4. Đơn mua hàng (từ NCC)', status: 'current',
      link: `/purchase-orders/new?so_id=${so.id}&wizard=${w}`, actionLabel: 'Tạo đơn mua hàng' });
    return finalize(q, so, steps);
  }

  // Buoc 5: Nhan hang ve (chi ap dung neu buoc 4 co lam that, tuc pos.length > 0)
  if (pos.length === 0) {
    steps.push({ key: 'receipt', label: '5. Nhận hàng về (từ NCC)', status: 'skipped' });
  } else if (!allPOsReceived) {
    const pendingPO = pos.find(po => po.status !== 'completed');
    steps.push({ key: 'receipt', label: '5. Nhận hàng về (từ NCC)', status: 'current',
      link: `/goods-receipts/new?po_id=${pendingPO.id}&wizard=${w}`, actionLabel: 'Nhận hàng' });
    return finalize(q, so, steps);
  } else {
    steps.push({ key: 'receipt', label: '5. Nhận hàng về (từ NCC)', status: 'done' });
  }

  // Buoc 6: Giao hang cho khach
  if (!delivery) {
    steps.push({ key: 'delivery', label: '6. Giao hàng cho khách', status: 'current',
      link: `/deliveries/new?so_id=${so.id}&wizard=${w}`, actionLabel: 'Giao hàng' });
    return finalize(q, so, steps);
  }
  steps.push({ key: 'delivery', label: '6. Giao hàng cho khách', status: 'done' });

  // Buoc 7: Nhap hoa don + chung tu (hoa don da tu sinh khi giao hang, chi can dinh kem file that)
  if (!invoice) {
    // Ly thuyet khong xay ra (giao hang tu dong tao hoa don), nhung phong ho
    steps.push({ key: 'invoice', label: '7. Nhập hóa đơn & chứng từ', status: 'locked', note: 'Chưa có hóa đơn — kiểm tra lại bước giao hàng.' });
    return finalize(q, so, steps);
  }
  if (!hasEInvoiceFile) {
    steps.push({ key: 'invoice', label: '7. Nhập hóa đơn & chứng từ', status: 'current',
      link: `/invoices/${invoice.id}/upload?wizard=${w}`, actionLabel: 'Đính kèm hóa đơn điện tử' });
    return finalize(q, so, steps);
  }
  steps.push({ key: 'invoice', label: '7. Nhập hóa đơn & chứng từ', status: 'done' });

  // Buoc 8: Ghi nhan thanh toan
  if (!payment) {
    steps.push({ key: 'payment', label: '8. Ghi nhận thanh toán', status: 'current',
      link: `/payments/new?invoice_id=${invoice.id}&wizard=${w}`, actionLabel: 'Ghi nhận thanh toán' });
    return finalize(q, so, steps);
  }
  steps.push({ key: 'payment', label: '8. Ghi nhận thanh toán', status: 'done' });

  return finalize(q, so, steps, true);
}

function finalize(q, so, steps, completed) {
  return { quotation: q, salesOrder: so, steps, completed: !!completed };
}

// Danh sach cac don dang xu ly do (chua hoan tat), de hien tren man hinh /wizard
function getActiveWizardOrders(db) {
  const quotations = db.prepare(
    `SELECT q.id FROM quotations q WHERE q.status IN ('draft','sent','confirmed') ORDER BY q.id DESC`
  ).all();
  const results = [];
  quotations.forEach(row => {
    const state = getWizardState(db, row.id);
    if (state && !state.completed) results.push(state);
  });
  return results;
}

module.exports = { getWizardState, getActiveWizardOrders };
