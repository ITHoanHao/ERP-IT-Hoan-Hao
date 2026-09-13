const PDFDocument = require('pdfkit');
const path = require('path');
const { numberToVietnameseWords } = require('./numberToWords');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const MARGIN = 50;
const PAGE_BOTTOM = 780;
const CONTENT_WIDTH = 495;

function money(n) {
  return Math.round(n || 0).toLocaleString('vi-VN');
}
// Loai bo dau tieng Viet + ky tu dac biet de dat ten file an toan trong HTTP header (Content-Disposition)
function safeFilenamePart(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bo dau
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\-_]/g, '_');
}
function vnDate(d) {
  if (!d) return '......';
  const [y, m, day] = d.split('-');
  return `ngày ${parseInt(day)} tháng ${parseInt(m)} năm ${y}`;
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > PAGE_BOTTOM) doc.addPage();
}
function para(doc, text, opts = {}) {
  const { bold = false, size = 10, align = 'justify', spaceAfter = 8 } = opts;
  doc.font(bold ? 'vn-bold' : 'vn').fontSize(size);
  const h = doc.heightOfString(text, { width: CONTENT_WIDTH, align });
  ensureSpace(doc, h + spaceAfter);
  doc.text(text, MARGIN, doc.y, { width: CONTENT_WIDTH, align });
  doc.y += spaceAfter;
}
function heading(doc, text) {
  ensureSpace(doc, 25);
  doc.font('vn-bold').fontSize(11).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.y += 8;
}

