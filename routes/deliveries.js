const express = require('express');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT d.*, so.so_no, c.name as customer_name,
       (SELECT GROUP_CONCAT(p.name, ', ')
        FROM delivery_lines dl JOIN products p ON p.id = dl.product_id
        WHERE dl.delivery_id = d.id) as items_preview
     FROM deliveries d
     JOIN sales_orders so ON so.id = d.so_id JOIN customers c ON c.id = so.customer_id
     WHERE (? = '' OR d.delivery_no LIKE ? OR so.so_no LIKE ? OR c.name LIKE ?
       OR EXISTS (SELECT 1 FROM delivery_lines dl2 JOIN products p2 ON p2.id=dl2.product_id
                  WHERE dl2.delivery_id=d.id AND p2.name LIKE ?))
     ORDER BY d.id DESC`
  ).all(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  rows.forEach(r => {
    if (r.items_preview && r.items_preview.length > 70) r.items_preview = r.items_preview.slice(0, 70) + '...';
  });
  res.render('deliveries/list', { title: 'Giao hàng', rows, q });
});

router.get('/new', (req, res) => {
  const soId = req.query.so_id;
  const so = db.prepare('SELECT so.*, c.name as customer_name FROM sales_orders so JOIN customers c ON c.id=so.customer_id WHERE so.id=?').get(soId);
  if (!so || so.status !== 'created') return res.redirect('/sales-orders');
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name, p.tracking_type, p.id as pid FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=?`
  ).all(soId);
  // Voi moi dong san pham co serial, lay danh sach serial dang "in_stock"
  lines.forEach(l => {
    if (l.tracking_type === 'serial') {
      l.availableSerials = db.prepare(`SELECT * FROM inventory_serials WHERE product_id=? AND status='in_stock'`).all(l.pid);
    } else if (l.tracking_type === 'quantity') {
      l.availableBatches = db.prepare(`SELECT * FROM inventory_batches WHERE product_id=? AND quantity_remaining > 0 ORDER BY id ASC`).all(l.pid);
      l.totalAvailable = l.availableBatches.reduce((s, b) => s + b.quantity_remaining, 0);
    }
  });
  res.render('deliveries/form', { title: 'Giao hàng - ' + so.so_no, so, lines, wizard: req.query.wizard || null });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT d.*, so.so_no, c.name as customer_name FROM deliveries d JOIN sales_orders so ON so.id=d.so_id JOIN customers c ON c.id=so.customer_id WHERE d.id=?').get(req.params.id);
  if (!row) return res.redirect('/sales-orders');
  const lines = db.prepare(
    `SELECT dl.*, p.name as product_name FROM delivery_lines dl JOIN products p ON p.id=dl.product_id WHERE dl.delivery_id=?`
  ).all(row.id);
  res.render('deliveries/detail', { title: row.delivery_no, row, lines });
});

