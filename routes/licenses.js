const express = require('express');
const dayjs = require('dayjs');
const db = require('../db');
const { genNumber } = require('../db/numbering');
const { verifyCurrentUserPassword } = require('../lib/auth');
const router = express.Router();

function getSettings() {
  return db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
}

function computeAmounts(qty, price, tax) {
  const amount = qty * price;
  const subtotal = Math.round(amount);
  const vat = Math.round(amount * tax / 100);
  return { subtotal, vat, total: subtotal + vat };
}

// Cac truong end-user rieng cho tung License (KHONG con dung chung theo Khach hang nua,
// vi 1 khach hang co the co nhieu end-user khac nhau)
function buildVendorFields(b) {
  return {
    ms_end_user_company_name: b.tenant_company_name || null,
    ms_end_user_address: b.tenant_address || null,
    ms_end_user_phone: b.tenant_phone || null,
    ms_license_manager_name: b.tenant_manager || null,
    ms_admin_email: b.tenant_admin_email || null,
    ms_tenant_domain: b.tenant_domain || null,
    adsk_end_user_name: b.autodesk_end_user_name || null,
    adsk_license_email: b.autodesk_license_email || null,
    adsk_manager_email: b.autodesk_manager_email || null,
    adsk_contract_id: b.autodesk_contract_id || null,
    adsk_subscription_id: b.autodesk_subscription_id || null,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT l.*, c.name as customer_name FROM licenses l JOIN customers c ON c.id = l.customer_id ORDER BY l.id DESC`
  ).all();
  const today = dayjs();
  rows.forEach(r => {
    r.daysLeft = r.expiry_date ? dayjs(r.expiry_date).diff(today, 'day') : null;
    if (r.vendor_type === 'microsoft') r.endUserName = r.ms_end_user_company_name || r.customer_name;
    else if (r.vendor_type === 'autodesk') r.endUserName = r.adsk_end_user_name || r.customer_name;
    else r.endUserName = r.customer_name;
  });
  res.render('licenses/list', { title: 'License', rows });
});

router.get('/new', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  res.render('licenses/form', { title: 'Thêm License', row: {}, customers, settings: getSettings(), renewFromId: null });
});

router.get('/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM licenses WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/licenses');
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  res.render('licenses/form', { title: 'Sửa License ' + row.license_no, row, customers, settings: getSettings(), renewFromId: null });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT l.*, c.name as customer_name FROM licenses l JOIN customers c ON c.id=l.customer_id WHERE l.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/licenses');
  const renewedFrom = row.renewed_from_license_id ? db.prepare('SELECT license_no FROM licenses WHERE id=?').get(row.renewed_from_license_id) : null;
  const renewedTo = db.prepare('SELECT license_no, id FROM licenses WHERE renewed_from_license_id=?').get(row.id);
  res.render('licenses/detail', { title: row.license_no, row, renewedFrom, renewedTo });
});

router.post('/', (req, res) => {
  const b = req.body;
  const qty = parseFloat(b.quantity) || 0;
  const price = parseFloat(b.unit_price) || 0;
  const tax = parseFloat(b.tax_rate_percent) || 0;
  const { subtotal, vat, total } = computeAmounts(qty, price, tax);
  const vendorType = ['microsoft', 'autodesk'].includes(b.vendor_type) ? b.vendor_type : 'other';
  const vf = buildVendorFields(b);

  const licenseNo = genNumber(db, 'LIC', 'licenses', 'license_no');
  const info = db.prepare(
    `INSERT INTO licenses (license_no, customer_id, license_name, vendor_type, quantity, unit_price, tax_rate_percent, subtotal_amount, vat_amount, total_amount, start_date, expiry_date, requires_renewal, status, note,
       ms_end_user_company_name, ms_end_user_address, ms_end_user_phone, ms_license_manager_name, ms_admin_email, ms_tenant_domain,
       adsk_end_user_name, adsk_license_email, adsk_manager_email, adsk_contract_id, adsk_subscription_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?)`
  ).run(licenseNo, b.customer_id, b.license_name, vendorType, qty, price, tax, subtotal, vat, total,
    b.start_date || dayjs().format('YYYY-MM-DD'), b.expiry_date || null, b.requires_renewal ? 1 : 0, 'active', b.note || '',
    vf.ms_end_user_company_name, vf.ms_end_user_address, vf.ms_end_user_phone, vf.ms_license_manager_name, vf.ms_admin_email, vf.ms_tenant_domain,
    vf.adsk_end_user_name, vf.adsk_license_email, vf.adsk_manager_email, vf.adsk_contract_id, vf.adsk_subscription_id);
  res.redirect('/licenses/' + info.lastInsertRowid);
});

router.post('/:id', (req, res) => {
  const b = req.body;
  const qty = parseFloat(b.quantity) || 0;
  const price = parseFloat(b.unit_price) || 0;
  const tax = parseFloat(b.tax_rate_percent) || 0;
  const { subtotal, vat, total } = computeAmounts(qty, price, tax);
  const vendorType = ['microsoft', 'autodesk'].includes(b.vendor_type) ? b.vendor_type : 'other';
  const vf = buildVendorFields(b);

  db.prepare(
    `UPDATE licenses SET customer_id=?, license_name=?, vendor_type=?, quantity=?, unit_price=?, tax_rate_percent=?, subtotal_amount=?, vat_amount=?, total_amount=?, start_date=?, expiry_date=?, requires_renewal=?, note=?,
       ms_end_user_company_name=?, ms_end_user_address=?, ms_end_user_phone=?, ms_license_manager_name=?, ms_admin_email=?, ms_tenant_domain=?,
       adsk_end_user_name=?, adsk_license_email=?, adsk_manager_email=?, adsk_contract_id=?, adsk_subscription_id=?
     WHERE id=?`
  ).run(b.customer_id, b.license_name, vendorType, qty, price, tax, subtotal, vat, total,
    b.start_date || null, b.expiry_date || null, b.requires_renewal ? 1 : 0, b.note || '',
    vf.ms_end_user_company_name, vf.ms_end_user_address, vf.ms_end_user_phone, vf.ms_license_manager_name, vf.ms_admin_email, vf.ms_tenant_domain,
    vf.adsk_end_user_name, vf.adsk_license_email, vf.adsk_manager_email, vf.adsk_contract_id, vf.adsk_subscription_id,
    req.params.id);
  res.redirect('/licenses/' + req.params.id);
});

// Gia han = tao ban ghi License MOI, lien ket ve license cu, dung nguyen tac BR-37 da thong nhat.
// Thong tin end-user duoc mang nguyen tu chinh license cu (khong phai tu 1 "kho chung" cua khach hang).
router.get('/:id/renew', (req, res) => {
  const old = db.prepare('SELECT * FROM licenses WHERE id=?').get(req.params.id);
  if (!old) return res.redirect('/licenses');
  const customers = db.prepare('SELECT * FROM customers WHERE is_active=1 ORDER BY name').all();
  const row = {
    customer_id: old.customer_id, license_name: old.license_name, vendor_type: old.vendor_type,
    quantity: old.quantity, unit_price: old.unit_price, tax_rate_percent: old.tax_rate_percent,
    start_date: dayjs().format('YYYY-MM-DD'),
    expiry_date: old.expiry_date ? dayjs(old.expiry_date).add(1, 'year').format('YYYY-MM-DD') : '',
    requires_renewal: old.requires_renewal, note: '',
    ms_end_user_company_name: old.ms_end_user_company_name, ms_end_user_address: old.ms_end_user_address,
    ms_end_user_phone: old.ms_end_user_phone, ms_license_manager_name: old.ms_license_manager_name,
    ms_admin_email: old.ms_admin_email, ms_tenant_domain: old.ms_tenant_domain,
    adsk_end_user_name: old.adsk_end_user_name, adsk_license_email: old.adsk_license_email,
    adsk_manager_email: old.adsk_manager_email, adsk_contract_id: old.adsk_contract_id, adsk_subscription_id: old.adsk_subscription_id,
  };
  res.render('licenses/form', { title: 'Gia hạn License ' + old.license_no, row, customers, settings: getSettings(), renewFromId: old.id });
});

router.post('/:id/renew', (req, res) => {
  const b = req.body;
  const oldId = req.params.id;
  const qty = parseFloat(b.quantity) || 0;
  const price = parseFloat(b.unit_price) || 0;
  const tax = parseFloat(b.tax_rate_percent) || 0;
  const { subtotal, vat, total } = computeAmounts(qty, price, tax);
  const vendorType = ['microsoft', 'autodesk'].includes(b.vendor_type) ? b.vendor_type : 'other';
  const vf = buildVendorFields(b);

  const tx = db.transaction(() => {
    const licenseNo = genNumber(db, 'LIC', 'licenses', 'license_no');
    const info = db.prepare(
      `INSERT INTO licenses (license_no, customer_id, license_name, vendor_type, quantity, unit_price, tax_rate_percent, subtotal_amount, vat_amount, total_amount, start_date, expiry_date, requires_renewal, status, renewed_from_license_id, note,
         ms_end_user_company_name, ms_end_user_address, ms_end_user_phone, ms_license_manager_name, ms_admin_email, ms_tenant_domain,
         adsk_end_user_name, adsk_license_email, adsk_manager_email, adsk_contract_id, adsk_subscription_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?)`
    ).run(licenseNo, b.customer_id, b.license_name, vendorType, qty, price, tax, subtotal, vat, total,
      b.start_date || dayjs().format('YYYY-MM-DD'), b.expiry_date || null, b.requires_renewal ? 1 : 0, 'active', oldId, b.note || '',
      vf.ms_end_user_company_name, vf.ms_end_user_address, vf.ms_end_user_phone, vf.ms_license_manager_name, vf.ms_admin_email, vf.ms_tenant_domain,
      vf.adsk_end_user_name, vf.adsk_license_email, vf.adsk_manager_email, vf.adsk_contract_id, vf.adsk_subscription_id);
    db.prepare(`UPDATE licenses SET status='renewed' WHERE id=?`).run(oldId);
    return info.lastInsertRowid;
  });
  const id = tx();
  res.redirect('/licenses/' + id);
});

router.post('/:id/cancel', (req, res) => {
  db.prepare(`UPDATE licenses SET status='cancelled' WHERE id=?`).run(req.params.id);
  res.redirect('/licenses/' + req.params.id);
});

router.post('/:id/delete', (req, res) => {
  const password = req.body.confirm_password;
  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect('/licenses?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  try {
    db.prepare('DELETE FROM licenses WHERE id=?').run(req.params.id);
    console.log(`[XOA] ${new Date().toISOString()} - Bang: licenses, ID: ${req.params.id}, Nguoi thuc hien: user#${req.session.userId}`);
    res.redirect('/licenses?ok=' + encodeURIComponent('Đã xóa license thành công.'));
  } catch (e) {
    let msg = 'Không thể xóa: ' + e.message;
    if (/FOREIGN KEY/i.test(e.message)) {
      msg = 'Không thể xóa vì license này đang được license khác gia hạn từ nó tham chiếu tới — hãy xóa license gia hạn liên quan trước.';
    }
    res.redirect('/licenses/' + req.params.id + '?err=' + encodeURIComponent(msg));
  }
});

