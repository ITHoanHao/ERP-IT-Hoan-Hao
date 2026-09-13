const bcrypt = require('bcryptjs');
const db = require('./index');

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('123456', 10);
    db.prepare('INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)')
      .run('admin', hash, 'Chu doanh nghiep');
    console.log('Da tao tai khoan: username=admin / password=123456 (doi mat khau sau khi dang nhap)');
  }

  const defaults = {
    default_credit_term_days: '15',
    default_tax_rate_percent: '8',
    currency: 'VND',
    company_name: 'CÔNG TY TNHH IT HOÀN HẢO',
    company_tax_code: '0318606297',
    company_address: '207/45 Nam Cao, Phường Tăng Nhơn Phú, Thành phố Hồ Chí Minh, Việt Nam',
    company_phone: '',
    recipient_name: 'Bùi Bảo Châu',
    recipient_phone: '',
    reseller_license_email: '',
    accountant_email: '',
  };
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
  for (const [k, v] of Object.entries(defaults)) upsert.run(k, v);

  console.log('Seed hoan tat.');
}

seed();
