const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT q.*, c.name as customer_name,
       (SELECT GROUP_CONCAT(COALESCE(p.name, ql.description, ''), ', ')
        FROM quotation_lines ql LEFT JOIN products p ON p.id = ql.product_id
        WHERE ql.quotation_id = q.id) as items_preview
     FROM quotations q JOIN customers c ON c.id=q.customer_id
     WHERE (? = '' OR q.quotation_no LIKE ? OR c.name LIKE ? OR q.short_title LIKE ?
       OR EXISTS (SELECT 1 FROM quotation_lines ql2 LEFT JOIN products p2 ON p2.id=ql2.product_id
                  WHERE ql2.quotation_id=q.id AND (p2.name LIKE ? OR ql2.description LIKE ?)))
     ORDER BY q.id DESC`
  ).all(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  rows.forEach(r => {
    if (r.items_preview && r.items_preview.length > 70) r.items_preview = r.items_preview.slice(0, 70) + '...';
  });
  res.render('quotations/list', { title: 'Báo giá', rows, q });
});

function getSettings() {
  return db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
}

function getAttrList(type) {
  return db.prepare('SELECT value FROM product_attributes WHERE attr_type=? ORDER BY value').all(type).map(r => r.value);
}

router.get('/new', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  const products = db.prepare('SELECT * FROM products WHERE is_active=1 ORDER BY name').all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('quotations/form', { title: 'Tạo báo giá', customers, products, suppliers, row: null, lines: [], settings: getSettings(),
    categories: getAttrList('category'), brands: getAttrList('brand'), units: getAttrList('unit'), wizard: null });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/quotations');
  if (row.status === 'confirmed') return res.redirect('/quotations/' + row.id);
  const lines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id=?').all(row.id);
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  const products = db.prepare('SELECT * FROM products WHERE is_active=1 ORDER BY name').all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('quotations/form', { title: 'Sửa báo giá ' + row.quotation_no, customers, products, suppliers, row, lines, settings: getSettings(),
    categories: getAttrList('category'), brands: getAttrList('brand'), units: getAttrList('unit'), wizard: req.query.wizard || null });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT q.*, c.name as customer_name FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(req.params.id);
  if (!row) return res.redirect('/quotations');
  const lines = db.prepare(
    `SELECT ql.*, p.name as product_name FROM quotation_lines ql LEFT JOIN products p ON p.id=ql.product_id WHERE ql.quotation_id=?`
  ).all(row.id);
  const so = db.prepare('SELECT * FROM sales_orders WHERE quotation_id=?').get(row.id);
  let chainInfo = null;
  if (so) {
    const invoice = db.prepare('SELECT * FROM invoices WHERE so_id=?').get(so.id);
    const deliveries = db.prepare('SELECT * FROM deliveries WHERE so_id=?').all(so.id);
    const payment = invoice ? db.prepare(`SELECT * FROM payments WHERE source_doc_type='invoice' AND source_doc_id=?`).get(invoice.id) : null;
    chainInfo = { so, invoice, deliveries, payment };
  }
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='quotation' AND entity_id=? ORDER BY id DESC`).all(row.id);
  const wizard = req.query.wizard || null;
  res.render('quotations/detail', { title: row.quotation_no, row, lines, so, chainInfo, attachments, wizard });
});

