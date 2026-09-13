const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const serials = db.prepare(`
    SELECT s.*, p.name as product_name, p.sku FROM inventory_serials s JOIN products p ON p.id=s.product_id
    ORDER BY s.id DESC LIMIT 200
  `).all();
  const batches = db.prepare(`
    SELECT b.*, p.name as product_name, p.sku FROM inventory_batches b JOIN products p ON p.id=b.product_id
    WHERE b.quantity_remaining > 0 ORDER BY b.id DESC
  `).all();
  res.render('inventory/index', { title: 'Kho', serials, batches });
});

module.exports = router;