router.post('/', (req, res) => {
  const b = req.body;
  const soLineIds = Array.isArray(b.so_line_id) ? b.so_line_id : [b.so_line_id];
  const productIds = Array.isArray(b.product_id) ? b.product_id : [b.product_id];
  const trackingTypes = Array.isArray(b.tracking_type) ? b.tracking_type : [b.tracking_type];
  const serialIds = Array.isArray(b.serial_ids) ? b.serial_ids : [b.serial_ids]; // moi phan tu la CSV cac serial id da chon
  const qtys = Array.isArray(b.quantity) ? b.quantity : [b.quantity];

  try {
    const tx = db.transaction(() => {
      const so = db.prepare('SELECT * FROM sales_orders WHERE id=?').get(b.so_id);
      // Kiem tra giao du 100%
      for (let i = 0; i < soLineIds.length; i++) {
        const solLine = db.prepare('SELECT * FROM sales_order_lines WHERE id=?').get(soLineIds[i]);
        const remain = solLine.quantity - solLine.quantity_delivered;
        if (trackingTypes[i] === 'serial') {
          const ids = (serialIds[i] || '').split(',').filter(Boolean);
          if (ids.length !== remain) throw new Error(`Dòng "${solLine.description}" cần giao đủ ${remain} nhưng chỉ chọn ${ids.length} serial. Phải giao đủ 100%.`);
        } else {
          const qty = parseFloat(qtys[i]) || 0;
          if (Math.abs(qty - remain) > 0.001) throw new Error(`Dòng "${solLine.description}" cần giao đủ ${remain} nhưng nhập ${qty}. Phải giao đủ 100%.`);
        }
      }

      const deliveryNo = genNumber(db, 'DL', 'deliveries', 'delivery_no');
      const drInfo = db.prepare(
        `INSERT INTO deliveries (delivery_no, so_id, delivery_date, received_by) VALUES (?,?,date('now'),?)`
      ).run(deliveryNo, b.so_id, b.received_by || '');
      const deliveryId = drInfo.lastInsertRowid;

      const insertDL = db.prepare(
        `INSERT INTO delivery_lines (delivery_id, so_line_id, product_id, serial_id, batch_id, quantity) VALUES (?,?,?,?,?,?)`
      );
      const markSold = db.prepare(`UPDATE inventory_serials SET status='sold', customer_id=?, warranty_expiry_date=? WHERE id=?`);
      const deductBatch = db.prepare(`UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id=?`);
      const updateSOLine = db.prepare(`UPDATE sales_order_lines SET quantity_delivered = quantity_delivered + ? WHERE id=?`);

      let totalCogs = 0;
      const invoiceLineData = [];

      for (let i = 0; i < soLineIds.length; i++) {
        const solLine = db.prepare('SELECT * FROM sales_order_lines WHERE id=?').get(soLineIds[i]);
        let lineCogs = 0;
        if (trackingTypes[i] === 'serial') {
          const ids = (serialIds[i] || '').split(',').filter(Boolean);
          const product = db.prepare('SELECT * FROM products WHERE id=?').get(productIds[i]);
          const warrantyExpiry = product.warranty_months_default > 0
            ? `date('now','+${product.warranty_months_default} months')` : null;
          ids.forEach(sid => {
            const serial = db.prepare('SELECT * FROM inventory_serials WHERE id=?').get(sid);
            if (!serial || serial.status !== 'in_stock') throw new Error('Serial không hợp lệ hoặc đã bán: ' + sid);
            const expiry = product.warranty_months_default > 0
              ? db.prepare(`SELECT date('now', '+${product.warranty_months_default} months') as d`).get().d : null;
            markSold.run(so.customer_id, expiry, sid);
            insertDL.run(deliveryId, soLineIds[i], productIds[i], sid, null, 1);
            lineCogs += serial.purchase_cost;
          });
          updateSOLine.run(ids.length, soLineIds[i]);
        } else {
          let qtyNeeded = parseFloat(qtys[i]) || 0;
          updateSOLine.run(qtyNeeded, soLineIds[i]);
          const batches = db.prepare(`SELECT * FROM inventory_batches WHERE product_id=? AND quantity_remaining > 0 ORDER BY id ASC`).all(productIds[i]);
          for (const batch of batches) {
            if (qtyNeeded <= 0) break;
            const take = Math.min(batch.quantity_remaining, qtyNeeded);
            deductBatch.run(take, batch.id);
            insertDL.run(deliveryId, soLineIds[i], productIds[i], null, batch.id, take);
            lineCogs += take * batch.unit_cost;
            qtyNeeded -= take;
          }
          if (qtyNeeded > 0.001) throw new Error('Không đủ tồn kho cho dòng: ' + solLine.description);
        }
        totalCogs += lineCogs;
        invoiceLineData.push({ so_line_id: soLineIds[i], quantity: solLine.quantity, unit_price: solLine.unit_price, line_amount: solLine.line_amount, line_cogs: lineCogs });
      }

      db.prepare(`UPDATE sales_orders SET status='delivered' WHERE id=?`).run(b.so_id);

      // Tu dong sinh Invoice
      // Loi nhuan tinh tren doanh thu CHUA VAT (subtotal_amount) vi VAT khong phai doanh thu cua cong ty
      const invNo = genNumber(db, 'INV', 'invoices', 'invoice_no');
      const revenueExclVat = so.subtotal_amount || so.total_amount; // fallback cho don hang cu chua co subtotal
      const profit = revenueExclVat - totalCogs;
      const invInfo = db.prepare(
        `INSERT INTO invoices (invoice_no, so_id, invoice_date, payment_status, subtotal_amount, vat_amount, total_amount, cogs_amount, profit_amount) VALUES (?,?,date('now'),'unpaid',?,?,?,?,?)`
      ).run(invNo, b.so_id, so.subtotal_amount || 0, so.vat_amount || 0, so.total_amount, totalCogs, profit);
      // (invoice_lines luoc bo chi tiet o MVP, dung invoices tong hop; du lieu chi tiet van truy vet qua sales_order_lines)

      return { deliveryId, invoiceId: invInfo.lastInsertRowid };
    });
    const result = tx();
    if (b.wizard) return res.redirect('/wizard/' + b.wizard);
    res.redirect('/deliveries/' + result.deliveryId);
  } catch (err) {
    res.status(400).send('Lỗi: ' + err.message);
  }
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/deliveries?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const delivery = db.prepare('SELECT * FROM deliveries WHERE id=?').get(req.params.id);
  if (!delivery) return res.redirect('/deliveries');

  // Neu Sales Order da co Hoa don sinh ra tu lan giao hang nay, khong cho xoa truc tiep -
  // phai xoa Hoa don truoc (tranh de lai hoa don "mo coi" khong co giao hang tuong ung)
  const invoice = db.prepare('SELECT * FROM invoices WHERE so_id=?').get(delivery.so_id);
  if (invoice) {
    return res.redirect('/deliveries/' + delivery.id + '?err=' + encodeURIComponent(
      `Không thể xóa vì Đơn bán này đã có Hóa đơn "${invoice.invoice_no}" được tạo dựa trên lần giao hàng này. Hãy xóa Hóa đơn đó trước (nếu thực sự cần), rồi mới xóa phiếu giao hàng.`
    ));
  }

  try {
    const tx = db.transaction(() => {
      const lines = db.prepare('SELECT * FROM delivery_lines WHERE delivery_id=?').all(delivery.id);
      lines.forEach(l => {
        if (l.serial_id) {
          // Hoan lai serial ve trang thai Trong kho, bo lien ket khach hang/bao hanh
          db.prepare(`UPDATE inventory_serials SET status='in_stock', customer_id=NULL, warranty_expiry_date=NULL WHERE id=?`).run(l.serial_id);
        } else if (l.batch_id) {
          // Hoan lai so luong ve lo hang
          db.prepare(`UPDATE inventory_batches SET quantity_remaining = quantity_remaining + ? WHERE id=?`).run(l.quantity, l.batch_id);
        }
        // Giam lai so luong da giao tren dong Sales Order
        db.prepare(`UPDATE sales_order_lines SET quantity_delivered = quantity_delivered - ? WHERE id=?`).run(l.quantity, l.so_line_id);
      });
      // Dua Sales Order ve lai trang thai "created" vi chua thuc su giao hang nua
      db.prepare(`UPDATE sales_orders SET status='created' WHERE id=?`).run(delivery.so_id);
      db.prepare('DELETE FROM deliveries WHERE id=?').run(delivery.id); // delivery_lines tu xoa theo (ON DELETE CASCADE)
    });
    tx();
    console.log(`[XOA] ${new Date().toISOString()} - Bang: deliveries, ID: ${delivery.id}, Nguoi thuc hien: user#${req.session.userId} - Da hoan tac ton kho`);
    res.redirect('/deliveries?ok=' + encodeURIComponent('Đã xóa phiếu giao hàng và hoàn tác tồn kho thành công.'));
  } catch (e) {
    res.redirect('/deliveries/' + delivery.id + '?err=' + encodeURIComponent('Không thể xóa: ' + e.message));
  }
});

module.exports = router;
