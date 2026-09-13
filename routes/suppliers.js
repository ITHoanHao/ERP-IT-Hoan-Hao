const express = require('express');
const db = require('../db');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(`SELECT * FROM suppliers WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC`).all(`%${q}%`, `%${q}%`);
  res.render('suppliers/list', { title: 'Nhà cung cấp', rows, q });
});

router.get('/new', (req, res) => {
  res.render('suppliers/form', { title: 'Thêm nhà cung cấp', row: {} });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/suppliers');
  res.render('suppliers/form', { title: 'Sửa nhà cung cấp', row });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/suppliers');
  const orders = db.prepare('SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY id DESC').all(req.params.id);
  res.render('suppliers/detail', { title: row.name, row, orders });
});

router.post('/', (req, res) => {
  const b = req.body;
  db.prepare(
    `INSERT INTO suppliers (name, tax_code, address, phone, contact_person, email, is_credit_allowed, credit_limit, credit_term_days, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(b.name, b.tax_code || null, b.address, b.phone, b.contact_person, b.email, b.is_credit_allowed ? 1 : 0, b.credit_limit || 0, b.credit_term_days || 15);
  res.redirect('/suppliers');
});

// Them nhanh nha cung cap (dung cho modal quick-add trong luc tao Bao gia/San pham) - tra ve JSON thay vi redirect
router.post('/quick-add', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Vui lòng nhập tên nhà cung cấp.' });
  try {
    const info = db.prepare(
      `INSERT INTO suppliers (name, credit_term_days, is_active) VALUES (?, 15, 1)`
    ).run(name);
    res.json({ id: info.lastInsertRowid, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE suppliers SET name=?, tax_code=?, address=?, phone=?, contact_person=?, email=?, is_credit_allowed=?, credit_limit=?, credit_term_days=?, is_active=?
     WHERE id=?`
  ).run(b.name, b.tax_code || null, b.address, b.phone, b.contact_person, b.email, b.is_credit_allowed ? 1 : 0, b.credit_limit || 0, b.credit_term_days || 15, b.is_active ? 1 : 0, req.params.id);
  res.redirect('/suppliers');
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'suppliers', id: req.params.id, backUrl: '/suppliers', label: 'nhà cung cấp' });
});

module.exports = router;
