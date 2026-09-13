const express = require('express');
const db = require('../db');
const { calcDepreciation } = require('../lib/depreciation');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

function genAssetCode(db) {
  const row = db.prepare(`SELECT asset_code FROM assets ORDER BY id DESC LIMIT 1`).get();
  let seq = 1;
  if (row && row.asset_code) {
    const m = row.asset_code.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return 'TS' + String(seq).padStart(4, '0');
}

const CATEGORIES = ['Laptop', 'Máy tính bàn', 'Màn hình', 'Máy in', 'Thiết bị mạng', 'Điện thoại', 'Bàn ghế nội thất', 'Điều hòa', 'Xe cộ', 'Phần mềm bản quyền nội bộ', 'Khác'];
const STATUS_LABELS = { in_use: ['Đang sử dụng', 'success'], broken: ['Hỏng - chờ sửa', 'warning'], disposed: ['Đã thanh lý', 'secondary'], in_stock: ['Trong kho', 'info'], lost: ['Thất lạc', 'danger'] };

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT a.*, e.full_name as employee_name, s.name as supplier_name FROM assets a
     LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN suppliers s ON s.id = a.supplier_id
     ORDER BY a.id DESC`
  ).all();
  rows.forEach(a => {
    a.dep = calcDepreciation(a.purchase_cost, a.purchase_date, a.depreciation_months);
  });
  const totalCost = rows.reduce((s, a) => s + (a.purchase_cost || 0), 0);
  const totalRemaining = rows.reduce((s, a) => s + a.dep.remainingValue, 0);
  res.render('assets/list', { title: 'Tài sản', rows, STATUS_LABELS, totalCost, totalRemaining });
});

router.get('/new', (req, res) => {
  const employees = db.prepare(`SELECT * FROM employees WHERE status='active' ORDER BY full_name`).all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('assets/form', { title: 'Thêm tài sản', row: {}, code: genAssetCode(db), employees, suppliers, CATEGORIES });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM assets WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/assets');
  const employees = db.prepare(`SELECT * FROM employees WHERE status='active' ORDER BY full_name`).all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('assets/form', { title: 'Sửa: ' + row.asset_name, row, code: row.asset_code, employees, suppliers, CATEGORIES });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT a.*, e.full_name as employee_name, s.name as supplier_name FROM assets a
     LEFT JOIN employees e ON e.id = a.employee_id LEFT JOIN suppliers s ON s.id = a.supplier_id WHERE a.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/assets');
  row.dep = calcDepreciation(row.purchase_cost, row.purchase_date, row.depreciation_months);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='asset' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('assets/detail', { title: row.asset_name, row, attachments, STATUS_LABELS });
});

router.post('/', (req, res) => {
  const b = req.body;
  db.prepare(
    `INSERT INTO assets (asset_code, asset_name, category, quantity, purchase_date, purchase_invoice_no, supplier_id, purchase_cost, depreciation_months,
       serial_number, warranty_until, employee_id, location, assigned_date, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(b.asset_code, b.asset_name, b.category || null, parseFloat(b.quantity) || 1, b.purchase_date || null, b.purchase_invoice_no || null,
    b.supplier_id || null, parseFloat(b.purchase_cost) || 0, parseInt(b.depreciation_months) || 36, b.serial_number || null, b.warranty_until || null,
    b.employee_id || null, b.location || null, b.assigned_date || null, b.status || 'in_use', b.note || null);
  res.redirect('/assets');
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE assets SET asset_name=?, category=?, quantity=?, purchase_date=?, purchase_invoice_no=?, supplier_id=?, purchase_cost=?, depreciation_months=?,
       serial_number=?, warranty_until=?, employee_id=?, location=?, assigned_date=?, status=?, note=?
     WHERE id=?`
  ).run(b.asset_name, b.category || null, parseFloat(b.quantity) || 1, b.purchase_date || null, b.purchase_invoice_no || null,
    b.supplier_id || null, parseFloat(b.purchase_cost) || 0, parseInt(b.depreciation_months) || 36, b.serial_number || null, b.warranty_until || null,
    b.employee_id || null, b.location || null, b.assigned_date || null, b.status || 'in_use', b.note || null, req.params.id);
  res.redirect('/assets/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/assets?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  db.prepare('DELETE FROM assets WHERE id=?').run(req.params.id);
  res.redirect('/assets?ok=' + encodeURIComponent('Đã xóa tài sản thành công.'));
});

module.exports = router;
