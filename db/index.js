const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('../lib/dataDir');

const DB_PATH = path.join(DATA_DIR, 'data.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Khoi tao schema neu chua co
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// ---- Migration: bo sung cot moi cho cac ban da ton tai (an toan, khong mat du lieu) ----
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[migration] Da them cot ${column} vao bang ${table}`);
  }
}

addColumnIfMissing('customers', 'tax_code', 'TEXT');
addColumnIfMissing('suppliers', 'tax_code', 'TEXT');

addColumnIfMissing('quotations', 'subtotal_amount', 'REAL DEFAULT 0');
addColumnIfMissing('quotations', 'vat_amount', 'REAL DEFAULT 0');
addColumnIfMissing('quotation_lines', 'tax_rate_percent', 'REAL DEFAULT 8');

addColumnIfMissing('sales_orders', 'subtotal_amount', 'REAL DEFAULT 0');
addColumnIfMissing('sales_orders', 'vat_amount', 'REAL DEFAULT 0');
addColumnIfMissing('sales_order_lines', 'tax_rate_percent', 'REAL DEFAULT 8');
addColumnIfMissing('sales_orders', 'has_partner_commission', 'INTEGER DEFAULT 0');

addColumnIfMissing('invoices', 'subtotal_amount', 'REAL DEFAULT 0');
addColumnIfMissing('invoices', 'vat_amount', 'REAL DEFAULT 0');
addColumnIfMissing('invoices', 'external_invoice_no', 'TEXT');
addColumnIfMissing('invoices', 'external_invoice_date', 'TEXT');

addColumnIfMissing('purchase_orders', 'subtotal_amount', 'REAL DEFAULT 0');
addColumnIfMissing('purchase_orders', 'vat_amount', 'REAL DEFAULT 0');
addColumnIfMissing('purchase_orders', 'delivery_status_note', "TEXT DEFAULT 'Chờ xác nhận'");
addColumnIfMissing('purchase_order_lines', 'tax_rate_label', "TEXT DEFAULT '8%'");

addColumnIfMissing('products', 'supplier_id', 'INTEGER REFERENCES suppliers(id)');
addColumnIfMissing('invoices', 'external_invoice_serial', 'TEXT');
addColumnIfMissing('sales_order_lines', 'warranty_months', 'INTEGER DEFAULT 0');
// Backfill: neu san pham da tung gan nhieu NCC qua bang product_suppliers (ban v1.3), lay NCC dau tien lam mac dinh
try {
  const hasOldTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='product_suppliers'`).get();
  if (hasOldTable) {
    const toBackfill = db.prepare(
      `SELECT p.id, (SELECT supplier_id FROM product_suppliers WHERE product_id=p.id ORDER BY id LIMIT 1) as sid
       FROM products p WHERE p.supplier_id IS NULL`
    ).all();
    const upd = db.prepare('UPDATE products SET supplier_id=? WHERE id=?');
    toBackfill.forEach(r => { if (r.sid) upd.run(r.sid, r.id); });
  }
} catch (e) { /* bo qua neu khong co du lieu cu */ }

