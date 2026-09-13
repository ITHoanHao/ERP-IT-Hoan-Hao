const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query.q || '';
  let customers = [], products = [];
  if (q.trim()) {
    customers = db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ?`).all(`%${q}%`, `%${q}%`);
    products = db.prepare(`SELECT * FROM products WHERE name LIKE ? OR sku LIKE ?`).all(`%${q}%`, `%${q}%`);
  }
  res.render('search/results', { title: 'Tra cứu', q, customers, products });
});

module.exports = router;
