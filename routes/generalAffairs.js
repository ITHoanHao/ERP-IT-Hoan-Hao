const express = require('express');
const dayjs = require('dayjs');
const db = require('../db');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

function genCode(table, column, prefix) {
  const row = db.prepare(`SELECT ${column} as c FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  let seq = 1;
  if (row && row.c) {
    const m = row.c.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return prefix + String(seq).padStart(5, '0');
}

function getAttrList(type) {
  return db.prepare('SELECT value FROM product_attributes WHERE attr_type=? ORDER BY value').all(type).map(r => r.value);
}

// Tinh khau hao duong thang: gia tri con lai = nguyen gia - khau hao luy ke
function computeDepreciation(asset) {
  if (!asset.purchase_date || !asset.purchase_cost || !asset.useful_life_months) {
    return { monthlyDepreciation: 0, accumulatedDepreciation: 0, bookValue: asset.purchase_cost || 0, monthsElapsed: 0, isFullyDepreciated: false };
  }
  const monthlyDepreciation = asset.purchase_cost / asset.useful_life_months;
  const monthsElapsed = Math.max(0, dayjs().diff(dayjs(asset.purchase_date), 'month'));
  const cappedMonths = Math.min(monthsElapsed, asset.useful_life_months);
  const accumulatedDepreciation = Math.round(monthlyDepreciation * cappedMonths);
  const bookValue = Math.max(0, Math.round(asset.purchase_cost - accumulatedDepreciation));
  return { monthlyDepreciation, accumulatedDepreciation, bookValue, monthsElapsed: cappedMonths, isFullyDepreciated: monthsElapsed >= asset.useful_life_months };
}

// ================= TONG QUAN =================
router.get('/', (req, res) => {
  const employeeCount = db.prepare(`SELECT COUNT(*) as c FROM hr_employees WHERE status='active'`).get().c;
  const assetCount = db.prepare(`SELECT COUNT(*) as c FROM hr_assets WHERE status != 'disposed'`).get().c;
  const assets = db.prepare(`SELECT * FROM hr_assets WHERE status != 'disposed'`).all();
  const totalBookValue = assets.reduce((s, a) => s + computeDepreciation(a).bookValue, 0);
  const totalPurchaseCost = assets.reduce((s, a) => s + a.purchase_cost, 0);
  res.render('generalAffairs/dashboard', { title: 'Tổng vụ', employeeCount, assetCount, totalBookValue, totalPurchaseCost });
});

// ================= NHAN VIEN =================
router.get('/employees', (req, res) => {
  const rows = db.prepare('SELECT * FROM hr_employees ORDER BY status ASC, id DESC').all();
  res.render('generalAffairs/employees/list', { title: 'Danh sách nhân viên', rows });
});

router.get('/employees/new', (req, res) => {
  res.render('generalAffairs/employees/form', {
    title: 'Thêm nhân viên', row: {}, code: genCode('hr_employees', 'employee_code', 'NV'),
    positions: getAttrList('position'), branches: getAttrList('branch'), banks: getAttrList('bank'),
  });
});

router.get('/employees/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM hr_employees WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/tongvu/employees');
  res.render('generalAffairs/employees/form', {
    title: 'Sửa: ' + row.full_name, row, code: row.employee_code,
    positions: getAttrList('position'), branches: getAttrList('branch'), banks: getAttrList('bank'),
  });
});

router.get('/employees/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM hr_employees WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/tongvu/employees');
  const assets = db.prepare('SELECT * FROM hr_assets WHERE current_user_id=?').all(row.id);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='employee' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('generalAffairs/employees/detail', { title: row.full_name, row, assets, attachments });
});

router.post('/employees', (req, res) => {
  const b = req.body;
  const info = db.prepare(
    `INSERT INTO hr_employees (employee_code, full_name, dob, gender, id_number, address, phone, email, education_level, position, branch, start_date, end_date, contract_type, base_salary, bank_name, bank_branch, bank_account_number, bank_account_holder, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(genCode('hr_employees', 'employee_code', 'NV'), b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.address || null,
    b.phone || null, b.email || null, b.education_level || null, b.position || null, b.branch || null, b.start_date || null, b.end_date || null,
    b.contract_type || null, parseFloat(b.base_salary) || 0, b.bank_name || null, b.bank_branch || null, b.bank_account_number || null,
    b.bank_account_holder || null, b.status || 'active', b.note || null);
  res.redirect('/tongvu/employees/' + info.lastInsertRowid);
});

router.post('/employees/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE hr_employees SET full_name=?, dob=?, gender=?, id_number=?, address=?, phone=?, email=?, education_level=?, position=?, branch=?, start_date=?, end_date=?, contract_type=?, base_salary=?, bank_name=?, bank_branch=?, bank_account_number=?, bank_account_holder=?, status=?, note=?
     WHERE id=?`
  ).run(b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.address || null, b.phone || null, b.email || null,
    b.education_level || null, b.position || null, b.branch || null, b.start_date || null, b.end_date || null, b.contract_type || null,
    parseFloat(b.base_salary) || 0, b.bank_name || null, b.bank_branch || null, b.bank_account_number || null, b.bank_account_holder || null,
    b.status || 'active', b.note || null, req.params.id);
  res.redirect('/tongvu/employees/' + req.params.id);
});

router.post('/employees/:id/reveal-salary', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.status(403).json({ error: 'Sai mật khẩu quản trị viên.' });
  }
  const row = db.prepare('SELECT base_salary FROM hr_employees WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
  res.json({ base_salary: row.base_salary });
});

router.post('/employees/:id/delete', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect('/tongvu/employees?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  try {
    db.prepare('DELETE FROM hr_employees WHERE id=?').run(req.params.id);
    console.log(`[XOA] ${new Date().toISOString()} - Bang: hr_employees, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
    res.redirect('/tongvu/employees?ok=' + encodeURIComponent('Đã xóa nhân viên.'));
  } catch (e) {
    let msg = 'Không thể xóa: ' + e.message;
    if (/FOREIGN KEY/i.test(e.message)) msg = 'Không thể xóa vì nhân viên này đang được gán tài sản — hãy gỡ tài sản trước.';
    res.redirect('/tongvu/employees/' + req.params.id + '?err=' + encodeURIComponent(msg));
  }
});

