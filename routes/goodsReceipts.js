const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const router = express.Router();

router.get('/new', (req, res) => {
  const poId = req.query.po_id;
  const po = db.prepare('SELECT po.*, s.name as supplier_name FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?').get(poId);
  if (!po) return res.redirect('/purchase-orders');
  const lines = db.prepare(
    `SELECT pol.*, p.name as product_name, p.tracking_type FROM purchase_order_lines pol JOIN products p ON p.id=pol.product_id WHERE pol.po_id=? AND pol.quantity_received < pol.quantity_ordered`
  ).all(poId);
  res.render('goodsReceipts/form', { title: 'Nhận hàng - ' + po.po_no, po, lines, wizard: req.query.wizard || null });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT gr.*, po.po_no, s.name as supplier_name FROM goods_receipts gr JOIN purchase_orders po ON po.id=gr.po_id JOIN suppliers s ON s.id=po.supplier_id WHERE gr.id=?').get(req.params.id);
  if (!row) return res.redirect('/purchase-orders');
  const lines = db.prepare(
    `SELECT grl.*, p.name as product_name FROM goods_receipt_lines grl JOIN products p ON p.id=grl.product_id WHERE grl.gr_id=?`
  ).all(row.id);
  res.render('goodsReceipts/detail', { title: row.gr_no, row, lines });
});

router.post('/', (req, res) => {
  const b = req.body;
  const poLineIds = Array.isArray(b.po_line_id) ? b.po_line_id : [b.po_line_id];
  const productIds = Array.isArray(b.product_id) ? b.product_id : [b.product_id];
  const trackingTypes = Array.isArray(b.tracking_type) ? b.tracking_type : [b.tracking_type];
  const serials = Array.isArray(b.serial_no) ? b.serial_no : [b.serial_no];
  const qtys = Array.isArray(b.quantity) ? b.quantity : [b.quantity];
  const costs = Array.isArray(b.unit_cost) ? b.unit_cost : [b.unit_cost];

  try {
    const tx = db.transaction(() => {
      const grNo = genNumber(db, 'GR', 'goods_receipts', 'gr_no');
      const grInfo = db.prepare(
        `INSERT INTO goods_receipts (gr_no, po_id, receipt_date, supplier_invoice_no, supplier_invoice_date, supplier_invoice_amount)
         VALUES (?,?,date('now'),?,?,?)`
      ).run(grNo, b.po_id, b.supplier_invoice_no || null, b.supplier_invoice_date || null, b.supplier_invoice_amount || null);
      const grId = grInfo.lastInsertRowid;

      const insertGRLine = db.prepare(
        `INSERT INTO goods_receipt_lines (gr_id, po_line_id, product_id, serial_no, batch_no, quantity, unit_cost) VALUES (?,?,?,?,?,?,?)`
      );
      const insertSerial = db.prepare(
        `INSERT INTO inventory_serials (product_id, serial_no, status, purchase_cost, warranty_expiry_date) VALUES (?,?,'in_stock',?,NULL)`
      );
      const insertBatch = db.prepare(
        `INSERT INTO inventory_batches (product_id, batch_no, quantity_remaining, unit_cost) VALUES (?,?,?,?)`
      );
      const updatePOLine = db.prepare(`UPDATE purchase_order_lines SET quantity_received = quantity_received + ? WHERE id=?`);

      for (let i = 0; i < poLineIds.length; i++) {
        const cost = parseFloat(costs[i]) || 0;
        if (trackingTypes[i] === 'serial') {
          const serialList = (serials[i] || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
          serialList.forEach(sn => {
            insertGRLine.run(grId, poLineIds[i], productIds[i], sn, null, 1, cost);
            insertSerial.run(productIds[i], sn, cost);
          });
          updatePOLine.run(serialList.length, poLineIds[i]);
        } else {
          const qty = parseFloat(qtys[i]) || 0;
          if (qty <= 0) continue;
          const batchNo = genNumber(db, 'LOT', 'inventory_batches', 'batch_no');
          insertGRLine.run(grId, poLineIds[i], productIds[i], null, batchNo, qty, cost);
          insertBatch.run(productIds[i], batchNo, qty, cost);
          updatePOLine.run(qty, poLineIds[i]);
        }
      }

      // Cap nhat trang thai PO: completed neu tat ca da nhan du, nguoc lai partially_received
      const poLines = db.prepare('SELECT quantity_ordered, quantity_received FROM purchase_order_lines WHERE po_id=?').all(b.po_id);
      const allReceived = poLines.every(l => l.quantity_received >= l.quantity_ordered);
      db.prepare(`UPDATE purchase_orders SET status=? WHERE id=?`).run(allReceived ? 'completed' : 'partially_received', b.po_id);

      return grId;
    });
    const grId = tx();
    if (b.wizard) return res.redirect('/wizard/' + b.wizard);
    res.redirect('/goods-receipts/' + grId);
  } catch (err) {
    res.status(400).send('Lỗi: ' + err.message + ' (có thể serial bị trùng — mỗi serial chỉ được nhập 1 lần trong toàn hệ thống)');
  }
});

module.exports = router;