// Seed danh sach nhom/thuong hieu/don vi tinh mac dinh (chi seed neu bang con trong,
// khong ghi de neu nguoi dung da tung them lua chon rieng)
(function seedProductAttributes() {
  const count = db.prepare('SELECT COUNT(*) as c FROM product_attributes').get().c;
  if (count > 0) return;
  const categories = ['Dịch vụ','Điện tử viễn thông','Phần cứng máy tính','Phần mềm','Phụ kiện','Phụ kiện vi tính','Sản phẩm khác','Thiết bị lưu trữ','Thiết bị mạng','Thiết bị ngoại vi'];
  const brands = ['Microsoft','Intel','AMD','NVIDIA','Dell','HP','Lenovo','ASUS','Acer','Apple','Cisco','Synology','QNAP','Kingston','Samsung','Seagate','Western Digital (WD)','Epson','Fortinet','Adobe'];
  const units = ["Bao","Bình","Bộ","Ca","Cái","Can","Cặp","Chiếc","cm","cm²","cm³","Công","Cuộn","Cuốn","dm","g","Giờ","Gói","ha","Hộp","kg","Kiện","km","kWh","L","Lần","Lô","m","mg","Miếng","ml","m²","m³","Ngày","Năm","Người","Pallet","Phần","Phiếu","Quyển","Ram","Suất","Tấm","Tập","Thanh","Tháng","Thùng","Tờ","Tấn","Túi","Viên","Vé","Xấp"];
  const insert = db.prepare('INSERT OR IGNORE INTO product_attributes (attr_type, value) VALUES (?, ?)');
  categories.forEach(v => insert.run('category', v));
  brands.forEach(v => insert.run('brand', v));
  units.forEach(v => insert.run('unit', v));
  console.log('[migration] Da seed danh sach nhom/thuong hieu/don vi tinh mac dinh');
})();

// Seed cac settings moi (chi them neu chua co, khong ghi de gia tri nguoi dung da tung sua)
(function seedNewSettings() {
  const defaults = {
    company_tax_code: '0318606297',
    company_address: '207/45 Nam Cao, Phường Tăng Nhơn Phú, Thành phố Hồ Chí Minh, Việt Nam',
    company_phone: '0775009101',
    recipient_name: 'Bùi Bảo Châu',
    recipient_phone: '',
    reseller_license_email: '',
    accountant_email: '',
  };
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
  for (const [k, v] of Object.entries(defaults)) upsert.run(k, v);
})();

// Sua 1 lan duy nhat neu company_phone dang de trong (may da cai tu truoc, chua tung nhap) -> dien so that
(function fixCompanyPhoneOnce() {
  const already = db.prepare(`SELECT value FROM settings WHERE key='_fixed_company_phone_v6_7'`).get();
  if (already) return;
  const current = db.prepare(`SELECT value FROM settings WHERE key='company_phone'`).get();
  if (current && !current.value) {
    db.prepare(`UPDATE settings SET value='0775009101' WHERE key='company_phone'`).run();
    console.log('[migration] Da dien so dien thoai cong ty (truoc do dang trong)');
  }
  db.prepare(`INSERT INTO settings (key, value) VALUES ('_fixed_company_phone_v6_7', '1') ON CONFLICT(key) DO NOTHING`).run();
})();

addColumnIfMissing('customers', 'representative_name', 'TEXT');
addColumnIfMissing('customers', 'representative_position', 'TEXT');
addColumnIfMissing('customers', 'bank_account', 'TEXT');
addColumnIfMissing('attachments', 'label', 'TEXT');

addColumnIfMissing('licenses', 'vendor_type', "TEXT DEFAULT 'other'");
// Chuyen du lieu rat cu (is_microsoft dang boolean) sang vendor_type moi, chay TRUOC buoc migrate Tenant ben duoi
try {
  const hasOldCol = db.prepare(`PRAGMA table_info(licenses)`).all().some(c => c.name === 'is_microsoft');
  if (hasOldCol) {
    db.prepare(`UPDATE licenses SET vendor_type='microsoft' WHERE is_microsoft=1 AND (vendor_type IS NULL OR vendor_type='other')`).run();
  }
} catch (e) { /* bo qua neu khong co du lieu cu */ }

addColumnIfMissing('licenses', 'ms_end_user_company_name', 'TEXT');
addColumnIfMissing('licenses', 'ms_end_user_address', 'TEXT');
addColumnIfMissing('licenses', 'ms_end_user_phone', 'TEXT');
addColumnIfMissing('licenses', 'ms_license_manager_name', 'TEXT');
addColumnIfMissing('licenses', 'ms_admin_email', 'TEXT');
addColumnIfMissing('licenses', 'ms_tenant_domain', 'TEXT');
addColumnIfMissing('licenses', 'adsk_end_user_name', 'TEXT');
addColumnIfMissing('licenses', 'adsk_license_email', 'TEXT');
addColumnIfMissing('licenses', 'adsk_manager_email', 'TEXT');
addColumnIfMissing('licenses', 'adsk_contract_id', 'TEXT');
addColumnIfMissing('licenses', 'adsk_subscription_id', 'TEXT');

