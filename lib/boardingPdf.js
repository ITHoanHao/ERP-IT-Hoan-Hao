const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

function money(n) {
  return Math.round(n || 0).toLocaleString('vi-VN');
}
function safeFilenamePart(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\-_]/g, '_');
}
const MONTH_NAMES_VI = null; // khong can, dung so thang truc tiep

function generateBoardingBillPdf(res, room, bill, occupants, month, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ThongBao-Phong${safeFilenamePart(room.room_name)}-${month}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  const [year, mon] = month.split('-');
  const monthLabel = `Tháng ${parseInt(mon)}/${year}`;
  const mainTenant = occupants[0] ? occupants[0].full_name : '';
  const idNumber = occupants[0] ? (occupants[0].id_number || '') : '';

  doc.font('vn-bold').fontSize(15).text('THÔNG BÁO TIỀN PHÒNG TRỌ', 0, 45, { align: 'center', width: 495 });
  doc.font('vn-bold').fontSize(11).text(monthLabel, 0, 68, { align: 'center', width: 495 });

  let y = 100;
  doc.font('vn').fontSize(10);
  doc.text('Gửi :', 50, y, { continued: true }).font('vn-bold').text('  ' + mainTenant, { continued: true });
  doc.font('vn').text('          CMND số: ' + idNumber);
  y += 25;
  doc.text('Ở phòng số:', 50, y, { continued: true }).font('vn-bold').text('  ' + room.room_name);
  y += 25;

  doc.font('vn').text('Anh thông báo các em biết, tiền thuê phòng và các chi phí dịch vụ khác', 50, y, { width: 495 });
  y += 15;
  doc.text(`trong ${monthLabel} .Cụ thể như sau:`, 50, y, { width: 495 });
  y += 25;

  // ---- Bang chi tiet ----
  const colX = { stt: 50, khoan: 80, chitiet: 160, thanhtien: 460 };
  const tableRight = 545;

  function drawRow(yy, cells, opts = {}) {
    const h = opts.height || 24;
    doc.rect(50, yy, tableRight - 50, h).stroke();
    doc.font(opts.bold ? 'vn-bold' : 'vn').fontSize(9);
    if (cells.stt !== undefined) doc.text(cells.stt, colX.stt + 3, yy + 7, { width: 25 });
    if (cells.khoan !== undefined) doc.text(cells.khoan, colX.khoan, yy + 7, { width: 75 });
    if (cells.chitiet !== undefined) doc.text(cells.chitiet, colX.chitiet, yy + 7, { width: 295, align: cells.chitietAlign || 'left' });
    if (cells.thanhtien !== undefined) doc.text(cells.thanhtien, colX.thanhtien, yy + 7, { width: 80, align: 'right' });
    return yy + h;
  }

  y = drawRow(y, { stt: 'STT', khoan: 'Khoản', chitiet: 'Chi tiết', thanhtien: 'Thành Tiền' }, { bold: true });
  y = drawRow(y, { stt: '1', khoan: 'Phòng', thanhtien: money(bill.room_price) });

  let electricityDetail = '';
  if (room.has_electricity_meter) {
    if (bill.electricity_kwh !== null && bill.electricity_old !== null) {
      electricityDetail = `( ${bill.electricity_new} - ${bill.electricity_old} ) = ${Math.round(bill.electricity_kwh)}Kw x 3.000 đ/Kw`;
      if (room.electricity_discount > 0) electricityDetail += ` - ${money(room.electricity_discount)} đ`;
    }
  } else {
    electricityDetail = `${bill.water_occupants || occupants.length} người x ${money(room.flat_electricity_per_person)}`;
  }
  y = drawRow(y, { stt: '2', khoan: 'Điện', chitiet: electricityDetail, thanhtien: money(bill.electricity_amount) });
  y = drawRow(y, { stt: '3', khoan: 'Nước', chitiet: bill.water_occupants ? `${bill.water_occupants} người x 100.000` : '', thanhtien: money(bill.water_amount) });
  if (bill.laundry_amount > 0 || bill.laundry_occupants > 0) {
    y = drawRow(y, { stt: '4', khoan: 'Máy giặt', chitiet: bill.laundry_occupants ? `${bill.laundry_occupants} người x 50.000` : '', thanhtien: money(bill.laundry_amount) });
  }
  if (bill.misc_amount > 0) {
    y = drawRow(y, { stt: '5', khoan: bill.misc_note || 'Khác', thanhtien: money(bill.misc_amount) });
  }

  const cong = bill.room_price + bill.electricity_amount + bill.water_amount + bill.laundry_amount + bill.misc_amount;
  y = drawRow(y, { khoan: '', chitiet: 'Cộng:', chitietAlign: 'right', thanhtien: money(cong) }, { bold: true });

  y += 20;
  doc.font('vn').fontSize(10).text('Phần Thanh toán:', 50, y, { underline: true });
  y += 20;

  if (!room.management_fee_bundled && bill.management_amount > 0) {
    doc.text('-Phí quản lý, ANTT, PCCC:', 50, y, { continued: false });
    doc.text(money(bill.management_amount), 400, y, { width: 145, align: 'right' });
    y += 18;
  }
  doc.text('-Phải trả tháng này:', 50, y);
  doc.text(money(cong), 400, y, { width: 145, align: 'right' });
  y += 18;

  doc.font('vn-bold').text('Tổng Cộng:', 100, y);
  doc.text(money(bill.total_amount), 400, y, { width: 145, align: 'right' });
  y += 25;

  doc.font('vn').text('Chi tiết thanh toán:', 50, y);
  y += 60;
  doc.moveTo(50, y).lineTo(545, y).dash(2, { space: 2 }).stroke();
  y += 25;
  doc.moveTo(50, y).lineTo(545, y).stroke();

  y += 60;
  doc.undash();
  doc.font('vn-bold').fontSize(10).text('Quản lý Nhà trọ', 60, y, { width: 200, align: 'center' });
  doc.text('Người Trọ', 340, y, { width: 200, align: 'center' });

  doc.end();
}

module.exports = { generateBoardingBillPdf };
