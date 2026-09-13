const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

function getSettings() {
  return db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
}

router.get('/', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: null, error: null });
});

router.post('/company', (req, res) => {
  const b = req.body;
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  ['company_name', 'company_tax_code', 'company_address', 'company_phone', 'recipient_name', 'recipient_phone', 'reseller_license_email', 'accountant_email']
    .forEach(k => upsert.run(k, b[k] || ''));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: 'Đã lưu thông tin công ty.', error: null });
});

router.post('/boarding', (req, res) => {
  const b = req.body;
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  ['boarding_landlord_name', 'boarding_landlord_dob', 'boarding_landlord_address', 'boarding_landlord_phone', 'boarding_house_address',
   'boarding_landlord_birth_place', 'boarding_landlord_id_number', 'boarding_landlord_id_issue_date', 'boarding_landlord_id_issue_place']
    .forEach(k => upsert.run(k, b[k] || ''));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: 'Đã lưu thông tin nhà trọ.', error: null });
});

router.post('/password', (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: null, error: 'Mật khẩu hiện tại không đúng.' });
  }
  if (!new_password || new_password.length < 4) {
    return res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: null, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
  }
  if (new_password !== confirm_password) {
    return res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: null, error: 'Xác nhận mật khẩu mới không khớp.' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  res.render('settings/index', { title: 'Cài đặt', user, settings: getSettings(), message: 'Đổi mật khẩu thành công.', error: null });
});

module.exports = router;
