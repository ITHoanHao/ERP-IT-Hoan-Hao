const PDFDocument = require('pdfkit');
const path = require('path');
const dayjs = require('dayjs');
const { numberToVietnameseWords } = require('./numberToWords');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

const MARGIN = 50;
const PAGE_BOTTOM = 780;
const CONTENT_WIDTH = 495;

function money(n) {
  return Math.round(n || 0).toLocaleString('vi-VN');
}
function vnDateWords(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `ngày ${parseInt(day)} tháng ${parseInt(m)} năm ${y}`;
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > PAGE_BOTTOM) doc.addPage();
}

function para(doc, text, opts = {}) {
  const { bold = false, size = 10, align = 'justify', indent = 0, spaceAfter = 8 } = opts;
  doc.font(bold ? 'vn-bold' : 'vn').fontSize(size);
  const width = CONTENT_WIDTH - indent;
  const h = doc.heightOfString(text, { width, align });
  ensureSpace(doc, h + spaceAfter);
  doc.text(text, MARGIN + indent, doc.y, { width, align });
  doc.y += spaceAfter;
}

function heading(doc, text) {
  ensureSpace(doc, 25);
  doc.font('vn-bold').fontSize(11);
  doc.text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.y += 8;
}

// Bang hang hoa gon - hien gia DA GOM VAT truc tiep (dung phong cach mau KTC, khong tach rieng dong thue)
function drawItemsTable(doc, lines) {
  const colX = { stt: 50, name: 90, sl: 340, price: 380, amount: 460 };
  const tableRight = 545;
  ensureSpace(doc, 60);
  let y = doc.y;

  function header(yy) {
    doc.font('vn-bold').fontSize(8);
    doc.rect(50, yy, tableRight - 50, 24).stroke();
    doc.text('Stt', colX.stt + 2, yy + 8, { width: 35 });
    doc.text('Tên hàng hóa, thông số, cấu hình', colX.name, yy + 8, { width: 245 });
    doc.text('SL', colX.sl, yy + 8, { width: 35, align: 'center' });
    doc.text('Đơn giá', colX.price, yy + 8, { width: 75, align: 'right' });
    doc.text('Thành tiền', colX.amount, yy + 8, { width: 80, align: 'right' });
    return yy + 24;
  }

  y = header(y);
  doc.font('vn').fontSize(8);
  let total = 0;
  lines.forEach((l, idx) => {
    const name = l.product_name || l.description || '';
    const nameHeight = doc.heightOfString(name, { width: 243 });
    const rh = Math.max(22, nameHeight + 8);
    if (y + rh > PAGE_BOTTOM) { doc.addPage(); y = MARGIN; y = header(y); doc.font('vn').fontSize(8); }
    doc.rect(50, y, tableRight - 50, rh).stroke();
    doc.text(String(idx + 1), colX.stt + 2, y + 6, { width: 35 });
    doc.text(name, colX.name, y + 6, { width: 245 });
    doc.text(String(l.quantity), colX.sl, y + 6, { width: 35, align: 'center' });
    doc.text(money(l.unit_price_incl_vat), colX.price, y + 6, { width: 75, align: 'right' });
    doc.text(money(l.line_amount_incl_vat), colX.amount, y + 6, { width: 80, align: 'right' });
    total += l.line_amount_incl_vat;
    y += rh;
  });

  doc.rect(50, y, tableRight - 50, 22).stroke();
  doc.font('vn-bold').fontSize(9).text('TỔNG CỘNG TIỀN: (giá đã có thuế VAT)', colX.name, y + 6, { width: 280 });
  doc.text(money(total), colX.amount, y + 6, { width: 80, align: 'right' });
  y += 22;
  doc.y = y + 10;
  return total;
}

