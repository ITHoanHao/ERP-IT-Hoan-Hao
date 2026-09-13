const express = require('express');
const db = require('../db');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return s;
}

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC`
  ).all(`%${q}%`, `%${q}%`);
  res.render('customers/list', { title: 'Khách hàng', rows, q });
});

router.get('/new', (req, res) => {
  res.render('customers/form', { title: 'Thêm khách hàng', row: {}, settings: getSettings() });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/customers');
  res.render('customers/form', { title: 'Sửa khách hàng', row, settings: getSettings() });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/customers');
  const quotations = db.prepare('SELECT * FROM quotations WHERE customer_id = ? ORDER BY id DESC').all(req.params.id);
  const orders = db.prepare('SELECT * FROM sales_orders WHERE customer_id = ? ORDER BY id DESC').all(req.params.id);
  const invoices = db.prepare(
    `SELECT i.* FROM invoices i JOIN sales_orders so ON so.id = i.so_id WHERE so.customer_id = ? ORDER BY i.id DESC`
  ).all(req.params.id);
  const contacts = db.prepare('SELECT * FROM customer_contacts WHERE customer_id=? AND is_active=1 ORDER BY recipient_type, id').all(req.params.id);
  res.render('customers/detail', { title: row.name, row, quotations, orders, invoices, contacts });
});

router.post('/:id/contacts', (req, res) => {
  const b = req.body;
  db.prepare('INSERT INTO customer_contacts (customer_id, email, label, recipient_type) VALUES (?,?,?,?)')
    .run(req.params.id, b.email, b.label || null, b.recipient_type === 'cc' ? 'cc' : 'to');
  res.redirect('/customers/' + req.params.id);
});

router.post('/:id/contacts/:contactId/delete', (req, res) => {
  db.prepare('UPDATE customer_contacts SET is_active=0 WHERE id=? AND customer_id=?').run(req.params.contactId, req.params.id);
  res.redirect('/customers/' + req.params.id);
});

router.post('/', (req, res) => {
  const b = req.body;
  db.prepare(
    `INSERT INTO customers (name, customer_type, tax_code, address, phone, contact_person, email, credit_limit, credit_term_days, representative_name, representative_position, bank_account, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(b.name, b.customer_type, b.tax_code || null, b.address, b.phone, b.contact_person, b.email, b.credit_limit || 0, b.credit_term_days || 15, b.representative_name || null, b.representative_position || null, b.bank_account || null);
  res.redirect('/customers');
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE customers SET name=?, customer_type=?, tax_code=?, address=?, phone=?, contact_person=?, email=?, credit_limit=?, credit_term_days=?, representative_name=?, representative_position=?, bank_account=?, is_active=?
     WHERE id=?`
  ).run(b.name, b.customer_type, b.tax_code || null, b.address, b.phone, b.contact_person, b.email, b.credit_limit || 0, b.credit_term_days || 15, b.representative_name || null, b.representative_position || null, b.bank_account || null, b.is_active ? 1 : 0, req.params.id);
  res.redirect('/customers');
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'customers', id: req.params.id, backUrl: '/customers', label: 'khách hàng' });
});

module.exports = router;
