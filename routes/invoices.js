const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { extractInvoiceInfo } = require('../lib/invoiceExtract');
const { handleDelete } = require('../lib/auth');
const router = express.Router();

const { DATA_DIR } = require('../lib/dataDir');
const uploadDir = path.join(DATA_DIR, 'uploads', 'invoices');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const rows = db.prepare(
    `SELECT i.*, c.name as customer_name,
       (SELECT GROUP_CONCAT(COALESCE(p.name, sol.description, ''), ', ')
        FROM sales_order_lines sol LEFT JOIN products p ON p.id = sol.product_id
        WHERE sol.so_id = i.so_id) as items_preview
     FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id
     WHERE (? = '' OR i.invoice_no LIKE ? OR c.name LIKE ? OR i.external_invoice_no LIKE ?
       OR EXISTS (SELECT 1 FROM sales_order_lines sol2 LEFT JOIN products p2 ON p2.id=sol2.product_id
                  WHERE sol2.so_id=i.so_id AND (p2.name LIKE ? OR sol2.description LIKE ?)))
     ORDER BY i.id DESC`
  ).all(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  rows.forEach(r => {
    if (r.items_preview && r.items_preview.length > 70) r.items_preview = r.items_preview.slice(0, 70) + '...';
  });
  res.render('invoices/list', { title: 'Hóa đơn', rows, q });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT i.*, so.so_no, c.id as customer_id, c.name as customer_name, c.credit_term_days
     FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id WHERE i.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/invoices');
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=?`
  ).all(row.so_id);
  const payment = db.prepare(`SELECT * FROM payments WHERE source_doc_type='invoice' AND source_doc_id=?`).get(row.id);
  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='invoice' AND entity_id=? ORDER BY id DESC`).all(row.id);
  res.render('invoices/detail', { title: row.invoice_no, row, lines, payment, attachments });
});

