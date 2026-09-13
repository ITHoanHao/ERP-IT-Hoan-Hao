const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { handleDelete, verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

const TAX_OPTIONS = ['Không chịu thuế', '0%', '5%', '8%', '10%', 'Không kê khai, tính nộp thuế GTGT', 'Không phải kê khai thuế GTGT'];
const DELIVERY_STATUS_OPTIONS = ['Chờ xác nhận', 'Chờ nhập hàng', 'Đang chuẩn bị hàng', 'Đã xuất kho', 'Đang giao hàng', 'Giao một phần', 'Đã nhận hàng', 'Đã nghiệm thu', 'Hoàn tất', 'Hoàn hàng', 'Hủy'];

// Quy doi nhan thue sang % so de tinh VAT; cac muc "khong chiu thue/khong ke khai..." tinh la 0%
function taxLabelToPercent(label) {
  const m = String(label || '').match(/(\d+)\s*%/);
  return m ? parseFloat(m[1]) : 0;
}

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT po.*, s.name as supplier_name,
       (SELECT GROUP_CONCAT(p.name, ', ')
        FROM purchase_order_lines pol JOIN products p ON p.id = pol.product_id
        WHERE pol.po_id = po.id) as items_preview
     FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id
     WHERE (? = '' OR po.po_no LIKE ? OR s.name LIKE ?
       OR EXISTS (SELECT 1 FROM purchase_order_lines pol2 JOIN products p2 ON p2.id=pol2.product_id
                  WHERE pol2.po_id=po.id AND p2.name LIKE ?))
     ORDER BY po.id DESC`
  ).all(q, `%${q}%`, `%${q}%`, `%${q}%`);
  rows.forEach(r => {
    if (r.items_preview && r.items_preview.length > 70) r.items_preview = r.items_preview.slice(0, 70) + '...';
  });
  res.render('purchaseOrders/list', { title: 'Đơn mua', rows, q });
});

router.get('/new', (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active=1 ORDER BY name').all();
  const products = db.prepare('SELECT * FROM products WHERE is_active=1 ORDER BY name').all();
  const soId = req.query.so_id || null;
  let soLines = [];
  if (soId) {
    soLines = db.prepare(
      `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=? AND sol.product_id IS NOT NULL`
    ).all(soId);
  }
  res.render('purchaseOrders/form', { title: 'Tạo đơn mua hàng', suppliers, products, soId, soLines, TAX_OPTIONS, DELIVERY_STATUS_OPTIONS, wizard: req.query.wizard || null });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?').get(req.params.id);
  if (!row) return res.redirect('/purchase-orders');
  const lines = db.prepare(
    `SELECT pol.*, p.name as product_name, p.tracking_type FROM purchase_order_lines pol JOIN products p ON p.id=pol.product_id WHERE pol.po_id=?`
  ).all(row.id);
  const receipts = db.prepare('SELECT * FROM goods_receipts WHERE po_id=? ORDER BY id DESC').all(row.id);
  const payment = db.prepare(`SELECT * FROM payments WHERE source_doc_type='purchase_order' AND source_doc_id=?`).get(row.id);
  res.render('purchaseOrders/detail', { title: row.po_no, row, lines, receipts, payment, DELIVERY_STATUS_OPTIONS });
});

router.post('/', (req, res) => {
  const b = req.body;
  const products = Array.isArray(b.line_product) ? b.line_product : [b.line_product];
  const qtys = Array.isArray(b.line_qty) ? b.line_qty : [b.line_qty];
  const prices = Array.isArray(b.line_price) ? b.line_price : [b.line_price];
  const taxLabels = Array.isArray(b.line_tax) ? b.line_tax : [b.line_tax];

  const tx = db.transaction(() => {
    const poNo = genNumber(db, 'PO', 'purchase_orders', 'po_no');
    let subtotal = 0, vat = 0;
    const lineData = [];
    for (let i = 0; i < products.length; i++) {
      const qty = parseFloat(qtys[i]) || 0;
      const price = parseFloat(prices[i]) || 0;
      const taxLabel = taxLabels[i] || '8%';
      if (!products[i] || qty <= 0) continue;
      const amountPrecise = qty * price;
      const amountRounded = Math.round(amountPrecise);
      subtotal += amountRounded;
      vat += Math.round(amountPrecise * taxLabelToPercent(taxLabel) / 100); // lam tron VAT tung dong truoc khi cong lai
      lineData.push({ product_id: products[i], qty, price, taxLabel, amount: amountRounded });
    }
    const total = subtotal + vat;
    const info = db.prepare(
      `INSERT INTO purchase_orders (po_no, supplier_id, related_so_id, order_date, expected_date, status, delivery_status_note, subtotal_amount, vat_amount, total_amount)
       VALUES (?,?,?,date('now'),?,'ordered',?,?,?,?)`
    ).run(poNo, b.supplier_id, b.so_id || null, b.expected_date || null, b.delivery_status_note || 'Chờ xác nhận', subtotal, vat, total);
    const insertLine = db.prepare(
      `INSERT INTO purchase_order_lines (po_id, product_id, quantity_ordered, unit_price_expected, tax_rate_label, line_amount) VALUES (?,?,?,?,?,?)`
    );
    lineData.forEach(l => insertLine.run(info.lastInsertRowid, l.product_id, l.qty, l.price, l.taxLabel, l.amount));
    return info.lastInsertRowid;
  });
  const id = tx();
  if (req.body.wizard) return res.redirect('/wizard/' + req.body.wizard);
  res.redirect('/purchase-orders/' + id);
});

router.post('/:id/cancel', (req, res) => {
  const row = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!row || row.status !== 'ordered') return res.redirect('/purchase-orders/' + req.params.id);
  db.prepare(`UPDATE purchase_orders SET status='cancelled', cancel_reason=? WHERE id=?`).run(req.body.reason || '', row.id);
  res.redirect('/purchase-orders/' + row.id);
});

// Cap nhat trang thai theo doi giao hang (chi mang tinh mo ta, khong anh huong logic he thong)
router.post('/:id/delivery-status', (req, res) => {
  db.prepare(`UPDATE purchase_orders SET delivery_status_note=? WHERE id=?`).run(req.body.delivery_status_note, req.params.id);
  res.redirect('/purchase-orders/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  handleDelete(req, res, { table: 'purchase_orders', id: req.params.id, backUrl: '/purchase-orders', label: 'đơn mua hàng' });
});

// Xoa toan bo chuoi lien quan (Don mua hang + cac Phieu nhan hang + Phieu chi neu co), dung khi
// nhap sai tu dau va muon lam lai. CHI cho xoa neu hang nhap ve CHUA bi dung di dau (chua giao cho
// khach, chua chuyen trang thai khac in_stock) - neu da dung roi thi chan lai de tranh sai lech du lieu.
router.post('/:id/delete-chain', (req, res) => {
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect('/purchase-orders/' + req.params.id + '?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(req.params.id);
  if (!po) return res.redirect('/purchase-orders');

  try {
    const receipts = db.prepare('SELECT * FROM goods_receipts WHERE po_id=?').all(po.id);

    // Buoc 1: kiem tra AN TOAN truoc - hang nhan ve tu PO nay da bi dung di dau chua
    for (const gr of receipts) {
      const grLines = db.prepare('SELECT * FROM goods_receipt_lines WHERE gr_id=?').all(gr.id);
      for (const line of grLines) {
        if (line.serial_no) {
          const serial = db.prepare('SELECT * FROM inventory_serials WHERE serial_no=?').get(line.serial_no);
          if (serial && serial.status !== 'in_stock') {
            throw new Error(`Không thể xóa vì Serial "${line.serial_no}" đã chuyển trạng thái "${serial.status}" (có thể đã giao cho khách) — cần xóa/hoàn tác phiếu Giao hàng liên quan trước.`);
          }
        } else if (line.batch_no) {
          const batch = db.prepare('SELECT * FROM inventory_batches WHERE batch_no=? AND product_id=?').get(line.batch_no, line.product_id);
          if (batch && batch.quantity_remaining < line.quantity - 0.001) {
            throw new Error(`Không thể xóa vì lô hàng "${line.batch_no}" đã bị dùng bớt (chỉ còn ${batch.quantity_remaining}/${line.quantity}) — có thể đã giao cho khách hoặc dùng cho đơn khác. Cần hoàn tác việc sử dụng đó trước.`);
          }
        }
      }
    }

    // Buoc 2: an toan roi -> tien hanh xoa + hoan tac ton kho
    const summary = { receipt: 0, payment: 0 };
    const tx = db.transaction(() => {
      const payment = db.prepare(`SELECT * FROM payments WHERE source_doc_type='purchase_order' AND source_doc_id=?`).get(po.id);
      if (payment) { db.prepare('DELETE FROM payments WHERE id=?').run(payment.id); summary.payment++; }

      receipts.forEach(gr => {
        const grLines = db.prepare('SELECT * FROM goods_receipt_lines WHERE gr_id=?').all(gr.id);
        grLines.forEach(line => {
          if (line.serial_no) {
            db.prepare('DELETE FROM inventory_serials WHERE serial_no=?').run(line.serial_no);
          } else if (line.batch_no) {
            db.prepare('DELETE FROM inventory_batches WHERE batch_no=? AND product_id=?').run(line.batch_no, line.product_id);
          }
        });
        db.prepare('DELETE FROM goods_receipts WHERE id=?').run(gr.id); // cascade xoa goods_receipt_lines
        summary.receipt++;
      });

      db.prepare('DELETE FROM purchase_orders WHERE id=?').run(po.id); // cascade xoa purchase_order_lines
    });
    tx();

    console.log(`[XOA CHUOI] ${new Date().toISOString()} - PO ID: ${po.id} (${po.po_no}), User: user#${req.session.userId}, Chi tiet: ${JSON.stringify(summary)}`);
    res.redirect('/purchase-orders?ok=' + encodeURIComponent(
      `Đã xóa toàn bộ chuỗi liên quan tới đơn mua hàng "${po.po_no}" — gồm ${summary.receipt} phiếu Nhận hàng (đã hoàn tác tồn kho)${summary.payment ? ', ' + summary.payment + ' phiếu chi' : ''}.`
    ));
  } catch (e) {
    res.redirect('/purchase-orders/' + po.id + '?err=' + encodeURIComponent(e.message));
  }
});

module.exports = router;
