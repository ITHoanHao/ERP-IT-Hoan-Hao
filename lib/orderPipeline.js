const dayjs = require('dayjs');

// Kiem tra 1 san pham co du ton kho de dap ung so luong can khong
function hasEnoughStock(db, productId, neededQty) {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if (!product) return true; // khong xac dinh duoc, bo qua canh bao
  let available = 0;
  if (product.tracking_type === 'serial') {
    available = db.prepare(`SELECT COUNT(*) as c FROM inventory_serials WHERE product_id=? AND status='in_stock'`).get(productId).c;
  } else {
    available = db.prepare(`SELECT COALESCE(SUM(quantity_remaining),0) as q FROM inventory_batches WHERE product_id=?`).get(productId).q;
  }
  return available >= neededQty;
}

// Tra ve danh sach cac "don hang" dang can theo doi (chua hoan tat toan bo 5 buoc).
// Moi phan tu: { quotationId, quotationNo, soId, soNo, customerName, link, stages: {s1..s5}, overdue: {s1..s5} }
// stages: 'done' | 'in_progress' (chua toi thi la null)
function getTrackedOrders(db) {
  const now = dayjs();
  const results = [];

  const quotations = db.prepare(
    `SELECT q.*, c.name as customer_name FROM quotations q JOIN customers c ON c.id=q.customer_id
     WHERE q.status IN ('sent','confirmed') ORDER BY q.id DESC`
  ).all();

  quotations.forEach(q => {
    const itemsPreview = db.prepare(
      `SELECT GROUP_CONCAT(COALESCE(p.name, ql.description, ''), ', ') as t
       FROM quotation_lines ql LEFT JOIN products p ON p.id = ql.product_id WHERE ql.quotation_id = ?`
    ).get(q.id).t || '';
    const item = {
      quotationId: q.id, quotationNo: q.quotation_no, customerName: q.customer_name,
      itemsPreview: itemsPreview.length > 80 ? itemsPreview.slice(0, 80) + '...' : itemsPreview,
      totalAmount: q.total_amount,
      soId: null, soNo: null,
      stages: { s1: 'done', s2: null, s3: null, s4: null, s5: null },
      overdue: { s1: false, s2: false, s3: false, s4: false, s5: false },
      link: `/quotations/${q.id}`,
    };

    if (q.status === 'sent') {
      item.stages.s1 = 'in_progress';
      const daysSinceSent = now.diff(dayjs(q.updated_at), 'day');
      if (daysSinceSent >= 3) item.overdue.s1 = true;
      results.push(item);
      return;
    }

    // q.status === 'confirmed' -> tim Sales Order tuong ung
    const so = db.prepare(`SELECT * FROM sales_orders WHERE quotation_id=?`).get(q.id);
    if (!so || so.status === 'cancelled') return;
    item.link = `/sales-orders/${so.id}`;
    item.soId = so.id;
    item.soNo = so.so_no;

    const invoice = db.prepare(`SELECT * FROM invoices WHERE so_id=?`).get(so.id);
    const hasEInvoice = invoice
      ? !!db.prepare(`SELECT 1 FROM attachments WHERE entity_type='invoice' AND entity_id=? AND label IS NULL`).get(invoice.id)
      : false;
    const isPaid = invoice ? invoice.payment_status === 'paid' : false;

    // Da hoan tat toan bo 5 buoc (giao hang + hoa don dien tu + da thanh toan) -> khong can theo doi nua
    if (so.status === 'delivered' && invoice && hasEInvoice && isPaid) return;

    // ---- Giai doan 2: Dat hang tu NCC (bo qua neu da du ton kho) ----
    const relatedPOs = db.prepare(`SELECT id FROM purchase_orders WHERE related_so_id=? AND status != 'cancelled'`).all(so.id);
    const soLines = db.prepare(`SELECT * FROM sales_order_lines WHERE so_id=?`).all(so.id);
    let stockSufficientForAll = true;
    soLines.forEach(line => {
      if (!line.product_id) return; // dich vu tu do, khong can ton kho
      if (!hasEnoughStock(db, line.product_id, line.quantity)) stockSufficientForAll = false;
    });
    const stage2Done = relatedPOs.length > 0 || stockSufficientForAll;
    item.stages.s2 = stage2Done ? 'done' : 'in_progress';
    if (!stage2Done) {
      const daysSinceConfirm = now.diff(dayjs(so.order_date), 'day');
      if (daysSinceConfirm >= 1) item.overdue.s2 = true;
      results.push(item);
      return;
    }

    // ---- Giai doan 3: Giao hang cho khach ----
    if (so.status === 'delivered') {
      item.stages.s3 = 'done';
    } else {
      item.stages.s3 = 'in_progress';
      const latestGR = db.prepare(
        `SELECT gr.receipt_date FROM goods_receipts gr JOIN purchase_orders po ON po.id=gr.po_id
         WHERE po.related_so_id=? ORDER BY gr.receipt_date DESC LIMIT 1`
      ).get(so.id);
      const refDate = latestGR ? latestGR.receipt_date : so.order_date;
      if (now.diff(dayjs(refDate), 'day') >= 1) item.overdue.s3 = true;
      results.push(item);
      return;
    }

    // ---- Giai doan 4: Lam chung tu (hoa don + dinh kem hoa don dien tu) ----
    if (invoice && hasEInvoice) {
      item.stages.s4 = 'done';
    } else {
      item.stages.s4 = 'in_progress';
      const refDate = invoice ? invoice.invoice_date : so.order_date;
      if (now.diff(dayjs(refDate), 'day') >= 1) item.overdue.s4 = true;
      results.push(item);
      return;
    }

    // ---- Giai doan 5: Ghi nhan thanh toan (qua han theo dung han cong no cua khach hang) ----
    if (isPaid) {
      item.stages.s5 = 'done';
    } else {
      item.stages.s5 = 'in_progress';
      const customer = db.prepare('SELECT credit_term_days FROM customers WHERE id=?').get(so.customer_id);
      const termDays = (customer && customer.credit_term_days) || 0;
      const dueDate = dayjs(invoice.invoice_date).add(termDays, 'day');
      if (now.isAfter(dueDate, 'day')) item.overdue.s5 = true;
    }
    results.push(item);
  });

  return results;
}