function generateContractPdf(res, contract, lines, customer, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${contract.contract_no}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  const companyName = settings.company_name || 'CÔNG TY TNHH IT HOÀN HẢO';
  const companyAddress = settings.company_address || '';
  const companyTaxCode = settings.company_tax_code || '';
  const companyPhone = settings.company_phone || '';
  const companyBankName = 'TPBank';
  const companyBankHolder = 'CTY TNHH IT HOAN HAO';
  const companyBankNumber = '82247724806';
  const companyRep = settings.recipient_name || 'Bùi Bảo Châu';

  // ---- Header dang 2 cot giong mau ----
  doc.font('vn-bold').fontSize(11).text(companyName, MARGIN, 45, { width: 250 });
  doc.fontSize(10).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', MARGIN + 230, 47, { width: 260, align: 'right' });
  doc.font('vn').fontSize(10).text(`Số: ${contract.contract_no}`, MARGIN, 65, { width: 250 });
  doc.font('vn-bold').fontSize(10).text('Độc lập - Tự do - Hạnh phúc', MARGIN + 230, 65, { width: 260, align: 'right' });
  doc.moveTo(MARGIN + 340, 80).lineTo(MARGIN + 495, 80).stroke();

  doc.font('vn-bold').fontSize(15).text('HỢP ĐỒNG MUA BÁN', 0, 105, { align: 'center', width: 595 });

  doc.y = 140;
  para(doc, '- Căn cứ Bộ Luật Dân sự số 91/2015/QH13 ngày 24/11/2015 của Quốc hội;');
  para(doc, '- Căn cứ Bộ Luật Thương mại của nước Cộng hòa xã hội chủ nghĩa Việt Nam số 36/2005/QH11 được Quốc hội thông qua ngày 14/06/2005, có hiệu lực từ ngày 01/01/2006;');
  para(doc, '- Căn cứ vào nhu cầu và năng lực của hai bên.');
  para(doc, `Hôm nay, ${vnDateWords(contract.contract_date)}, chúng tôi gồm:`);

  para(doc, `BÊN A (Bên bán): ${companyName}`, { bold: true });
  para(doc, `- Địa chỉ: ${companyAddress}`);
  para(doc, `- Mã số thuế: ${companyTaxCode}`);
  para(doc, `- Đại diện: Ông ${companyRep}.        Chức vụ: Giám đốc`);
  para(doc, `- Điện thoại: ${companyPhone}`);
  para(doc, `- Ngân hàng: ${companyBankName}`);
  para(doc, `- Tên tài khoản: ${companyBankHolder}`);
  para(doc, `- Số tài khoản: ${companyBankNumber}`);

  doc.y += 4;
  para(doc, `BÊN B (Bên mua): ${customer.name.toUpperCase()}`, { bold: true });
  para(doc, `- Địa chỉ: ${customer.address || ''}`);
  if (customer.tax_code) para(doc, `- Mã số thuế: ${customer.tax_code}`);
  para(doc, `- Đại diện: Ông/Bà ${customer.representative_name || '.......................................'}.        Chức vụ: ${customer.representative_position || '.......................................'}`);
  para(doc, `- Điện thoại: ${customer.phone || ''}`);

  doc.y += 4;
  para(doc, 'Hai bên thỏa thuận ký hợp đồng mua bán như sau:', { bold: true });

  // ---- DIEU 1 ----
  heading(doc, 'ĐIỀU 1: Bên A cung cấp cho bên B hàng hóa theo danh mục cụ thể như sau:');
  para(doc, 'ĐVT: Đồng', { size: 9 });
  const total = drawItemsTable(doc, lines);

  // ---- DIEU 2 ----
  heading(doc, 'ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG');
  const amountWords = numberToVietnameseWords(total);
  para(doc, `Tổng giá trị hợp đồng là: ${money(total)} đồng.`, { bold: true });
  para(doc, `(Bằng chữ: ${amountWords}).`);
  para(doc, '(Giá trên đã bao gồm thuế VAT).');

  // ---- DIEU 3 ----
  heading(doc, 'ĐIỀU 3: BÀN GIAO');
  para(doc, `- Sau khi ký hợp đồng, Bên A sẽ giao hàng đến địa điểm: ${contract.delivery_address || companyAddress} trong vòng 02 ngày.`);
  para(doc, `- Số điện thoại người nhận hàng: ${contract.delivery_phone || customer.phone || ''}`);
  para(doc, '- Bên A tiến hành bàn giao cho bên B hàng hoá đúng như nội dung đã nêu tại Điều 1.');
  para(doc, '- Thiết bị là hàng chính hãng, mới 100% nguyên đai nguyên kiện, hoạt động tốt.');

  // ---- DIEU 4 ----
  heading(doc, 'ĐIỀU 4: THANH TOÁN');
  para(doc, `- Tiến độ thanh toán: ${contract.payment_terms_text || '100% giá trị hợp đồng khi ký hợp đồng.'}`);
  if (contract.price_valid_until) {
    para(doc, `- Đơn giá trên có hiệu lực đến ngày ${dayjs(contract.price_valid_until).format('DD/MM/YYYY')}.`);
  }
  para(doc, '- Phương thức thanh toán: Chuyển khoản.');

  // ---- DIEU 5 ----
  heading(doc, 'ĐIỀU 5: BẢO HÀNH');
  para(doc, 'Điều kiện được bảo hành:', { bold: true });
  para(doc, `- Thời gian bảo hành: ${contract.warranty_months || 12} tháng theo tiêu chuẩn của nhà sản xuất.`, { indent: 10 });
  para(doc, '- Hàng còn nguyên tem bảo hành của nhà sản xuất.', { indent: 10 });
  para(doc, '- Đổi hàng mới nếu xảy ra lỗi kỹ thuật của nhà sản xuất.', { indent: 10 });
  para(doc, 'Sản phẩm sẽ không được bảo hành trong các trường hợp sau:', { bold: true });
  para(doc, '- Hư hỏng do thiên tai, tai nạn hoặc sử dụng sai hướng dẫn, ví dụ: sét đánh, nguồn điện không ổn định, chất lỏng vào, rơi vỡ, nứt vỡ do va đập, bảo dưỡng sai hướng dẫn,....', { indent: 10 });
  para(doc, '- Hư hỏng do bị các loại động vật chui vào trong sản phẩm hoặc được sử dụng trong môi trường ẩm ướt.', { indent: 10 });

  // ---- DIEU 6 ----
  heading(doc, 'ĐIỀU 6: ĐIỀU KHOẢN CHUNG');
  para(doc, '- Hai bên cùng cam kết thực hiện đầy đủ các điều khoản của hợp đồng trên, không được đơn phương thay đổi hoặc hủy bỏ hợp đồng.');
  para(doc, '- Bên B có trách nhiệm nhận, kiểm tra hàng hóa và ký biên bản nhận hàng.');
  para(doc, '- Bên A có trách nhiệm: thực hiện cung cấp hàng hóa đúng số lượng, chủng loại, quy cách kỹ thuật và thời hạn thực hiện hợp đồng.');

  // ---- DIEU 7 ----
  heading(doc, 'ĐIỀU 7: XỬ LÝ TRANH CHẤP');
  para(doc, '- Hai bên chủ động thông báo cho nhau tiến độ thực hiện hợp đồng, nếu có vấn đề gì bất lợi phát sinh, hai bên phải kịp thời thông báo, chủ động bàn bạc và giải quyết trên cơ sở thiện chí, đảm bảo quyền lợi của hai bên.');
  para(doc, '- Trường hợp có tranh chấp không tự giải quyết được, thì hai bên phải thống nhất sẽ khiếu nại đến Tòa án kinh tế Tp.HCM, là cơ quan có thẩm quyền giải quyết tranh chấp đối với hợp đồng này.');
  para(doc, '- Chi phí về kiểm tra, xác minh và lệ phí tòa án do bên nào có lỗi chịu trách nhiệm.');

  // ---- DIEU 8 ----
  heading(doc, 'ĐIỀU 8: HIỆU LỰC CỦA HỢP ĐỒNG');
  para(doc, '- Hợp đồng này có giá trị kể từ ngày ký, khi bên B đã thanh toán đầy đủ số tiền theo hóa đơn cho bên A thì hợp đồng mặc nhiên được thanh lý.');
  para(doc, '- Hợp đồng này được thành lập 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.');

  // ---- Chu ky ----
  doc.y += 10;
  para(doc, `Tp. Hồ Chí Minh, ${contract.contract_date ? dayjs(contract.contract_date).format('DD/MM/YYYY') : ''}`, { align: 'right' });
  ensureSpace(doc, 80);
  doc.y += 15;
  const signY = doc.y;
  doc.font('vn-bold').fontSize(10).text('ĐẠI DIỆN BÊN A', MARGIN, signY, { width: 220, align: 'center' });
  doc.text('ĐẠI DIỆN BÊN B', MARGIN + 275, signY, { width: 220, align: 'center' });

  doc.end();
}

module.exports = { generateContractPdf };
