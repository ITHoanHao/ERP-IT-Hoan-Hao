const express = require('express');
const db = require('../db');
const dayjs = require('dayjs');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const lowStock = db.prepare(
    `SELECT p.name, ib.batch_no, ib.quantity_remaining, p.min_stock_level
     FROM inventory_batches ib JOIN products p ON p.id = ib.product_id
     WHERE ib.quantity_remaining <= p.min_stock_level AND p.min_stock_level > 0`
  ).all();

  const pendingQuotations = db.prepare(
    `SELECT COUNT(*) as c FROM quotations WHERE status = 'sent'`
  ).get().c;

  const recentSO = db.prepare(
    `SELECT so.id, so.so_no, c.name as customer_name, so.total_amount, so.status, so.order_date
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     ORDER BY so.id DESC LIMIT 5`
  ).all();

  const missingReceiptExpenses = db.prepare(
    `SELECT e.* FROM expenses e
     WHERE NOT EXISTS (SELECT 1 FROM attachments a WHERE a.entity_type='expense' AND a.entity_id=e.id)
     ORDER BY e.id DESC`
  ).all();

  const in14days = dayjs().add(14, 'day').format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  const expiringLicenses = db.prepare(
    `SELECT l.*, c.name as customer_name FROM licenses l JOIN customers c ON c.id = l.customer_id
     WHERE l.status='active' AND l.requires_renewal=1 AND l.expiry_date IS NOT NULL AND l.expiry_date <= ?
     ORDER BY l.expiry_date ASC`
  ).all(in14days);
  expiringLicenses.forEach(l => { l.isOverdue = l.expiry_date < today; });

  // Doanh thu/Loi nhuan/Cong no KHONG gui ve trinh duyet o day - chi hien sau khi xac thuc dung mat khau
  res.render('dashboard', {
    title: 'Dashboard',
    lowStock, pendingQuotations, recentSO, missingReceiptExpenses, expiringLicenses,
  });
});

// Xac thuc mat khau va tra ve so lieu tai chinh that (goi qua AJAX tu Dashboard)
router.post('/reveal-financials', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.status(403).json({ error: 'Sai mật khẩu quản trị viên.' });
  }
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD');

  const revenue = db.prepare(
    `SELECT COALESCE(SUM(total_amount),0) as total FROM invoices WHERE invoice_date BETWEEN ? AND ?`
  ).get(monthStart, monthEnd).total;

  const profit = db.prepare(
    `SELECT COALESCE(SUM(profit_amount),0) as total FROM invoices WHERE invoice_date BETWEEN ? AND ?`
  ).get(monthStart, monthEnd).total;

  const debtReceivable = db.prepare(
    `SELECT COALESCE(SUM(total_amount),0) as total FROM invoices WHERE payment_status = 'unpaid'`
  ).get().total;

  res.json({ revenue, profit, debtReceivable });
});

module.exports = router;