// Thong bao rieng cho License sap het han / da qua han (tach khoi order pipeline nhung dung chung 1 chuong)
function getLicenseNotifications(db) {
  const notifications = [];
  const today = dayjs().format('YYYY-MM-DD');
  const in14days = dayjs().add(14, 'day').format('YYYY-MM-DD');
  const expiringLicenses = db.prepare(
    `SELECT l.*, c.name as customer_name FROM licenses l JOIN customers c ON c.id = l.customer_id
     WHERE l.status='active' AND l.requires_renewal=1 AND l.expiry_date IS NOT NULL AND l.expiry_date <= ?
     ORDER BY l.expiry_date ASC`
  ).all(in14days);
  expiringLicenses.forEach(l => {
    const overdue = l.expiry_date < today;
    notifications.push({
      icon: overdue ? 'bi-exclamation-octagon-fill' : 'bi-clock-history',
      severity: overdue ? 'danger' : 'warning',
      message: `License "${l.license_name}" (${l.customer_name}) ${overdue ? 'đã quá hạn' : 'sắp hết hạn'} — hết hạn ${l.expiry_date.split('-').reverse().join('/')}. Nhắc khách gia hạn.`,
      link: `/licenses/${l.id}`,
    });
  });
  return notifications;
}

// Thong bao rieng cho Hop dong thue tro sap het han / da qua han (tach khoi order pipeline nhung dung chung 1 chuong)
function getBoardingContractNotifications(db) {
  const notifications = [];
  const today = dayjs().format('YYYY-MM-DD');
  const in30days = dayjs().add(30, 'day').format('YYYY-MM-DD');
  const expiring = db.prepare(
    `SELECT c.*, r.room_name FROM bt_room_contracts c
     JOIN bt_rooms r ON r.id=c.room_id
     WHERE c.is_active=1 AND c.contract_end_date IS NOT NULL AND c.contract_end_date <= ?
     ORDER BY c.contract_end_date ASC`
  ).all(in30days);
  expiring.forEach(c => {
    const tenants = db.prepare(
      `SELECT t.full_name FROM bt_room_occupancy o JOIN bt_tenants t ON t.id=o.tenant_id WHERE o.room_id=? AND o.is_active=1`
    ).all(c.room_id).map(t => t.full_name).join(', ');
    const overdue = c.contract_end_date < today;
    notifications.push({
      icon: overdue ? 'bi-exclamation-octagon-fill' : 'bi-clock-history',
      severity: overdue ? 'danger' : 'warning',
      message: `Hợp đồng thuê Phòng ${c.room_name} (${tenants}) ${overdue ? 'đã quá hạn' : 'sắp hết hạn'} — hết hạn ${c.contract_end_date.split('-').reverse().join('/')}. Hỏi gia hạn hoặc chấm dứt hợp đồng.`,
      link: '/nhatro/contracts',
    });
  });
  return notifications;
}

// Chuyen danh sach don hang thanh danh sach thong bao (dung cho chuong) - gom ca order pipeline, License, Hop dong thue tro
function getNotifications(db) {
  const orders = getTrackedOrders(db);
  const notifications = [];
  orders.forEach(o => {
    if (o.overdue.s1) notifications.push({ icon: 'bi-send', severity: 'warning', message: `Báo giá ${o.quotationNo} (${o.customerName}) đã gửi khách quá 3 ngày chưa chốt`, link: o.link });
    if (o.overdue.s2) notifications.push({ icon: 'bi-cart', severity: 'warning', message: `Đơn bán ${o.soNo} (${o.customerName}) đã chốt hơn 1 ngày, chưa đặt hàng NCC`, link: o.link });
    if (o.overdue.s3) notifications.push({ icon: 'bi-truck', severity: 'danger', message: `Đơn bán ${o.soNo} (${o.customerName}) đã nhận hàng hơn 1 ngày, chưa giao cho khách`, link: o.link });
    if (o.overdue.s4) notifications.push({ icon: 'bi-file-earmark-text', severity: 'danger', message: `Đơn bán ${o.soNo} (${o.customerName}) đã giao hàng hơn 1 ngày, chưa đính kèm hóa đơn điện tử`, link: o.link });
    if (o.overdue.s5) notifications.push({ icon: 'bi-cash-coin', severity: 'danger', message: `Đơn bán ${o.soNo} (${o.customerName}) đã quá hạn thanh toán — nhắc khách thanh toán`, link: o.link });
  });
  notifications.push(...getLicenseNotifications(db));
  try { notifications.push(...getBoardingContractNotifications(db)); } catch (e) { /* bo qua neu chua co bang (ban rat cu) */ }
  return notifications;
}

module.exports = { getTrackedOrders, getNotifications, getLicenseNotifications, getBoardingContractNotifications, hasEnoughStock };
