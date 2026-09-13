const express = require('express');
const db = require('../db');
const router = express.Router();

const VALID_TYPES = ['category', 'brand', 'unit', 'position', 'branch', 'bank'];

router.post('/', (req, res) => {
  const { attr_type, value } = req.body;
  if (!VALID_TYPES.includes(attr_type) || !value || !String(value).trim()) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  }
  const v = String(value).trim();
  try {
    db.prepare('INSERT OR IGNORE INTO product_attributes (attr_type, value) VALUES (?, ?)').run(attr_type, v);
    res.json({ value: v });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
