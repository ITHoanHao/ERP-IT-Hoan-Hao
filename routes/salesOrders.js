const express = require('express');
const db = require('../db');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT so.*, c.name as customer_name,
       (SELECT GROUP_CONCAT(COALESCE(p.name, sol.description, ''), ', ')
        FROM sales_order_lines sol LEFT JOIN products p ON p.id = sol.product_id
        WHERE sol.so_id = so.id) as items_preview
     FROM sales_orders so JOIN customers c ON c.id=so.customer_id
     WHERE (? = '' OR so.so_no LIKE ? OR c.name LIKE ?
       OR EXISTS (SELECT 1 FROM sales_order_lines sol2 LEFT JOIN products p2 ON p2.id=sol2.product_id
                  WHERE sol2.so_id=so.id AND (p2.name LIKE ? OR sol2.description LIKE ?)))
     ORDER BY so.id DESC`
  ).all(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  rows.forEach(r => {
    if (r.items_preview && r.items_preview.length > 70) r.items_preview = r.items_preview.slice(0, 70) + '...';
  });
  res.render('salesOrders/list', { title: 'Đơn bán', rows, q });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id WHERE so.id=?').get(req.params.id);
  if (!row) return res.redirect('/sales-orders');
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=?`
  ).all(row.id);
  const delivery = db.prepare('SELECT * FROM deliveries WHERE so_id=?').get(row.id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE so_id=?').get(row.id);
  const relatedPOs = db.prepare('SELECT * FROM purchase_orders WHERE related_so_id=?').all(row.id);
  const contract = db.prepare('SELECT * FROM contracts WHERE so_id=?').get(row.id);
  // Hoa hong Sales doi tac = 25% loi nhuan don hang. Loi nhuan chi biet duoc SAU KHI co Hoa don
  // (invoices.profit_amount da co san, tinh tu COGS thuc te luc giao hang) - neu chua co hoa don
  // thi chua the tinh, hien thi "chua xac dinh" thay vi hien so 0 gay hieu lam.
  const PARTNER_COMMISSION_RATE = 0.25;
  const commissionAmount = (row.has_partner_commission && invoice) ? Math.round(invoice.profit_amount * PARTNER_COMMISSION_RATE) : null;
  res.render('salesOrders/detail', { title: row.so_no, row, lines, delivery, invoice, relatedPOs, contract, CONTRACT_THRESHOLD: 20000000, commissionAmount, PARTNER_COMMISSION_RATE });
});

router.post('/:id/commission', (req, res) => {
  const row = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/sales-orders');
  const enabled = req.body.has_partner_commission ? 1 : 0;
  db.prepare('UPDATE sales_orders SET has_partner_commission=? WHERE id=?').run(enabled, row.id);
  res.redirect('/sales-orders/' + row.id);
});

router.post('/:id/cancel', (req, res) => {
  const row = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(req.params.id);
  if (!row || row.status !== 'created') return res.redirect('/sales-orders/' + req.params.id);
  db.prepare(`UPDATE sales_orders SET status='cancelled', cancel_reason=? WHERE id=?`).run(req.body.reason || '', row.id);
  res.redirect('/sales-orders/' + row.id);
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'sales_orders', id: req.params.id, backUrl: '/sales-orders', label: 'đơn bán' });
});

module.exports = router;
