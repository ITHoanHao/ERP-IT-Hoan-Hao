const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

const CONTRACT_THRESHOLD = 20000000;

function getSettings() {
  return db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
}

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, cu.name as customer_name, so.so_no, so.total_amount
     FROM contracts c JOIN customers cu ON cu.id = c.customer_id JOIN sales_orders so ON so.id = c.so_id
     ORDER BY c.id DESC`
  ).all();
  res.render('contracts/list', { title: 'Hợp đồng', rows });
});

router.get('/new', (req, res) => {
  const soId = req.query.so_id;
  const so = db.prepare(
    `SELECT so.*, c.* , so.id as so_id, c.id as customer_id FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id=?`
  ).get(soId);
  if (!so) return res.redirect('/sales-orders');
  // Chan tao hop dong neu SO da co hop dong roi
  const existing = db.prepare('SELECT id FROM contracts WHERE so_id=?').get(soId);
  if (existing) return res.redirect('/contracts/' + existing.id);

  const settings = getSettings();
  res.render('contracts/form', {
    title: 'Tạo hợp đồng từ ' + so.so_no,
    so, settings, row: null,
    defaultPaymentTerms: '100% giá trị hợp đồng khi ký hợp đồng.',
  });
});

router.post('/', (req, res) => {
  const b = req.body;
  const so = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(b.so_id);
  if (!so) return res.redirect('/sales-orders');

  const tx = db.transaction(() => {
    const contractNo = genNumber(db, 'HD', 'contracts', 'contract_no');
    const info = db.prepare(
      `INSERT INTO contracts (contract_no, so_id, customer_id, contract_date, tax_rate_label, price_valid_until, warranty_months, payment_terms_text, delivery_address, delivery_phone, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,'draft')`
    ).run(contractNo, so.id, so.customer_id, b.contract_date || new Date().toISOString().slice(0, 10),
      b.tax_rate_label || '', b.price_valid_until || null, parseInt(b.warranty_months) || 12,
      b.payment_terms_text || '100% giá trị hợp đồng khi ký hợp đồng.', b.delivery_address || null, b.delivery_phone || null);

    // Luu lai thong tin dai dien/tai khoan ngan hang cua khach hang de dung lai lan sau
    if (b.representative_name || b.representative_position || b.bank_account) {
      db.prepare(
        `UPDATE customers SET representative_name=?, representative_position=?, bank_account=? WHERE id=?`
      ).run(b.representative_name || null, b.representative_position || null, b.bank_account || null, so.customer_id);
    }
    return info.lastInsertRowid;
  });
  const id = tx();
  res.redirect('/contracts/' + id);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT c.*, so.so_no, so.total_amount as so_total FROM contracts c JOIN sales_orders so ON so.id = c.so_id WHERE c.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/contracts');
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(row.customer_id);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='contract' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('contracts/detail', { title: row.contract_no, row, customer, attachments });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/contracts');
  const so = db.prepare(
    `SELECT so.*, c.*, so.id as so_id, c.id as customer_id FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE so.id=?`
  ).get(row.so_id);
  res.render('contracts/form', { title: 'Sửa hợp đồng ' + row.contract_no, so, settings: getSettings(), row, defaultPaymentTerms: row.payment_terms_text });
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE contracts SET contract_date=?, tax_rate_label=?, price_valid_until=?, warranty_months=?, payment_terms_text=?, delivery_address=?, delivery_phone=? WHERE id=?`
  ).run(b.contract_date || null, b.tax_rate_label || '', b.price_valid_until || null, parseInt(b.warranty_months) || 12,
    b.payment_terms_text || '', b.delivery_address || null, b.delivery_phone || null, req.params.id);

  const contract = db.prepare('SELECT customer_id FROM contracts WHERE id=?').get(req.params.id);
  if (b.representative_name || b.representative_position || b.bank_account) {
    db.prepare(`UPDATE customers SET representative_name=?, representative_position=?, bank_account=? WHERE id=?`)
      .run(b.representative_name || null, b.representative_position || null, b.bank_account || null, contract.customer_id);
  }
  res.redirect('/contracts/' + req.params.id);
});

router.post('/:id/sign', (req, res) => {
  db.prepare(`UPDATE contracts SET status='signed' WHERE id=?`).run(req.params.id);
  res.redirect('/contracts/' + req.params.id);
});

router.post('/:id/cancel', (req, res) => {
  db.prepare(`UPDATE contracts SET status='cancelled' WHERE id=?`).run(req.params.id);
  res.redirect('/contracts/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/contracts?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  try {
    db.prepare('DELETE FROM contracts WHERE id=?').run(req.params.id);
    console.log(`[XOA] ${new Date().toISOString()} - Bang: contracts, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
    res.redirect('/contracts?ok=' + encodeURIComponent('Đã xóa hợp đồng thành công.'));
  } catch (e) {
    res.redirect('/contracts/' + req.params.id + '?err=' + encodeURIComponent('Không thể xóa: ' + e.message));
  }
});

router.get('/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT * FROM contracts WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/contracts');
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(row.customer_id);
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id = sol.product_id WHERE sol.so_id=?`
  ).all(row.so_id);
  // Mau hop dong moi hien gia DA GOM VAT truc tiep - lam tron TUNG DONG dung nhu hoa don, tranh lech do lam tron
  lines.forEach(l => {
    const vatOfLine = Math.round(l.line_amount * (l.tax_rate_percent || 0) / 100);
    l.line_amount_incl_vat = l.line_amount + vatOfLine;
    l.unit_price_incl_vat = l.quantity ? l.line_amount_incl_vat / l.quantity : l.line_amount_incl_vat;
  });
  const settings = getSettings();
  const { generateContractPdf } = require('../lib/contractPdf');
  generateContractPdf(res, row, lines, customer, settings);
});

module.exports = router;
module.exports.CONTRACT_THRESHOLD = CONTRACT_THRESHOLD;
