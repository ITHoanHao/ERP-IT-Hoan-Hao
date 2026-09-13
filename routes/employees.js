const express = require('express');
const db = require('../db');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

function genEmployeeCode(db) {
  const row = db.prepare(`SELECT employee_code FROM employees ORDER BY id DESC LIMIT 1`).get();
  let seq = 1;
  if (row && row.employee_code) {
    const m = row.employee_code.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return 'NV' + String(seq).padStart(4, '0');
}

router.get('/', (req, res) => {
  const employees = db.prepare('SELECT * FROM employees ORDER BY status ASC, id DESC').all();
  res.render('employees/list', { title: 'Nhân sự', employees });
});

router.get('/new', (req, res) => {
  res.render('employees/form', { title: 'Thêm nhân viên', row: {}, code: genEmployeeCode(db) });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/employees');
  res.render('employees/form', { title: 'Sửa: ' + row.full_name, row, code: row.employee_code });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM employees WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/employees');
  const assets = db.prepare('SELECT * FROM assets WHERE employee_id=? ORDER BY id DESC').all(row.id);
  row.base_salary = null; // khong gui luong that ve HTML ban dau, chi hien sau khi xac thuc dung mat khau
  res.render('employees/detail', { title: row.full_name, row, assets });
});

router.post('/', (req, res) => {
  const b = req.body;
  db.prepare(
    `INSERT INTO employees (employee_code, full_name, dob, gender, id_number, address, phone, email, position, department, start_date, end_date, contract_type, base_salary, bank_account, status, note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(b.employee_code, b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.address || null, b.phone || null, b.email || null,
    b.position || null, b.department || null, b.start_date || null, b.end_date || null, b.contract_type || null, parseFloat(b.base_salary) || 0,
    b.bank_account || null, b.status || 'active', b.note || null);
  res.redirect('/employees');
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE employees SET full_name=?, dob=?, gender=?, id_number=?, address=?, phone=?, email=?, position=?, department=?, start_date=?, end_date=?, contract_type=?, base_salary=?, bank_account=?, status=?, note=?
     WHERE id=?`
  ).run(b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.address || null, b.phone || null, b.email || null,
    b.position || null, b.department || null, b.start_date || null, b.end_date || null, b.contract_type || null, parseFloat(b.base_salary) || 0,
    b.bank_account || null, b.status || 'active', b.note || null, req.params.id);
  res.redirect('/employees/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/employees?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  try {
    db.prepare('DELETE FROM employees WHERE id=?').run(req.params.id);
    res.redirect('/employees?ok=' + encodeURIComponent('Đã xóa nhân viên thành công.'));
  } catch (e) {
    let msg = 'Không thể xóa: ' + e.message;
    if (/FOREIGN KEY/i.test(e.message)) msg = 'Không thể xóa vì nhân viên này đang được gán tài sản — hãy gỡ tài sản trước.';
    res.redirect('/employees/' + req.params.id + '?err=' + encodeURIComponent(msg));
  }
});

// Xac thuc mat khau de xem luong that (giong co che Dashboard)
router.post('/:id/reveal-salary', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.status(403).json({ error: 'Sai mật khẩu quản trị viên.' });
  }
  const row = db.prepare('SELECT base_salary FROM employees WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy nhân viên.' });
  res.json({ base_salary: row.base_salary });
});

module.exports = router;
