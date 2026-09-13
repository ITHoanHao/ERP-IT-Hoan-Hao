const express = require('express');
const db = require('../db');
const dayjs = require('dayjs');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('reports/index', { title: 'Báo cáo' });
});

// Doanh thu & Loi nhuan theo thang (12 thang gan nhat)
router.get('/revenue-profit', (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', invoice_date) as ym,
           SUM(total_amount) as revenue,
           SUM(cogs_amount) as cogs,
           SUM(profit_amount) as profit
    FROM invoices
    GROUP BY ym ORDER BY ym DESC LIMIT 12
  `).all();
  const expenseRows = db.prepare(`
    SELECT strftime('%Y-%m', expense_date) as ym, SUM(amount) as total FROM expenses GROUP BY ym
  `).all();
  const expenseMap = {};
  expenseRows.forEach(e => expenseMap[e.ym] = e.total);
  rows.forEach(r => { r.expense = expenseMap[r.ym] || 0; r.netProfit = r.profit - r.expense; });
  res.render('reports/revenueProfit', { title: 'Doanh thu & Lợi nhuận', rows });
});

// Cong no
router.get('/debt', (req, res) => {
  const receivable = db.prepare(`
    SELECT i.invoice_no, i.invoice_date, i.total_amount, c.name as customer_name, c.credit_term_days,
           date(i.invoice_date, '+' || c.credit_term_days || ' days') as due_date
    FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id
    WHERE i.payment_status='unpaid' ORDER BY due_date ASC
  `).all();
  const today = dayjs().format('YYYY-MM-DD');
  receivable.forEach(r => { r.overdue = r.due_date < today; });
  const totalReceivable = receivable.reduce((s, r) => s + r.total_amount, 0);
  res.render('reports/debt', { title: 'Công nợ', receivable, totalReceivable, today });
});

// Ton kho
router.get('/inventory', (req, res) => {
  const serials = db.prepare(`
    SELECT p.name as product_name, COUNT(*) as c
    FROM inventory_serials s JOIN products p ON p.id=s.product_id
    WHERE s.status='in_stock' GROUP BY p.id
  `).all();
  const batches = db.prepare(`
    SELECT p.name as product_name, ib.batch_no, ib.quantity_remaining, ib.unit_cost, (ib.quantity_remaining * ib.unit_cost) as value
    FROM inventory_batches ib JOIN products p ON p.id=ib.product_id
    WHERE ib.quantity_remaining > 0
  `).all();
  const totalValue = batches.reduce((s, b) => s + b.value, 0) +
    db.prepare(`SELECT COALESCE(SUM(purchase_cost),0) as v FROM inventory_serials WHERE status='in_stock'`).get().v;
  res.render('reports/inventory', { title: 'Tồn kho', serials, batches, totalValue });
});

// Loi nhuan theo don hang
router.get('/profit-by-order', (req, res) => {
  const rows = db.prepare(`
    SELECT i.invoice_no, i.invoice_date, c.name as customer_name, i.total_amount, i.cogs_amount, i.profit_amount
    FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id
    ORDER BY i.id DESC
  `).all();
  res.render('reports/profitByOrder', { title: 'Lợi nhuận theo đơn hàng', rows });
});

module.exports = router;