function saveLines(quotationId, body) {
  db.prepare('DELETE FROM quotation_lines WHERE quotation_id=?').run(quotationId);
  const products = Array.isArray(body.line_product) ? body.line_product : [body.line_product];
  const descs = Array.isArray(body.line_desc) ? body.line_desc : [body.line_desc];
  const qtys = Array.isArray(body.line_qty) ? body.line_qty : [body.line_qty];
  const prices = Array.isArray(body.line_price) ? body.line_price : [body.line_price];
  const warranties = Array.isArray(body.line_warranty) ? body.line_warranty : [body.line_warranty];
  const taxRates = Array.isArray(body.line_tax) ? body.line_tax : [body.line_tax];
  let subtotal = 0, vat = 0;
  const insert = db.prepare(
    `INSERT INTO quotation_lines (quotation_id, product_id, description, quantity, unit_price, warranty_months, tax_rate_percent, line_amount) VALUES (?,?,?,?,?,?,?,?)`
  );
  for (let i = 0; i < descs.length; i++) {
    const qty = parseFloat(qtys[i]) || 0;
    const price = parseFloat(prices[i]) || 0;
    const taxRate = parseFloat(taxRates[i]);
    const tr = isNaN(taxRate) ? 8 : taxRate;
    if (qty <= 0) continue;
    const amountPrecise = qty * price; // chua VAT, gia goc co the co so le
    const amountRounded = Math.round(amountPrecise); // "Thanh tien" tung dong lam tron, dung nhu hoa don dien tu
    subtotal += amountRounded;
    vat += Math.round(amountPrecise * tr / 100); // VAT tinh tu so chua lam tron, roi lam tron TUNG DONG
    insert.run(quotationId, products[i] || null, descs[i] || '', qty, price, parseInt(warranties[i]) || 0, tr, amountRounded);
  }
  const total = subtotal + vat;
  db.prepare('UPDATE quotations SET subtotal_amount=?, vat_amount=?, total_amount=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(subtotal, vat, total, quotationId);
}

router.post('/', (req, res) => {
  const b = req.body;
  const qno = genNumber(db, 'QT', 'quotations', 'quotation_no');
  const info = db.prepare(
    `INSERT INTO quotations (quotation_no, customer_id, quotation_date, status, valid_until, short_title, note) VALUES (?,?,date('now'),'draft',?,?,?)`
  ).run(qno, b.customer_id, b.valid_until || null, b.short_title || null, b.note || '');
  saveLines(info.lastInsertRowid, b);
  res.redirect('/quotations/' + info.lastInsertRowid);
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare('UPDATE quotations SET customer_id=?, valid_until=?, short_title=?, note=? WHERE id=?')
    .run(b.customer_id, b.valid_until || null, b.short_title || null, b.note || '', req.params.id);
  saveLines(req.params.id, b);
  const wizard = req.query.wizard || b.wizard;
  res.redirect('/quotations/' + req.params.id + (wizard ? '?wizard=' + wizard : ''));
});

router.post('/:id/send', (req, res) => {
  db.prepare(`UPDATE quotations SET status='sent', updated_at=datetime('now') WHERE id=? AND status='draft'`).run(req.params.id);
  if (req.query.wizard) return res.redirect('/wizard/' + req.query.wizard);
  res.redirect('/quotations/' + req.params.id);
});

router.post('/:id/reject', (req, res) => {
  db.prepare(`UPDATE quotations SET status='rejected' WHERE id=?`).run(req.params.id);
  if (req.query.wizard) return res.redirect('/wizard/' + req.query.wizard);
  res.redirect('/quotations/' + req.params.id);
});

// Khach chot -> tu dong sinh Sales Order
router.post('/:id/confirm', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!q || q.status !== 'sent') return res.redirect('/quotations/' + req.params.id);
  const lines = db.prepare('SELECT * FROM quotation_lines WHERE quotation_id=?').all(q.id);

  const tx = db.transaction(() => {
    db.prepare(`UPDATE quotations SET status='confirmed' WHERE id=?`).run(q.id);
    const soNo = genNumber(db, 'SO', 'sales_orders', 'so_no');
    const soInfo = db.prepare(
      `INSERT INTO sales_orders (so_no, quotation_id, customer_id, order_date, status, subtotal_amount, vat_amount, total_amount) VALUES (?,?,?,date('now'),'created',?,?,?)`
    ).run(soNo, q.id, q.customer_id, q.subtotal_amount, q.vat_amount, q.total_amount);
    const insertLine = db.prepare(
      `INSERT INTO sales_order_lines (so_id, product_id, description, quantity, unit_price, tax_rate_percent, warranty_months, line_amount) VALUES (?,?,?,?,?,?,?,?)`
    );
    lines.forEach(l => insertLine.run(soInfo.lastInsertRowid, l.product_id, l.description, l.quantity, l.unit_price, l.tax_rate_percent, l.warranty_months, l.line_amount));
    return soInfo.lastInsertRowid;
  });
  const soId = tx();
  if (req.query.wizard) return res.redirect('/wizard/' + req.query.wizard);
  res.redirect('/sales-orders/' + soId);
});

router.get('/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT q.*, c.name as customer_name, c.address as customer_address, c.contact_person, c.phone, c.tax_code FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(req.params.id);
  if (!row) return res.redirect('/quotations');
  const lines = db.prepare(
    `SELECT ql.*, p.name as product_name FROM quotation_lines ql LEFT JOIN products p ON p.id=ql.product_id WHERE ql.quotation_id=?`
  ).all(row.id);
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
  require('../lib/quotationPdf')(res, row, lines, settings);
});

