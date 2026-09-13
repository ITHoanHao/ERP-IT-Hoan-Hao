const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { getWizardState, getActiveWizardOrders } = require('../lib/wizardState');
const router = express.Router();

// Trang danh sach cac don dang xu ly do + nut bat dau don moi
router.get('/', (req, res) => {
  const orders = getActiveWizardOrders(db);
  res.render('wizard/index', { title: 'Tạo đơn hàng', orders });
});

// Buoc 1: chon khach hang de bat dau 1 don moi
router.get('/new', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  res.render('wizard/new', { title: 'Bắt đầu đơn hàng mới', customers });
});

router.post('/new', (req, res) => {
  const b = req.body;
  if (!b.customer_id) return res.redirect('/wizard/new?err=' + encodeURIComponent('Vui lòng chọn khách hàng.'));
  const qno = genNumber(db, 'QT', 'quotations', 'quotation_no');
  const info = db.prepare(
    `INSERT INTO quotations (quotation_no, customer_id, quotation_date, status, valid_until, short_title, note) VALUES (?,?,date('now'),'draft',?,?,?)`
  ).run(qno, b.customer_id, b.valid_until || null, b.short_title || null, b.note || '');
  res.redirect(`/quotations/${info.lastInsertRowid}/edit?wizard=${info.lastInsertRowid}`);
});

// Man hinh stepper chinh cho 1 don hang
router.get('/:quotationId', (req, res) => {
  const state = getWizardState(db, req.params.quotationId);
  if (!state) return res.redirect('/wizard');
  res.render('wizard/show', { title: 'Đơn hàng ' + state.quotation.quotation_no, state });
});

module.exports = router;