// Chuyen du lieu cu (luu theo KHACH HANG) sang truc tiep tung dong License (khong con dung chung nua).
// Chi ap dung 1 lan cho cac license chua duoc chuyen (tranh ghi de neu nguoi dung da tu sua rieng).
try {
  const hasOldMsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='customer_ms_tenant'`).get();
  if (hasOldMsTable) {
    const needMigrate = db.prepare(
      `SELECT id, customer_id FROM licenses WHERE vendor_type='microsoft' AND ms_tenant_domain IS NULL AND ms_end_user_company_name IS NULL`
    ).all();
    const getOld = db.prepare('SELECT * FROM customer_ms_tenant WHERE customer_id=?');
    const upd = db.prepare(
      `UPDATE licenses SET ms_end_user_company_name=?, ms_end_user_address=?, ms_end_user_phone=?, ms_license_manager_name=?, ms_admin_email=?, ms_tenant_domain=? WHERE id=?`
    );
    let count = 0;
    needMigrate.forEach(l => {
      const t = getOld.get(l.customer_id);
      if (t) { upd.run(t.end_user_company_name, t.end_user_address, t.end_user_phone, t.license_manager_name, t.admin_email, t.tenant_domain, l.id); count++; }
    });
    if (count) console.log(`[migration] Da chuyen thong tin Tenant Microsoft tu cap Khach hang sang rieng ${count} License`);
  }
} catch (e) { /* bo qua neu khong co du lieu cu */ }

try {
  const hasOldAdskTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='customer_autodesk_profile'`).get();
  if (hasOldAdskTable) {
    const needMigrate = db.prepare(
      `SELECT id, customer_id FROM licenses WHERE vendor_type='autodesk' AND adsk_contract_id IS NULL AND adsk_subscription_id IS NULL`
    ).all();
    const getOld = db.prepare('SELECT * FROM customer_autodesk_profile WHERE customer_id=?');
    const upd = db.prepare(
      `UPDATE licenses SET adsk_end_user_name=?, adsk_license_email=?, adsk_manager_email=?, adsk_contract_id=?, adsk_subscription_id=? WHERE id=?`
    );
    let count = 0;
    needMigrate.forEach(l => {
      const p = getOld.get(l.customer_id);
      if (p) { upd.run(p.end_user_name, p.license_email, p.manager_email, p.contract_id, p.subscription_id, l.id); count++; }
    });
    if (count) console.log(`[migration] Da chuyen thong tin Autodesk tu cap Khach hang sang rieng ${count} License`);
  }
} catch (e) { /* bo qua neu khong co du lieu cu */ }

