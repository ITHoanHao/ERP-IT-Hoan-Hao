const express = require('express');
const dayjs = require('dayjs');
const db = require('../db');
const router = express.Router();

// Sua an toan cac ngay nhap vao co nam bat thuong (VD trinh duyet luu "0027" khi nguoi dung go tat "27") -> tu doi thanh "2027"
function fixYear(dateStr) {
  if (!dateStr) return dateStr;
  const m = String(dateStr).match(/^00(\d{2})-(\d{2}-\d{2})$/);
  return m ? `20${m[1]}-${m[2]}` : dateStr;
}

function getRooms() {
  return db.prepare('SELECT * FROM bt_rooms WHERE is_active=1 ORDER BY display_order').all();
}
function getOccupantCount(roomId) {
  return db.prepare('SELECT COUNT(*) as c FROM bt_room_occupancy WHERE room_id=? AND is_active=1').get(roomId).c;
}
function getOccupants(roomId) {
  return db.prepare(
    `SELECT o.*, t.full_name FROM bt_room_occupancy o JOIN bt_tenants t ON t.id=o.tenant_id WHERE o.room_id=? AND o.is_active=1 ORDER BY o.id`
  ).all(roomId);
}

// ================= DASHBOARD =================
router.get('/', (req, res) => {
  const month = req.query.month || dayjs().format('YYYY-MM');
  const bills = db.prepare(
    `SELECT b.*, r.room_name FROM bt_monthly_bills b JOIN bt_rooms r ON r.id=b.room_id WHERE b.billing_month=? ORDER BY r.display_order`
  ).all(month);
  const revenue = bills.reduce((s, b) => s + b.total_amount, 0);
  const costs = db.prepare('SELECT * FROM bt_monthly_costs WHERE billing_month=?').all(month);
  const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
  const profit = revenue - totalCosts;
  const rooms = getRooms();
  const billedRoomIds = new Set(bills.map(b => b.room_id));
  const roomsNotBilled = rooms.filter(r => !billedRoomIds.has(r.id));

  res.render('boarding/dashboard', { title: 'Quản lý nhà trọ', month, bills, revenue, costs, totalCosts, profit, roomsNotBilled });
});

// ================= ROOMS =================
router.get('/rooms', (req, res) => {
  const rooms = db.prepare('SELECT * FROM bt_rooms ORDER BY display_order').all();
  rooms.forEach(r => { r.occupantCount = getOccupantCount(r.id); });
  res.render('boarding/rooms/list', { title: 'Danh sách phòng trọ', rooms });
});

router.get('/rooms/new', (req, res) => {
  res.render('boarding/rooms/form', { title: 'Thêm phòng trọ', row: {} });
});

router.get('/rooms/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM bt_rooms WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/nhatro/rooms');
  const allRooms = db.prepare('SELECT * FROM bt_rooms WHERE id != ?').all(req.params.id);
  const deductIds = row.electricity_deduct_room_ids ? JSON.parse(row.electricity_deduct_room_ids) : [];
  res.render('boarding/rooms/form', { title: 'Sửa phòng ' + row.room_name, row, allRooms, deductIds });
});

router.post('/rooms', (req, res) => {
  const b = req.body;
  const deductIds = Array.isArray(b.deduct_room_ids) ? b.deduct_room_ids : (b.deduct_room_ids ? [b.deduct_room_ids] : []);
  db.prepare(
    `INSERT INTO bt_rooms (room_name, room_price, has_electricity_meter, flat_electricity_per_person, management_fee_bundled, electricity_discount, electricity_deduct_room_ids, display_order, is_active)
     VALUES (?,?,?,?,?,?,?,?,1)`
  ).run(b.room_name, parseFloat(b.room_price) || 0, b.has_electricity_meter ? 1 : 0, parseFloat(b.flat_electricity_per_person) || 0,
    b.management_fee_bundled ? 1 : 0, parseFloat(b.electricity_discount) || 0, deductIds.length ? JSON.stringify(deductIds) : null, parseInt(b.display_order) || 99);
  res.redirect('/nhatro/rooms');
});