function generateBoardingContractPdf(res, contract, tenants, room, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  res.setHeader('Content-Type', 'application/pdf');
  const tenantNamesForFile = tenants.map(t => safeFilenamePart(t.full_name)).join('-') || 'ChuaCoNguoiThue';
  res.setHeader('Content-Disposition', `attachment; filename="HopDong-Phong${safeFilenamePart(room.room_name)}-${tenantNamesForFile}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  doc.font('vn-bold').fontSize(13).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 0, 45, { align: 'center', width: 595 });
  doc.fontSize(11).text('Độc lập - Tự do - Hạnh phúc', 0, 64, { align: 'center', width: 595 });
  doc.font('vn-bold').fontSize(15).text('HỢP ĐỒNG THUÊ PHÒNG TRỌ', 0, 95, { align: 'center', width: 595 });

  doc.y = 125;
  para(doc, `Hôm nay ngày ...... tháng ...... năm 20......; tại địa chỉ: ${settings.boarding_house_address || '......................................'}`);
  para(doc, 'Chúng tôi gồm:', { bold: true });

  para(doc, '1. Đại diện bên cho thuê phòng trọ (Bên A):', { bold: true });
  para(doc, `Ông/bà: ${settings.boarding_landlord_name || ''}   Sinh ngày: ${settings.boarding_landlord_dob ? vnDate(settings.boarding_landlord_dob) : ''}`);
  para(doc, `Nơi đăng ký khai sinh: ${settings.boarding_landlord_birth_place || ''}`);
  para(doc, `Nơi cư trú: ${settings.boarding_landlord_address || ''}`);
  para(doc, `Số CCCD: ${settings.boarding_landlord_id_number || ''}  Ngày cấp: ${settings.boarding_landlord_id_issue_date ? vnDate(settings.boarding_landlord_id_issue_date) : ''}  Nơi cấp: ${settings.boarding_landlord_id_issue_place || ''}`);
  para(doc, `Số điện thoại: ${settings.boarding_landlord_phone || ''}`);

  para(doc, `2. Bên thuê phòng trọ (Bên B) — gồm ${tenants.length || 0} người cùng ký:`, { bold: true });
  if (tenants.length === 0) {
    para(doc, '(Chưa có người thuê nào được gán vào phòng này)');
  }
  tenants.forEach((tenant, idx) => {
    para(doc, `${idx + 1}. Ông/bà: ${tenant.full_name}   Sinh ngày: ${tenant.dob ? vnDate(tenant.dob) : '......................'}`, { bold: true, spaceAfter: 4 });
    para(doc, `Nơi đăng ký HK thường trú: ${tenant.permanent_address || '......................................'}`, { spaceAfter: 4 });
    para(doc, `Số CMND/CCCD: ${tenant.id_number || '......................'}  cấp ngày: ${tenant.id_issue_date ? vnDate(tenant.id_issue_date) : '...../...../......'}  tại: ${tenant.id_issue_place || '......................'}`, { spaceAfter: 4 });
    para(doc, `Số điện thoại: ${tenant.phone || '......................'}`, { spaceAfter: 10 });
  });

  para(doc, 'Sau khi bàn bạc trên tinh thần dân chủ, các bên cùng có lợi, cùng thống nhất như sau:', { bold: true });

  para(doc, `Bên A đồng ý cho bên B (gồm tất cả những người có tên ở trên) thuê 01 phòng ở tại địa chỉ: ${settings.boarding_house_address || '......................................'} — Phòng ${room.room_name}.`);

  const priceWords = numberToVietnameseWords(room.room_price);
  para(doc, `Giá thuê: ${money(room.room_price)} đ/tháng (${priceWords}).`);
  para(doc, 'Tiền điện 3.000 VNĐ/kWh tính theo chỉ số công tơ, thanh toán vào cuối các tháng.');
  para(doc, 'Tiền nước: 100.000 VNĐ/người, thanh toán vào đầu các tháng.');
  para(doc, `Tiền máy giặt: 50.000 VNĐ/người/tháng. ⇒ ${contract.laundry_registered ? 'Có đăng ký ☑' : 'Có đăng ký ☐'}`);
  para(doc, `Tiền đặt cọc: ${contract.deposit_amount ? money(contract.deposit_amount) + ' đ (' + numberToVietnameseWords(contract.deposit_amount) + ')' : '......................................'}`);

  const durationText = contract.contract_duration_text ||
    (contract.contract_start_date && contract.contract_end_date
      ? Math.round(require('dayjs')(contract.contract_end_date).diff(require('dayjs')(contract.contract_start_date), 'month') / 12) + ' năm'
      : '........ năm');
  para(doc, `Hợp đồng có giá trị ${durationText} kể từ ${contract.contract_start_date ? vnDate(contract.contract_start_date) : '...... tháng ...... năm 20....'} đến ${contract.contract_end_date ? vnDate(contract.contract_end_date) : '...... tháng ...... năm 20....'}.`);

  heading(doc, 'TRÁCH NHIỆM CỦA CÁC BÊN');
  para(doc, '* Trách nhiệm của bên A:', { bold: true });
  para(doc, '- Tạo mọi điều kiện thuận lợi để bên B thực hiện theo hợp đồng.');
  para(doc, '- Cung cấp nguồn điện, nước, wifi cho bên B sử dụng.');
  para(doc, '- Xác nhận hiện trạng phòng trọ vào thời điểm bắt đầu cho thuê trọ, và thông báo cho bên B biết rõ.');

  para(doc, '* Trách nhiệm của bên B:', { bold: true });
  para(doc, '- Thanh toán đầy đủ các khoản tiền theo đúng thỏa thuận.');
  para(doc, '(Ngày thanh toán tiền là ngày 1 đến ngày 5 hàng tháng. Nếu chậm thanh toán tiền mà không báo trước cho bên A, bên A có quyền chấm dứt hợp đồng và không trả tiền cọc cho bên B).');
  para(doc, '- Bảo quản các trang thiết bị và cơ sở vật chất của bên A trang bị cho ban đầu (làm hỏng phải sửa, mất phải đền). Xác nhận hiện trạng phòng trọ vào thời điểm bắt đầu thuê trọ. Khi bên B dọn đi thì phải phục hồi nguyên trạng phòng trọ cho bên A.');
  para(doc, '- Không được tự ý sửa chữa, cải tạo cơ sở vật chất khi chưa được sự đồng ý của bên A.');
  para(doc, '- Không được tự ý sử dụng khuôn viên khác ngoài phòng trọ, nhà để xe và khu sinh hoạt chung, nếu chưa được sự đồng ý của bên A.');
  para(doc, '- Giữ gìn vệ sinh trong và ngoài khuôn viên của phòng trọ.');
  para(doc, '- Bên B phải chấp hành mọi quy định của pháp luật Nhà nước và quy định của địa phương.');
  para(doc, '- Nếu bên B cho khách ở qua đêm thì phải báo và được sự đồng ý của chủ nhà đồng thời phải chịu trách nhiệm về các hành vi vi phạm pháp luật của khách trong thời gian ở lại.');

  heading(doc, 'TRÁCH NHIỆM CHUNG');
  para(doc, '- Hai bên phải tạo điều kiện cho nhau thực hiện hợp đồng.');
  para(doc, '- Trong thời gian hợp đồng còn hiệu lực nếu bên nào vi phạm các điều khoản đã thỏa thuận thì bên còn lại có quyền đơn phương chấm dứt hợp đồng; nếu sự vi phạm hợp đồng đó gây tổn thất cho bên bị vi phạm hợp đồng thì bên vi phạm hợp đồng phải bồi thường thiệt hại.');
  para(doc, '- Một trong hai bên muốn chấm dứt hợp đồng trước thời hạn thì phải báo trước cho bên kia ít nhất 30 ngày và hai bên phải có sự thống nhất.');
  para(doc, '- Bên A chấm dứt hợp đồng trước thời hạn 30 ngày mà không thông báo cho bên B thì phải bồi thường thiệt hại cho bên B.');
  para(doc, '- Bên B chấm dứt hợp đồng trước thời hạn 30 ngày mà không thông báo cho bên A thì bị mất tiền đặt cọc cho bên A.');
  para(doc, '- Đôi bên phải có trách nhiệm thực hiện hợp đồng này ít nhất 02 tháng trước khi muốn chấm dứt hợp đồng.');
  para(doc, '- Bên nào vi phạm điều khoản chung thì phải chịu trách nhiệm trước pháp luật.');
  para(doc, '- Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ một bản.');

  ensureSpace(doc, 60 + tenants.length * 45);
  doc.y += 20;
  const signStartY = doc.y;
  doc.font('vn-bold').fontSize(10).text('ĐẠI DIỆN BÊN B', MARGIN, signStartY, { width: 220, align: 'center' });
  doc.text('ĐẠI DIỆN BÊN A', MARGIN + 275, signStartY, { width: 220, align: 'center' });
  let sigY = signStartY + 20;
  if (tenants.length === 0) {
    doc.font('vn').fontSize(9).text('(Chưa có người thuê)', MARGIN, sigY, { width: 220, align: 'center' });
  }
  tenants.forEach((tenant, idx) => {
    doc.font('vn').fontSize(9).text(`${idx + 1}. ${tenant.full_name}`, MARGIN, sigY, { width: 220, align: 'center' });
    sigY += 45;
  });

  doc.end();
}

function dayjsFallback() {
  return require('dayjs')().format('YYYY-MM-DD');
}

module.exports = { generateBoardingContractPdf };