// Seed du lieu ban dau cho module Quan ly nha tro (chi seed neu bang con trong)
(function seedBoardingHouse() {
  const count = db.prepare('SELECT COUNT(*) as c FROM bt_rooms').get().c;
  if (count > 0) return;

  const insertRoom = db.prepare(
    `INSERT INTO bt_rooms (room_name, room_price, has_electricity_meter, flat_electricity_per_person, management_fee_bundled, electricity_discount, electricity_deduct_room_ids, display_order, is_active)
     VALUES (?,?,?,?,?,?,?,?,1)`
  );
  const r0 = insertRoom.run('Trệt', 2000000, 0, 50000, 0, 0, null, 0).lastInsertRowid;
  const r1 = insertRoom.run('1', 3000000, 1, 0, 0, 0, null, 1).lastInsertRowid;
  const r2 = insertRoom.run('2', 1900000, 1, 0, 0, 0, null, 2).lastInsertRowid;
  const r3 = insertRoom.run('3', 3000000, 1, 0, 1, 0, null, 3).lastInsertRowid;
  const r4 = insertRoom.run('4', 2850000, 1, 0, 0, 0, null, 4).lastInsertRowid;
  const r5 = insertRoom.run('5', 2000000, 1, 0, 0, 50000, null, 5).lastInsertRowid;
  const r6 = insertRoom.run('6', 3000000, 1, 0, 1, 0, JSON.stringify([r3, r4]), 6).lastInsertRowid;

  const insertTenant = db.prepare('INSERT INTO bt_tenants (full_name) VALUES (?)');
  const insertOcc = db.prepare('INSERT INTO bt_room_occupancy (room_id, tenant_id, is_active) VALUES (?,?,1)');

  const assign = (roomId, names) => {
    names.forEach(name => {
      const tid = insertTenant.run(name).lastInsertRowid;
      insertOcc.run(roomId, tid);
    });
  };
  assign(r1, ['Lê Thị Thùy Trang', 'Đoàn Thị Minh Hương']);
  assign(r2, ['Trương Quốc Bảo']);
  assign(r3, ['Bá Chính', 'Dương Hoàng Phát']);
  assign(r4, ['Trương Quang Huy', 'Hồ Thanh Phong']);
  assign(r5, ['Nông Thanh Hải']);
  assign(r6, ['Thông Đức Phúc', 'Hồ Phước Thường']);
  // Phong Tret hien dang trong - khong gan ai ca

  console.log('[migration] Da seed du lieu ban dau module Quan ly nha tro (7 phong, 10 nguoi thue)');
})();

// Them cot moi cho Nhan vien (trinh do hoc van, thong tin ngan hang chi tiet)
addColumnIfMissing('hr_employees', 'education_level', 'TEXT');
addColumnIfMissing('hr_employees', 'bank_name', 'TEXT');
addColumnIfMissing('hr_employees', 'bank_branch', 'TEXT');
addColumnIfMissing('hr_employees', 'bank_account_number', 'TEXT');
addColumnIfMissing('hr_employees', 'bank_account_holder', 'TEXT');
// Chuyen du lieu cu tu cot bank_account (dang 1 dong text tu do) sang bank_account_number, chi lam 1 lan
try {
  const hasOldCol = db.prepare(`PRAGMA table_info(hr_employees)`).all().some(c => c.name === 'bank_account');
  if (hasOldCol) {
    db.prepare(`UPDATE hr_employees SET bank_account_number = bank_account WHERE bank_account IS NOT NULL AND bank_account_number IS NULL`).run();
  }
} catch (e) { /* bo qua neu khong co du lieu cu */ }

// Seed danh sach ngan hang VN vao product_attributes (dung chung co che "danh sach mo rong + them moi" nhu San pham)
(function seedBankList() {
  const count = db.prepare(`SELECT COUNT(*) as c FROM product_attributes WHERE attr_type='bank'`).get().c;
  if (count > 0) return;
  const banks = ['Techcombank', 'MB Bank (MBBank)', 'ACB (Asia Commercial Bank)', 'VPBank', 'Sacombank', 'HDBank', 'SHB', 'TPBank', 'VIB', 'SeABank',
    'OCB', 'MSB (Maritime Bank)', 'LPBank (trước đây là LienVietPostBank)', 'Eximbank', 'Nam A Bank', 'PVcomBank', 'Bac A Bank', 'KienlongBank', 'VietBank', 'NCB'];
  const insert = db.prepare('INSERT OR IGNORE INTO product_attributes (attr_type, value) VALUES (?, ?)');
  banks.forEach(v => insert.run('bank', v));
  console.log('[migration] Da seed danh sach 20 ngan hang VN');
})();

addColumnIfMissing('quotations', 'short_title', 'TEXT');