router.post('/rooms/:id', (req, res) => {
  const b = req.body;
  const deductIds = Array.isArray(b.deduct_room_ids) ? b.deduct_room_ids : (b.deduct_room_ids ? [b.deduct_room_ids] : []);
  db.prepare(
    `UPDATE bt_rooms SET room_name=?, room_price=?, has_electricity_meter=?, flat_electricity_per_person=?, management_fee_bundled=?, electricity_discount=?, electricity_deduct_room_ids=?, display_order=?, is_active=?
     WHERE id=?`
  ).run(b.room_name, parseFloat(b.room_price) || 0, b.has_electricity_meter ? 1 : 0, parseFloat(b.flat_electricity_per_person) || 0,
    b.management_fee_bundled ? 1 : 0, parseFloat(b.electricity_discount) || 0, deductIds.length ? JSON.stringify(deductIds) : null,
    parseInt(b.display_order) || 99, b.is_active ? 1 : 0, req.params.id);
  res.redirect('/nhatro/rooms');
});

// ================= TENANTS =================
router.get('/tenants', (req, res) => {
  const tenants = db.prepare('SELECT * FROM bt_tenants ORDER BY id DESC').all();
  tenants.forEach(t => {
    const occ = db.prepare(
      `SELECT r.room_name FROM bt_room_occupancy o JOIN bt_rooms r ON r.id=o.room_id WHERE o.tenant_id=? AND o.is_active=1`
    ).get(t.id);
    t.currentRoom = occ ? occ.room_name : null;
  });
  res.render('boarding/tenants/list', { title: 'Danh sách người thuê trọ', tenants });
});

router.get('/tenants/new', (req, res) => {
  res.render('boarding/tenants/form', { title: 'Thêm người thuê trọ', row: {} });
});

router.get('/tenants/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM bt_tenants WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/nhatro/tenants');
  res.render('boarding/tenants/form', { title: 'Sửa: ' + row.full_name, row });
});

router.post('/tenants', (req, res) => {
  const b = req.body;
  db.prepare(
    `INSERT INTO bt_tenants (full_name, dob, gender, id_number, permanent_address, phone, vehicle_type, license_plate, note) VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.permanent_address || null, b.phone || null, b.vehicle_type || null, b.license_plate || null, b.note || null);
  res.redirect('/nhatro/tenants');
});

router.post('/tenants/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE bt_tenants SET full_name=?, dob=?, gender=?, id_number=?, permanent_address=?, phone=?, vehicle_type=?, license_plate=?, note=? WHERE id=?`
  ).run(b.full_name, b.dob || null, b.gender || null, b.id_number || null, b.permanent_address || null, b.phone || null, b.vehicle_type || null, b.license_plate || null, b.note || null, req.params.id);
  res.redirect('/nhatro/tenants');
});

// ================= OCCUPANCY (gan/chuyen phong) =================
router.get('/occupancy', (req, res) => {
  const rooms = getRooms();
  rooms.forEach(r => { r.occupants = getOccupants(r.id); });
  const allTenants = db.prepare('SELECT * FROM bt_tenants ORDER BY full_name').all();
  res.render('boarding/occupancy', { title: 'Gán phòng cho người thuê', rooms, allTenants });
});