router.get('/:id/compose-email', (req, res) => {
  const row = db.prepare(
    `SELECT i.*, so.so_no, so.quotation_id, c.id as customer_id, c.name as customer_name
     FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id WHERE i.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/invoices');

  const quotation = row.quotation_id ? db.prepare('SELECT * FROM quotations WHERE id=?').get(row.quotation_id) : null;
  const firstProduct = db.prepare(
    `SELECT p.name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=? LIMIT 1`
  ).get(row.so_id);
  const shortTitle = (quotation && quotation.short_title) || (firstProduct && firstProduct.name) || 'Đơn hàng';

  const contacts = db.prepare('SELECT * FROM customer_contacts WHERE customer_id=? AND is_active=1').all(row.customer_id);
  const toList = contacts.filter(c => c.recipient_type === 'to').map(c => c.email);
  const ccList = contacts.filter(c => c.recipient_type === 'cc').map(c => c.email);

  const attachments = db.prepare(`SELECT * FROM attachments WHERE entity_type='invoice' AND entity_id=? ORDER BY id DESC`).all(row.id);
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});

  const [y, m, d] = row.invoice_date.split('-');
  const dateDDMMYYYY = d + m + y;
  const subject = `[Đề nghị thanh toán] ${shortTitle} - ${dateDDMMYYYY}`;

  const body =
`Dear Quý anh chị, ${row.customer_name}.

Good day.

Công ty TNHH IT Hoàn Hảo xin gửi quý anh chị hóa đơn + Biên bản giao hàng cho các mặt hàng sau, đã được bàn giao đầy đủ.

Vui lòng check file đính kèm, và xác nhận ngày thanh toán ạ.

Trân trọng cám ơn Quý Công ty đã luôn tin tưởng, ủng hộ sản phẩm và dịch vụ của chúng tôi.

Thanks and Best Regards,
`;

  const mailtoUrl = `mailto:${encodeURIComponent(toList.join('; '))}` +
    `?cc=${encodeURIComponent(ccList.join('; '))}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  res.render('invoices/composeEmail', {
    title: 'Soạn email gửi khách - ' + row.invoice_no,
    row, quotation, toList, ccList, attachments, mailtoUrl, subject, body,
    hasContacts: contacts.length > 0,
  });
});


router.get('/:id/handover', (req, res) => {
  const row = db.prepare(
    `SELECT i.*, c.name as customer_name, c.address as customer_address, c.tax_code
     FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id WHERE i.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/invoices');
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=?`
  ).all(row.so_id);
  // Bien ban ban giao hien thi gia DA GOM VAT (theo yeu cau) - lam tron TUNG DONG dung nhu luc tao hoa don,
  // de tong cong khop chinh xac voi invoice.total_amount, khong lech do lam tron
  lines.forEach(l => {
    const vatOfLine = Math.round(l.line_amount * (l.tax_rate_percent || 0) / 100);
    const lineAmountInclVat = l.line_amount + vatOfLine;
    l.unit_price = l.quantity ? lineAmountInclVat / l.quantity : lineAmountInclVat;
    l.line_amount = lineAmountInclVat;
  });
  const { generateHandoverPdf } = require('../lib/documentPdf');
  generateHandoverPdf(res, row, lines);
});

router.get('/:id/payment-request', (req, res) => {
  const row = db.prepare(
    `SELECT i.*, c.name as customer_name, c.address as customer_address, c.tax_code
     FROM invoices i JOIN sales_orders so ON so.id=i.so_id JOIN customers c ON c.id=so.customer_id WHERE i.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/invoices');
  const lines = db.prepare(
    `SELECT sol.*, p.name as product_name FROM sales_order_lines sol LEFT JOIN products p ON p.id=sol.product_id WHERE sol.so_id=?`
  ).all(row.so_id);
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
  const { generatePaymentRequestPdf } = require('../lib/documentPdf');
  generatePaymentRequestPdf(res, row, lines, settings);
});

router.get('/:id/upload', (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/invoices');
  res.render('invoices/upload', { title: 'Đính kèm hóa đơn điện tử', row, extracted: null, error: null, wizard: req.query.wizard || null });
});

router.post('/:id/upload', upload.single('file'), async (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  const wizard = req.query.wizard || null;
  if (!row) return res.redirect('/invoices');
  if (!req.file) return res.render('invoices/upload', { title: 'Đính kèm hóa đơn điện tử', row, extracted: null, error: 'Vui lòng chọn file.', wizard });

  // File XML hoa don dien tu (di kem ban PDF) - chi luu tru, khong can qua buoc xac nhan trich xuat
  if (req.file.originalname.toLowerCase().endsWith('.xml')) {
    db.prepare(`INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size, label) VALUES ('invoice', ?, ?, ?, ?, ?)`)
      .run(row.id, req.file.originalname, req.file.filename, req.file.size, 'Hóa đơn điện tử (XML)');
    if (wizard) return res.redirect('/wizard/' + wizard);
    return res.redirect('/invoices/' + row.id + '?ok=' + encodeURIComponent('Đã lưu file XML hóa đơn điện tử.'));
  }

  db.prepare(`INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size) VALUES ('invoice', ?, ?, ?, ?)`)
    .run(row.id, req.file.originalname, req.file.filename, req.file.size);

  let extracted = { invoiceNo: null, invoiceSerial: null, invoiceDate: null, totalAmount: null, error: null };
  if (req.file.mimetype === 'application/pdf') {
    extracted = await extractInvoiceInfo(path.join(uploadDir, req.file.filename));
  } else {
    extracted.error = 'File ảnh (không phải PDF văn bản) — hệ thống hiện chỉ tự động đọc được PDF hóa đơn điện tử dạng văn bản, chưa hỗ trợ nhận diện chữ trong ảnh chụp. Vui lòng nhập tay bên dưới.';
  }
  res.render('invoices/upload', { title: 'Đính kèm hóa đơn điện tử', row, extracted, error: extracted.error, filename: req.file.filename, wizard });
});

router.post('/:id/upload/confirm', (req, res) => {
  const b = req.body;
  db.prepare(`UPDATE invoices SET external_invoice_no=?, external_invoice_serial=?, external_invoice_date=? WHERE id=?`)
    .run(b.external_invoice_no || null, b.external_invoice_serial || null, b.external_invoice_date || null, req.params.id);
  if (req.query.wizard) return res.redirect('/wizard/' + req.query.wizard);
  res.redirect('/invoices/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  const { verifyCurrentUserPassword } = require('../lib/auth');
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect('/invoices/' + req.params.id + '?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const invoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  const relatedPayment = invoice ? db.prepare(`SELECT * FROM payments WHERE source_doc_type='invoice' AND source_doc_id=?`).get(invoice.id) : null;
  if (relatedPayment) {
    return res.redirect('/invoices/' + req.params.id + '?err=' + encodeURIComponent(
      `Không thể xóa vì đã có phiếu thu "${relatedPayment.payment_no}" gắn với hóa đơn này. Hãy xóa phiếu thu đó trước.`
    ));
  }
  handleDelete(req, res, { table: 'invoices', id: req.params.id, backUrl: '/invoices', label: 'hóa đơn' });
});

module.exports = router;