router.get('/:id/excel', async (req, res) => {
  const row = db.prepare('SELECT q.*, c.name as customer_name, c.address as customer_address, c.contact_person, c.phone, c.tax_code FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(req.params.id);
  if (!row) return res.redirect('/quotations');
  const lines = db.prepare(
    `SELECT ql.*, p.name as product_name, p.unit as product_unit FROM quotation_lines ql LEFT JOIN products p ON p.id=ql.product_id WHERE ql.quotation_id=?`
  ).all(row.id);
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
  try {
    await require('../lib/quotationExcel')(res, row, lines, settings);
  } catch (e) {
    console.error('[XUAT EXCEL BAO GIA] Loi:', e);
    if (!res.headersSent) res.redirect('/quotations/' + row.id + '?err=' + encodeURIComponent('Không thể xuất file Excel: ' + e.message));
  }
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'quotations', id: req.params.id, backUrl: '/quotations', label: 'báo giá' });
});

router.post('/:id/delete-chain', (req, res) => {
  const { verifyCurrentUserPassword } = require('../lib/auth');
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect('/quotations/' + req.params.id + '?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const quotation = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!quotation) return res.redirect('/quotations');

  try {
    const tx = db.transaction(() => {
      const summary = { payment: 0, invoice: 0, delivery: 0, so: 0, contract: 0 };
      const so = db.prepare('SELECT * FROM sales_orders WHERE quotation_id=?').get(quotation.id);
      if (so) {
        const invoice = db.prepare('SELECT * FROM invoices WHERE so_id=?').get(so.id);
        if (invoice) {
          const payment = db.prepare(`SELECT * FROM payments WHERE source_doc_type='invoice' AND source_doc_id=?`).get(invoice.id);
          if (payment) { db.prepare('DELETE FROM payments WHERE id=?').run(payment.id); summary.payment++; }
          db.prepare('DELETE FROM invoices WHERE id=?').run(invoice.id);
          summary.invoice++;
        }
        // Hoan tac ton kho cho tung phieu giao hang (giong logic xoa Giao hang rieng le)
        const deliveries = db.prepare('SELECT * FROM deliveries WHERE so_id=?').all(so.id);
        deliveries.forEach(delivery => {
          const dlLines = db.prepare('SELECT * FROM delivery_lines WHERE delivery_id=?').all(delivery.id);
          dlLines.forEach(l => {
            if (l.serial_id) {
              db.prepare(`UPDATE inventory_serials SET status='in_stock', customer_id=NULL, warranty_expiry_date=NULL WHERE id=?`).run(l.serial_id);
            } else if (l.batch_id) {
              db.prepare(`UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ? WHERE id=?`).run(l.quantity, l.batch_id);
            }
          });
          db.prepare('DELETE FROM deliveries WHERE id=?').run(delivery.id);
          summary.delivery++;
        });
        // Go lien ket voi Don mua hang (chi la lien ket tham khao, khong xoa Don mua hang
        // vi hang da nhap ve la du lieu that, van con dung duoc cho don hang khac)
        db.prepare('UPDATE purchase_orders SET related_so_id=NULL WHERE related_so_id=?').run(so.id);
        // Xoa luon Hop dong (neu co) gan voi Don ban nay - tranh de sot ban ghi "mo coi" trong he thong
        const contract = db.prepare('SELECT * FROM contracts WHERE so_id=?').get(so.id);
        if (contract) { db.prepare('DELETE FROM contracts WHERE id=?').run(contract.id); summary.contract = 1; }
        db.prepare('DELETE FROM sales_orders WHERE id=?').run(so.id);
        summary.so++;
      }
      db.prepare('DELETE FROM quotations WHERE id=?').run(quotation.id);
      return summary;
    });
    const summary = tx();
    console.log(`[XOA CHUOI] ${new Date().toISOString()} - Quotation ID: ${quotation.id} (${quotation.quotation_no}), User: user#${req.session.userId}, Chi tiet: ${JSON.stringify(summary)}`);
    res.redirect('/quotations?ok=' + encodeURIComponent(
      `Đã xóa toàn bộ chuỗi liên quan tới báo giá "${quotation.quotation_no}" — gồm ${summary.so} Đơn bán, ${summary.delivery} phiếu Giao hàng (đã hoàn tác tồn kho), ${summary.invoice} Hóa đơn, ${summary.payment} Phiếu thu${summary.contract ? ', 1 Hợp đồng' : ''}.`
    ));
  } catch (e) {
    res.redirect('/quotations/' + quotation.id + '?err=' + encodeURIComponent('Không thể xóa toàn bộ chuỗi: ' + e.message));
  }
});

module.exports = router;