router.post('/occupancy/assign', (req, res) => {
  const b = req.body;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO bt_room_occupancy (room_id, tenant_id, move_in_date, is_active) VALUES (?,?,?,1)`
    ).run(b.room_id, b.tenant_id, b.move_in_date || dayjs().format('YYYY-MM-DD'));

    // Neu phong nay chua co hop dong nao dang hieu luc, tu tao san 1 hop dong trong de vao "Hop dong thue tro" dien tiep
    const existing = db.prepare('SELECT id FROM bt_room_contracts WHERE room_id=? AND is_active=1').get(b.room_id);
    if (!existing) {
      db.prepare(
        `INSERT INTO bt_room_contracts (room_id, contract_start_date, is_active) VALUES (?,?,1)`
      ).run(b.room_id, b.move_in_date || dayjs().format('YYYY-MM-DD'));
    }
  });
  tx();
  res.redirect('/nhatro/occupancy');
});

router.post('/occupancy/:id/move-out', (req, res) => {
  db.prepare(`UPDATE bt_room_occupancy SET is_active=0, move_out_date=? WHERE id=?`).run(dayjs().format('YYYY-MM-DD'), req.params.id);
  res.redirect('/nhatro/occupancy');
});

// ================= BILLING (nhap so dien + tinh tien hang thang) =================
router.get('/billing/:month', (req, res) => {
  const month = req.params.month;
  const rooms = getRooms();
  rooms.forEach(r => {
    r.occupantCount = getOccupantCount(r.id);
    r.bill = db.prepare('SELECT * FROM bt_monthly_bills WHERE room_id=? AND billing_month=?').get(r.id, month);
    if (!r.bill) {
      // Tu dong lay so dien cu = so dien moi cua thang truoc (neu co)
      const prevMonth = dayjs(month + '-01').subtract(1, 'month').format('YYYY-MM');
      const prevBill = db.prepare('SELECT electricity_new FROM bt_monthly_bills WHERE room_id=? AND billing_month=?').get(r.id, prevMonth);
      r.prevElectricityNew = prevBill ? prevBill.electricity_new : null;
    }
  });
  res.render('boarding/billing', { title: 'Nhập số điện & tính tiền - Tháng ' + month, month, rooms });
});

router.post('/billing/:month', (req, res) => {
  const month = req.params.month;
  const b = req.body;
  const rooms = db.prepare('SELECT * FROM bt_rooms WHERE is_active=1').all();
  const roomsById = Object.fromEntries(rooms.map(r => [String(r.id), r]));

  // Buoc 1: tinh so dien (kWh) cho cac phong KHONG phu thuoc phong khac
  const kwhByRoom = {};
  rooms.forEach(r => {
    if (r.electricity_deduct_room_ids) return; // xu ly sau (Buoc 2)
    if (!r.has_electricity_meter) return; // tinh phang theo dau nguoi, khong co kWh
    const oldR = parseFloat(b['old_' + r.id]);
    const newR = parseFloat(b['new_' + r.id]);
    if (!isNaN(oldR) && !isNaN(newR)) kwhByRoom[r.id] = Math.max(0, newR - oldR);
  });

  // Buoc 2: tinh cac phong PHU THUOC (vd Phong 6 tru Phong 3, Phong 4)
  rooms.forEach(r => {
    if (!r.electricity_deduct_room_ids) return;
    const oldR = parseFloat(b['old_' + r.id]);
    const newR = parseFloat(b['new_' + r.id]);
    if (isNaN(oldR) || isNaN(newR)) return;
    let kwh = Math.max(0, newR - oldR);
    const deductIds = JSON.parse(r.electricity_deduct_room_ids);
    deductIds.forEach(rid => { kwh -= (kwhByRoom[rid] || 0); });
    kwhByRoom[r.id] = Math.max(0, kwh);
  });

  const tx = db.transaction(() => {
    rooms.forEach(r => {
      const occupants = parseInt(b['occupants_' + r.id]) || getOccupantCount(r.id);
      const waterOcc = b['water_occ_' + r.id] !== undefined ? parseInt(b['water_occ_' + r.id]) || 0 : occupants;
      const laundryOcc = parseInt(b['laundry_occ_' + r.id]) || 0;
      const mgmtOcc = b['mgmt_occ_' + r.id] !== undefined ? parseInt(b['mgmt_occ_' + r.id]) || 0 : occupants;
      const roomPrice = parseFloat(b['room_price_' + r.id]) || r.room_price;
      const miscAmount = parseFloat(b['misc_' + r.id]) || 0;
      const miscNote = b['misc_note_' + r.id] || '';

      let electricityAmount = 0, kwh = null, oldR = null, newR = null;
      if (r.has_electricity_meter) {
        oldR = parseFloat(b['old_' + r.id]);
        newR = parseFloat(b['new_' + r.id]);
        if (!isNaN(oldR) && !isNaN(newR)) {
          kwh = kwhByRoom[r.id] !== undefined ? kwhByRoom[r.id] : Math.max(0, newR - oldR);
          electricityAmount = Math.max(0, kwh * 3000 - (r.electricity_discount || 0));
        }
      } else {
        electricityAmount = occupants * (r.flat_electricity_per_person || 50000);
      }

      const waterAmount = waterOcc * 100000;
      const laundryAmount = laundryOcc * 50000;
      const managementAmount = r.management_fee_bundled ? 0 : mgmtOcc * 100000;
      const total = roomPrice + electricityAmount + waterAmount + laundryAmount + managementAmount + miscAmount;

      db.prepare(
        `INSERT INTO bt_monthly_bills (room_id, billing_month, room_price, electricity_old, electricity_new, electricity_kwh, electricity_rate, electricity_amount,
           water_occupants, water_rate, water_amount, laundry_occupants, laundry_rate, laundry_amount, management_occupants, management_rate, management_amount,
           misc_amount, misc_note, total_amount, payment_status)
         VALUES (?,?,?,?,?,?,3000,?,?,100000,?,?,50000,?,?,100000,?,?,?,?,'unpaid')
         ON CONFLICT(room_id, billing_month) DO UPDATE SET
           room_price=excluded.room_price, electricity_old=excluded.electricity_old, electricity_new=excluded.electricity_new,
           electricity_kwh=excluded.electricity_kwh, electricity_amount=excluded.electricity_amount,
           water_occupants=excluded.water_occupants, water_amount=excluded.water_amount,
           laundry_occupants=excluded.laundry_occupants, laundry_amount=excluded.laundry_amount,
           management_occupants=excluded.management_occupants, management_amount=excluded.management_amount,
           misc_amount=excluded.misc_amount, misc_note=excluded.misc_note, total_amount=excluded.total_amount`
      ).run(r.id, month, roomPrice, oldR, newR, kwh, electricityAmount, waterOcc, waterAmount, laundryOcc, laundryAmount, mgmtOcc, managementAmount, miscAmount, miscNote, total);
    });
  });
  tx();
  res.redirect('/nhatro?month=' + month);
});

router.post('/billing/:month/:roomId/mark-paid', (req, res) => {
  db.prepare(`UPDATE bt_monthly_bills SET payment_status='paid' WHERE room_id=? AND billing_month=?`).run(req.params.roomId, req.params.month);
  res.redirect('/nhatro?month=' + req.params.month);
});

// ================= CHI PHI VAN HANH HANG THANG =================
const COST_TYPES = [
  ['rent_landlord', 'Tiền thuê nguyên căn (anh Đạt)'],
  ['electricity_bill', 'Tiền điện (hóa đơn thực tế)'],
  ['water_bill', 'Tiền nước (hóa đơn thực tế)'],
  ['trash', 'Tiền rác'],
  ['internet', 'Tiền internet'],
  ['police', 'Tiền công an / ANTT'],
  ['other', 'Chi phí khác'],
];

router.get('/costs/:month', (req, res) => {
  const month = req.params.month;
  const existing = db.prepare('SELECT * FROM bt_monthly_costs WHERE billing_month=?').all(month);
  const byType = Object.fromEntries(existing.map(c => [c.cost_type, c]));
  res.render('boarding/costs', { title: 'Chi phí vận hành - Tháng ' + month, month, COST_TYPES, byType });
});

router.post('/costs/:month', (req, res) => {
  const month = req.params.month;
  const b = req.body;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM bt_monthly_costs WHERE billing_month=?').run(month);
    const insert = db.prepare('INSERT INTO bt_monthly_costs (billing_month, cost_type, amount, note) VALUES (?,?,?,?)');
    COST_TYPES.forEach(([type]) => {
      const amount = parseFloat(b['amount_' + type]) || 0;
      if (amount > 0) insert.run(month, type, amount, b['note_' + type] || '');
    });
  });
  tx();
  res.redirect('/nhatro?month=' + month);
});

// ================= BAO CAO LOI NHUAN NHIEU THANG =================
router.get('/reports', (req, res) => {
  const months = db.prepare(
    `SELECT DISTINCT billing_month FROM bt_monthly_bills
     UNION SELECT DISTINCT billing_month FROM bt_monthly_costs
     ORDER BY billing_month DESC LIMIT 12`
  ).all().map(r => r.billing_month);

  const data = months.map(month => {
    const revenue = db.prepare('SELECT COALESCE(SUM(total_amount),0) as t FROM bt_monthly_bills WHERE billing_month=?').get(month).t;
    const costs = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM bt_monthly_costs WHERE billing_month=?').get(month).t;
    return { month, revenue, costs, profit: revenue - costs };
  });
  res.render('boarding/reports', { title: 'Báo cáo lợi nhuận nhà trọ', data });
});

router.get('/billing/:month/:roomId/pdf', (req, res) => {
  const room = db.prepare('SELECT * FROM bt_rooms WHERE id=?').get(req.params.roomId);
  const bill = db.prepare('SELECT * FROM bt_monthly_bills WHERE room_id=? AND billing_month=?').get(req.params.roomId, req.params.month);
  if (!room || !bill) return res.redirect('/nhatro?month=' + req.params.month);
  const occupants = getOccupants(room.id);
  const settings = db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
  const { generateBoardingBillPdf } = require('../lib/boardingPdf');
  generateBoardingBillPdf(res, room, bill, occupants, req.params.month, settings);
});

// ================= HOP DONG THUE TRO (theo PHONG - 1 hop dong = tat ca nguoi trong phong) =================
function getBoardingSettings() {
  return db.prepare('SELECT key, value FROM settings').all().reduce((a, r) => (a[r.key] = r.value, a), {});
}
function getRoomTenants(roomId) {
  return db.prepare(
    `SELECT t.* FROM bt_room_occupancy o JOIN bt_tenants t ON t.id=o.tenant_id WHERE o.room_id=? AND o.is_active=1 ORDER BY o.id`
  ).all(roomId);
}

router.get('/contracts', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, r.room_name FROM bt_room_contracts c JOIN bt_rooms r ON r.id=c.room_id WHERE c.is_active=1 ORDER BY r.display_order`
  ).all();
  const today = dayjs();
  rows.forEach(r => {
    r.daysLeft = r.contract_end_date ? dayjs(r.contract_end_date).diff(today, 'day') : null;
    r.tenants = getRoomTenants(r.room_id);
  });
  res.render('boarding/contracts/list', { title: 'Hợp đồng thuê trọ', rows });
});