addColumnIfMissing('bt_tenants', 'id_issue_date', 'TEXT');
addColumnIfMissing('bt_tenants', 'id_issue_place', 'TEXT');
addColumnIfMissing('bt_room_occupancy', 'deposit_amount', 'REAL DEFAULT 0');
addColumnIfMissing('bt_room_occupancy', 'laundry_registered', 'INTEGER DEFAULT 0');
addColumnIfMissing('bt_room_occupancy', 'renewed_from_occupancy_id', 'INTEGER');

(function seedBoardingLandlordSettings() {
  const defaults = {
    boarding_landlord_name: 'BÙI BẢO CHÂU',
    boarding_landlord_dob: '1991-04-04',
    boarding_landlord_address: '66/95 Xô Viết Nghệ Tĩnh, Phường Thạnh Mỹ Tây, TP. Hồ Chí Minh',
    boarding_landlord_phone: '0775009101',
    boarding_house_address: '207/45 Nam Cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh, Việt Nam',
    boarding_landlord_birth_place: '',
    boarding_landlord_id_number: '',
    boarding_landlord_id_issue_date: '',
    boarding_landlord_id_issue_place: '',
  };
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
  for (const [k, v] of Object.entries(defaults)) upsert.run(k, v);
})();

// Sua dung 1 lan duy nhat thong tin chu nha tro cho may DA CAI TU TRUOC (seed o tren chi dien vao neu con thieu,
// khong ghi de gia tri cu sai). Sau lan sua nay, nguoi dung tu sua tiep qua trang Cai dat se khong bi ghi de lai.
(function fixBoardingLandlordInfoOnce() {
  const already = db.prepare(`SELECT value FROM settings WHERE key='_fixed_landlord_info_v6_2'`).get();
  if (already) return;
  const forceSet = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  forceSet.run('boarding_landlord_dob', '1991-04-04');
  forceSet.run('boarding_landlord_address', '66/95 Xô Viết Nghệ Tĩnh, Phường Thạnh Mỹ Tây, TP. Hồ Chí Minh');
  forceSet.run('boarding_house_address', '207/45 Nam Cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh, Việt Nam');
  db.prepare(`DELETE FROM settings WHERE key='boarding_landlord_birth_year'`).run(); // cot cu khong dung nua, thay bang boarding_landlord_dob
  forceSet.run('_fixed_landlord_info_v6_2', '1');
  console.log('[migration] Da sua dung thong tin chu nha tro (ngay sinh day du, dia chi cap nhat)');
})();

// Doi chu nha tro (Ben A trong hop dong thue phong tro) sang nguoi moi + bo sung day du CCCD.
// Chi chay 1 lan duy nhat; sau do neu Chau tu sua lai qua trang Cai dat se KHONG bi ghi de nua
// (giong dung co che cua fixBoardingLandlordInfoOnce ben tren).
(function fixBoardingLandlordInfoOnceV73() {
  const already = db.prepare(`SELECT value FROM settings WHERE key='_fixed_landlord_info_v7_3'`).get();
  if (already) return;
  const forceSet = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  forceSet.run('boarding_landlord_name', 'PHẠM QUỐC ĐẠT');
  forceSet.run('boarding_landlord_dob', '1979-09-14');
  forceSet.run('boarding_landlord_address', 'Ấp Việt Kiều, Hồ Tràm, TP. Hồ Chí Minh');
  forceSet.run('boarding_landlord_phone', '0903601907');
  forceSet.run('boarding_landlord_birth_place', 'Lâm Đồng');
  forceSet.run('boarding_landlord_id_number', '060079000208');
  forceSet.run('boarding_landlord_id_issue_date', '2025-07-07');
  forceSet.run('boarding_landlord_id_issue_place', 'Bộ Công An');
  forceSet.run('_fixed_landlord_info_v7_3', '1');
  console.log('[migration] Da doi thong tin chu nha tro (Ben A hop dong thue tro) sang nguoi moi');
})();