// ================= TAI SAN =================
router.get('/assets', (req, res) => {
  const rows = db.prepare(
    `SELECT a.*, e.full_name as user_name FROM hr_assets a LEFT JOIN hr_employees e ON e.id = a.current_user_id ORDER BY a.id DESC`
  ).all();
  rows.forEach(a => { a.dep = computeDepreciation(a); });
  res.render('generalAffairs/assets/list', { title: 'Danh sách tài sản', rows });
});

router.get('/assets/new', (req, res) => {
  const employees = db.prepare(`SELECT * FROM hr_employees WHERE status='active' ORDER BY full_name`).all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('generalAffairs/assets/form', { title: 'Thêm tài sản', row: {}, code: genCode('hr_assets', 'asset_code', 'TS'), employees, suppliers });
});

router.get('/assets/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM hr_assets WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/tongvu/assets');
  const employees = db.prepare(`SELECT * FROM hr_employees WHERE status='active' ORDER BY full_name`).all();
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('generalAffairs/assets/form', { title: 'Sửa: ' + row.asset_name, row, code: row.asset_code, employees, suppliers });
});

router.get('/assets/:id', (req, res) => {
  const row = db.prepare(
    `SELECT a.*, e.full_name as user_name, s.name as supplier_name FROM hr_assets a
     LEFT JOIN hr_employees e ON e.id = a.current_user_id LEFT JOIN suppliers s ON s.id = a.supplier_id WHERE a.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/tongvu/assets');
  const dep = computeDepreciation(row);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='asset' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('generalAffairs/assets/detail', { title: row.asset_name, row, dep, attachments });
});

router.post('/assets', (req, res) => {
  const b = req.body;
  const info = db.prepare(
    `INSERT INTO hr_assets (asset_code, asset_name, category, quantity, serial_no, supplier_id, purchase_date, purchase_invoice_no, purchase_cost, useful_life_months, warranty_until, current_user_id, location, assigned_date, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(genCode('hr_assets', 'asset_code', 'TS'), b.asset_name, b.category || null, parseFloat(b.quantity) || 1, b.serial_no || null,
    b.supplier_id || null, b.purchase_date || null, b.purchase_invoice_no || null, parseFloat(b.purchase_cost) || 0,
    parseInt(b.useful_life_months) || 36, b.warranty_until || null, b.current_user_id || null, b.location || null,
    b.assigned_date || null, b.status || 'in_use', b.note || null);
  res.redirect('/tongvu/assets/' + info.lastInsertRowid);
});

router.post('/assets/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE hr_assets SET asset_name=?, category=?, quantity=?, serial_no=?, supplier_id=?, purchase_date=?, purchase_invoice_no=?, purchase_cost=?, useful_life_months=?, warranty_until=?, current_user_id=?, location=?, assigned_date=?, status=?, note=?
     WHERE id=?`
  ).run(b.asset_name, b.category || null, parseFloat(b.quantity) || 1, b.serial_no || null, b.supplier_id || null,
    b.purchase_date || null, b.purchase_invoice_no || null, parseFloat(b.purchase_cost) || 0, parseInt(b.useful_life_months) || 36,
    b.warranty_until || null, b.current_user_id || null, b.location || null, b.assigned_date || null, b.status || 'in_use',
    b.note || null, req.params.id);
  res.redirect('/tongvu/assets/' + req.params.id);
});

router.post('/assets/:id/delete', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect('/tongvu/assets?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  db.prepare('DELETE FROM hr_assets WHERE id=?').run(req.params.id);
  console.log(`[XOA] ${new Date().toISOString()} - Bang: hr_assets, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
  res.redirect('/tongvu/assets?ok=' + encodeURIComponent('Đã xóa tài sản.'));
});

module.exports = router;