router.get('/contracts/:id/edit', (req, res) => {
  const row = db.prepare('SELECT * FROM bt_room_contracts WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/nhatro/contracts');
  const room = db.prepare('SELECT * FROM bt_rooms WHERE id=?').get(row.room_id);
  const tenants = getRoomTenants(row.room_id);
  res.render('boarding/contracts/form', { title: 'Sửa hợp đồng - Phòng ' + room.room_name, row, room, tenants, renewFromId: null });
});

router.post('/contracts/:id', (req, res) => {
  const b = req.body;
  db.prepare(
    `UPDATE bt_room_contracts SET contract_start_date=?, contract_end_date=?, contract_duration_text=?, min_stay_text=?, deposit_amount=?, laundry_registered=? WHERE id=?`
  ).run(fixYear(b.contract_start_date) || null, fixYear(b.contract_end_date) || null, b.contract_duration_text || null, b.min_stay_text || null,
    parseFloat(b.deposit_amount) || 0, b.laundry_registered ? 1 : 0, req.params.id);

  const tenantIds = Array.isArray(b.tenant_id) ? b.tenant_id : (b.tenant_id ? [b.tenant_id] : []);
  tenantIds.forEach(tid => {
    db.prepare(
      `UPDATE bt_tenants SET dob=?, gender=?, id_number=?, id_issue_date=?, id_issue_place=?, permanent_address=?, phone=? WHERE id=?`
    ).run(b['dob_' + tid] || null, b['gender_' + tid] || null, b['id_number_' + tid] || null, b['id_issue_date_' + tid] || null,
      b['id_issue_place_' + tid] || null, b['permanent_address_' + tid] || null, b['phone_' + tid] || null, tid);
  });
  res.redirect('/nhatro/contracts');
});

