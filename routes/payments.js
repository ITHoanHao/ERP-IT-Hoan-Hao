const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM payments ORDER BY id DESC`).all();
  res.render('payments/list', { title: 'Thu / Chi', rows });
});

router.get('/new', (req, res) => {
  const invoiceId = req.query.invoice_id;
  const poId = req.query.po_id;
  let sourceDoc = null, docType = null, suggestedAmount = 0, suggestedType = 'thu';
  if (invoiceId) {
    sourceDoc = db.prepare(`SELECT i.*, c.name as customer_name FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id WHERE i.id=?`).get(invoiceId);
    docType = 'invoice'; suggestedAmount = sourceDoc.total_amount; suggestedType = 'thu';
  } else if (poId) {
    sourceDoc = db.prepare(`SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(poId);
    docType = 'purchase_order'; suggestedAmount = sourceDoc.total_amount; suggestedType = 'chi';
  }
  res.render('payments/form', { title: 'Ghi nhận thanh toán', sourceDoc, docType, suggestedAmount, suggestedType, sourceId: invoiceId || poId, wizard: req.query.wizard || null });
});

router.post('/', (req, res) => {
  const b = req.body;
  const tx = db.transaction(() => {
    const payNo = genNumber(db, b.payment_type === 'thu' ? 'PT' : 'PC', 'payments', 'payment_no');
    const info = db.prepare(
      `INSERT INTO payments (payment_no, payment_type, source_doc_type, source_doc_id, amount, payment_method, fund_source, payment_date, note)
       VALUES (?,?,?,?,?,?,?,date('now'),?)`
    ).run(payNo, b.payment_type, b.source_doc_type || null, b.source_doc_id || null, parseFloat(b.amount), b.payment_method, b.fund_source, b.note || '');

    if (b.source_doc_type === 'invoice' && b.source_doc_id) {
      db.prepare(`UPDATE invoices SET payment_status='paid' WHERE id=?`).run(b.source_doc_id);
    }
    return info.lastInsertRowid;
  });
  const id = tx();
  if (b.wizard) return res.redirect('/wizard/' + b.wizard);
  res.redirect('/payments/' + id);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/payments');
  res.render('payments/detail', { title: row.payment_no, row });
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/payments?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const payment = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE id=?').run(req.params.id);
      // Neu phieu thu nay gan voi 1 hoa don, hoan lai trang thai Chua thu vi khong con Payment nao xac nhan da thu nua
      if (payment && payment.source_doc_type === 'invoice' && payment.source_doc_id) {
        db.prepare(`UPDATE invoices SET payment_status='unpaid' WHERE id=?`).run(payment.source_doc_id);
      }
    });
    tx();
    console.log(`[XOA] ${new Date().toISOString()} - Bang: payments, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
    res.redirect('/payments?ok=' + encodeURIComponent('Đã xóa phiếu thu/chi thành công.'));
  } catch (e) {
    res.redirect('/payments?err=' + encodeURIComponent('Không thể xóa: ' + e.message));
  }
});

module.exports = router;