// Sua loi nam bi thieu so 2 dau (VD nguoi dung go "27" nhung o nhap luu thanh "0027" thay vi "2027")
// Ap dung cho ca 2 bang: bt_room_contracts (hop dong nha tro) va bt_room_occupancy (du lieu cu con sot lai)
(function fixMalformedYearsOnce() {
  const already = db.prepare(`SELECT value FROM settings WHERE key='_fixed_malformed_years_v6_3'`).get();
  if (already) return;
  const fixDateStr = (d) => {
    if (!d) return d;
    const m = d.match(/^00(\d{2})-(\d{2})-(\d{2})$/); // dang '00YY-MM-DD' -> doi thanh '20YY-MM-DD'
    return m ? `20${m[1]}-${m[2]}-${m[3]}` : d;
  };
  ['bt_room_contracts', 'bt_room_occupancy'].forEach(table => {
    try {
      const rows = db.prepare(`SELECT id, contract_start_date, contract_end_date FROM ${table} WHERE contract_start_date LIKE '00%' OR contract_end_date LIKE '00%'`).all();
      rows.forEach(r => {
        db.prepare(`UPDATE ${table} SET contract_start_date=?, contract_end_date=? WHERE id=?`)
          .run(fixDateStr(r.contract_start_date), fixDateStr(r.contract_end_date), r.id);
      });
      if (rows.length) console.log(`[migration] Da sua ${rows.length} dong bi loi nam (VD 0027 -> 2027) trong bang ${table}`);
    } catch (e) { /* bang chua ton tai, bo qua */ }
  });
  db.prepare(`INSERT INTO settings (key, value) VALUES ('_fixed_malformed_years_v6_3', '1') ON CONFLICT(key) DO NOTHING`).run();
})();

// Chuyen hop dong tu LUU THEO TUNG NGUOI (ban cu) sang LUU THEO PHONG (ban moi - 1 phong = 1 hop dong chung).
// Chi chay 1 lan, gop du lieu cua tat ca nguoi dang o cung 1 phong thanh 1 ban ghi hop dong duy nhat.
(function migrateContractsToRoomLevel() {
  const hasNewTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bt_room_contracts'`).get();
  if (!hasNewTable) return;
  const alreadyMigrated = db.prepare('SELECT COUNT(*) as c FROM bt_room_contracts').get().c;
  if (alreadyMigrated > 0) return;

  const rooms = db.prepare('SELECT DISTINCT room_id FROM bt_room_occupancy WHERE is_active=1').all();
  let count = 0;
  rooms.forEach(({ room_id }) => {
    const occs = db.prepare('SELECT * FROM bt_room_occupancy WHERE room_id=? AND is_active=1').all(room_id);
    // Gop: lay ngay bat dau som nhat, ngay ket thuc muon nhat, tien coc/thoi han lon nhat da tung nhap,
    // dang ky may giat = co it nhat 1 nguoi da dang ky
    const startDates = occs.map(o => o.contract_start_date).filter(Boolean).sort();
    const endDates = occs.map(o => o.contract_end_date).filter(Boolean).sort();
    const deposit = Math.max(...occs.map(o => o.deposit_amount || 0));
    const laundry = occs.some(o => o.laundry_registered) ? 1 : 0;
    const durationText = occs.map(o => o.contract_duration_text).find(Boolean) || null;
    const minStayText = occs.map(o => o.min_stay_text).find(Boolean) || null;
    db.prepare(
      `INSERT INTO bt_room_contracts (room_id, contract_start_date, contract_end_date, contract_duration_text, min_stay_text, deposit_amount, laundry_registered, is_active)
       VALUES (?,?,?,?,?,?,?,1)`
    ).run(room_id, startDates[0] || null, endDates[endDates.length - 1] || null, durationText, minStayText, deposit, laundry);
    count++;
  });
  if (count) console.log(`[migration] Da gop hop dong tu ${rooms.length} phong (truoc day luu theo tung nguoi) thanh hop dong theo phong. Vui long kiem tra lai ngay/tien coc cua tung phong.`);
})();

module.exports = db;
