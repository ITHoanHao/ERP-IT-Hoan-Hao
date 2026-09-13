const express = require('express');
const db = require('../db');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

function genSku(db) {
  const row = db.prepare(`SELECT sku FROM products ORDER BY id DESC LIMIT 1`).get();
  let seq = 1;
  if (row && row.sku) {
    const m = row.sku.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return 'SP' + String(seq).padStart(5, '0');
}

function getAttrList(type) {
  return db.prepare('SELECT value FROM product_attributes WHERE attr_type=? ORDER BY value').all(type).map(r => r.value);
}

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(`SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY id DESC`).all(`%${q}%`, `%${q}%`);
  res.render('products/list', { title: 'Sản phẩm', rows, q });
});

router.get('/new', (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('products/form', { title: 'Thêm sản phẩm', row: {}, sku: genSku(db), suppliers,
    categories: getAttrList('category'), brands: getAttrList('brand'), units: getAttrList('unit') });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.redirect('/products');
  const hasTransaction = db.prepare(
    `SELECT (SELECT COUNT(*) FROM inventory_serials WHERE product_id=?) + (SELECT COUNT(*) FROM inventory_batches WHERE product_id=?) as c`
  ).get(req.params.id, req.params.id).c > 0;
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  res.render('products/form', { title: 'Sửa sản phẩm', row, sku: row.sku, hasTransaction, suppliers,
    categories: getAttrList('category'), brands: getAttrList('brand'), units: getAttrList('unit') });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`
  ).get(req.params.id);
  if (!row) return res.redirect('/products');
  let serials = [], batches = [];
  if (row.tracking_type === 'serial') {
    serials = db.prepare('SELECT * FROM inventory_serials WHERE product_id = ? ORDER BY id DESC').all(req.params.id);
  } else {
    batches = db.prepare('SELECT * FROM inventory_batches WHERE product_id = ? ORDER BY id DESC').all(req.params.id);
  }
  res.render('products/detail', { title: row.name, row, serials, batches });
});

router.post('/', (req, res) => {
  const b = req.body;
  const sku = b.sku || genSku(db);
  const info = db.prepare(
    `INSERT INTO products (sku, name, supplier_id, category, brand, tracking_type, unit, min_stock_level, warranty_months_default, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(sku, b.name, b.supplier_id || null, b.category || null, b.brand || null, b.tracking_type, b.unit, b.min_stock_level || 0, b.warranty_months_default || 0);

  if (req.xhr || req.get('Accept') === 'application/json') {
    return res.json({ id: info.lastInsertRowid, name: b.name, sku });
  }
  res.redirect('/products');
});

router.post('/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE products SET name=?, supplier_id=?, category=?, brand=?, unit=?, min_stock_level=?, warranty_months_default=?, is_active=?
     WHERE id=?`
  ).run(b.name, b.supplier_id || null, b.category, b.brand, b.unit, b.min_stock_level || 0, b.warranty_months_default || 0, b.is_active ? 1 : 0, req.params.id);
  res.redirect('/products');
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'products', id: req.params.id, backUrl: '/products', label: 'sản phẩm' });
});

module.exports = router;