// Gia han hop dong = tao dong hop dong MOI cho CUNG PHONG (giu nguyen nhung nguoi dang o), danh dau hop dong cu la da nghi
router.get('/contracts/:id/renew', (req, res) => {
  const old = db.prepare('SELECT * FROM bt_room_contracts WHERE id=?').get(req.params.id);
  if (!old) return res.redirect('/nhatro/contracts');
  const room = db.prepare('SELECT * FROM bt_rooms WHERE id=?').get(old.room_id);
  const tenants = getRoomTenants(old.room_id);
  const row = {
    contract_start_date: old.contract_end_date ? dayjs(old.contract_end_date).add(1, 'day').format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    contract_end_date: old.contract_end_date ? dayjs(old.contract_end_date).add(1, 'year').format('YYYY-MM-DD') : '',
    contract_duration_text: old.contract_duration_text, min_stay_text: old.min_stay_text,
    deposit_amount: old.deposit_amount, laundry_registered: old.laundry_registered,
  };
  res.render('boarding/contracts/form', { title: 'Gia hạn hợp đồng - Phòng ' + room.room_name, row, room, tenants, renewFromId: old.id });
});

router.post('/contracts/:id/renew', (req, res) => {
  const b = req.body;
  const old = db.prepare('SELECT * FROM bt_room_contracts WHERE id=?').get(req.params.id);
  if (!old) return res.redirect('/nhatro/contracts');

  const tenantIds = Array.isArray(b.tenant_id) ? b.tenant_id : (b.tenant_id ? [b.tenant_id] : []);
  tenantIds.forEach(tid => {
    db.prepare(
      `UPDATE bt_tenants SET dob=?, gender=?, id_number=?, id_issue_date=?, id_issue_place=?, permanent_address=?, phone=? WHERE id=?`
    ).run(b['dob_' + tid] || null, b['gender_' + tid] || null, b['id_number_' + tid] || null, b['id_issue_date_' + tid] || null,
      b['id_issue_place_' + tid] || null, b['permanent_address_' + tid] || null, b['phone_' + tid] || null, tid);
  });

  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO bt_room_contracts (room_id, contract_start_date, contract_end_date, contract_duration_text, min_stay_text, deposit_amount, laundry_registered, renewed_from_contract_id, is_active)
       VALUES (?,?,?,?,?,?,?,?,1)`
    ).run(old.room_id, fixYear(b.contract_start_date) || dayjs().format('YYYY-MM-DD'), fixYear(b.contract_end_date) || null,
      b.contract_duration_text || null, b.min_stay_text || null, parseFloat(b.deposit_amount) || 0, b.laundry_registered ? 1 : 0, old.id);
    db.prepare(`UPDATE bt_room_contracts SET is_active=0 WHERE id=?`).run(old.id);
    return info.lastInsertRowid;
  });
  tx();
  res.redirect('/nhatro/contracts');
});

// Cham dut hop dong = cham dut ca hop dong VA tat ca nguoi dang o trong phong do (vi hop dong la chung ca phong)
router.post('/contracts/:id/terminate', (req, res) => {
  const contract = db.prepare('SELECT * FROM bt_room_contracts WHERE id=?').get(req.params.id);
  if (!contract) return res.redirect('/nhatro/contracts');
  const tx = db.transaction(() => {
    db.prepare(`UPDATE bt_room_contracts SET is_active=0 WHERE id=?`).run(contract.id);
    db.prepare(`UPDATE bt_room_occupancy SET is_active=0, move_out_date=? WHERE room_id=? AND is_active=1`)
      .run(dayjs().format('YYYY-MM-DD'), contract.room_id);
  });
  tx();
  res.redirect('/nhatro/contracts');
});

router.get('/contracts/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT * FROM bt_room_contracts WHERE id=?').get(req.params.id);
  if (!row) return res.redirect('/nhatro/contracts');
  const room = db.prepare('SELECT * FROM bt_rooms WHERE id=?').get(row.room_id);
  const tenants = getRoomTenants(row.room_id);
  const settings = getBoardingSettings();
  const { generateBoardingContractPdf } = require('../lib/boardingContractPdf');
  generateBoardingContractPdf(res, row, tenants, room, settings);
});

module.exports = router;