router.get('/:id/pdf', (req, res) => {
  const row = db.prepare(
    `SELECT l.*, c.name as customer_name FROM licenses l JOIN customers c ON c.id=l.customer_id WHERE l.id=?`
  ).get(req.params.id);
  if (!row) return res.redirect('/licenses');
  const settings = getSettings();
  if (row.vendor_type === 'microsoft') {
    const tenant = {
      end_user_company_name: row.ms_end_user_company_name, end_user_address: row.ms_end_user_address,
      end_user_phone: row.ms_end_user_phone, license_manager_name: row.ms_license_manager_name,
      admin_email: row.ms_admin_email, tenant_domain: row.ms_tenant_domain,
    };
    const { generateLicenseOrderPdf } = require('../lib/licensePdf');
    return generateLicenseOrderPdf(res, row, tenant, settings);
  }
  if (row.vendor_type === 'autodesk') {
    const profile = {
      end_user_name: row.adsk_end_user_name, license_email: row.adsk_license_email,
      manager_email: row.adsk_manager_email, contract_id: row.adsk_contract_id, subscription_id: row.adsk_subscription_id,
    };
    const { generateAutodeskOrderPdf } = require('../lib/licensePdf');
    return generateAutodeskOrderPdf(res, row, profile, settings);
  }
  res.redirect('/licenses/' + req.params.id);
});

module.exports = router;
