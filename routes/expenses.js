const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

const { DATA_DIR } = require('../lib/dataDir');
const uploadDir = path.join(DATA_DIR, 'uploads', 'expenses');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function hasAttachment(expenseId) {
  return !!db.prepare(`SELECT id FROM attachments WHERE entity_type='expense' AND entity_id=?`).get(expenseId);
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM expenses ORDER BY id DESC`).all();
  rows.forEach(r => r.hasAttachment = hasAttachment(r.id));
  res.render('expenses/list', { title: 'Chi phí', rows });
});

router.get('/new', (req, res) => {
  res.render('expenses/form', { title: 'Ghi nhận chi phí' });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/expenses');
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='expense' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('expenses/detail', { title: row.expense_no, row, attachments });
});

router.post('/', upload.single('receipt_file'), (req, res) => {
  const b = req.body;
  const tx = db.transaction(() => {
    const expNo = genNumber(db, 'EX', 'expenses', 'expense_no');
    const info = db.prepare(
      `INSERT INTO expenses (expense_no, category, expense_date, amount, description) VALUES (?,?,date('now'),?,?)`
    ).run(expNo, b.category, parseFloat(b.amount), b.description || '');
    const payNo = genNumber(db, 'PC', 'payments', 'payment_no');
    db.prepare(
      `INSERT INTO payments (payment_no, payment_type, source_doc_type, source_doc_id, amount, payment_method, fund_source, payment_date, note)
       VALUES (?,'chi','expense',?,?,?,?,date('now'),?)`
    ).run(payNo, info.lastInsertRowid, parseFloat(b.amount), b.payment_method || 'cash', b.fund_source || 'cash', 'Chi phí: ' + b.category);

    if (req.file) {
      db.prepare(`INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size) VALUES ('expense', ?, ?, ?, ?)`)
        .run(info.lastInsertRowid, req.file.originalname, req.file.filename, req.file.size);
    }
    return info.lastInsertRowid;
  });
  const id = tx();
  if (req.file) {
    res.redirect('/expenses?ok=' + encodeURIComponent('Đã ghi nhận chi phí kèm hóa đơn đính kèm.'));
  } else {
    res.redirect('/expenses?err=' + encodeURIComponent('Đã ghi nhận chi phí. Bạn CHƯA đính kèm hóa đơn — nhớ quay lại upload sau (hệ thống sẽ nhắc trên Dashboard cho đến khi bạn đính kèm).'));
  }
});

router.get('/:id/upload', (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/expenses');
  res.render('expenses/upload', { title: 'Đính kèm hóa đơn - ' + row.expense_no, row });
});

router.post('/:id/upload', upload.single('receipt_file'), (req, res) => {
  if (!req.file) return res.redirect('/expenses/' + req.params.id + '?err=' + encodeURIComponent('Vui lòng chọn file.'));
  db.prepare(`INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size) VALUES ('expense', ?, ?, ?, ?)`)
    .run(req.params.id, req.file.originalname, req.file.filename, req.file.size);
  res.redirect('/expenses/' + req.params.id + '?ok=' + encodeURIComponent('Đã đính kèm hóa đơn thành công.'));
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/expenses?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  try {
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM payments WHERE source_doc_type='expense' AND source_doc_id=?`).run(req.params.id);
      db.prepare(`DELETE FROM attachments WHERE entity_type='expense' AND entity_id=?`).run(req.params.id);
      db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
    });
    tx();
    console.log(`[XOA] ${new Date().toISOString()} - Bang: expenses, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
    res.redirect('/expenses?ok=' + encodeURIComponent('Đã xóa chi phí thành công.'));
  } catch (e) {
    res.redirect('/expenses?err=' + encodeURIComponent('Không thể xóa: ' + e.message));
  }
});

module.exports = router;
