const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

const COMPANY = {
  name: 'CÔNG TY TNHH IT HOÀN HẢO',
  address: '207/45 Nam Cao, Phường Tăng Nhơn Phú, Thành phố Hồ Chí Minh, Việt Nam',
  taxCode: '0318606297',
  bank: 'TPBank',
  bankBranch: 'PHAN ĐĂNG LƯU',
  bankAccountName: 'CTY TNHH IT HOAN HAO',
  bankAccountNo: '82247724806',
};

function money(n) {
  return Math.round(n || 0).toLocaleString('vi-VN');
}
function vnDateWords(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `ngày ${parseInt(day)} tháng ${parseInt(m)} năm ${y}`;
}
function vnDateShort(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function setupDoc(res, filename) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');
  return doc;
}

function drawItemsTable(doc, lines, startY, priceInclVat) {
  const colX = { stt: 50, name: 80, sl: 300, bh: 335, price: 385, amount: 460 };
  const tableRight = 545;
  let y = startY;

  function header(yy) {
    doc.font('vn-bold').fontSize(9);
    doc.rect(50, yy, tableRight - 50, 30).stroke();
    doc.text('Stt', colX.stt + 2, yy + 10, { width: 25 });
    doc.text('Thiết Bị', colX.name, yy + 10, { width: 215 });
    doc.text('SL', colX.sl, yy + 10, { width: 30, align: 'center' });
    doc.text('BH\n(Tháng)', colX.bh, yy + 4, { width: 45, align: 'center' });
    doc.text(priceInclVat ? 'Đơn Giá (Đã gồm VAT)' : 'Đơn Giá (VND)', colX.price, yy + 10, { width: 70, align: 'right' });
    doc.text(priceInclVat ? 'Thành Tiền (Đã gồm VAT)' : 'Thành Tiền (VND)', colX.amount, yy + 10, { width: 80, align: 'right' });
    return yy + 30;
  }

  y = header(y);
  doc.font('vn').fontSize(9);
  let total = 0;
  lines.forEach((l, idx) => {
    const name = l.product_name || l.description || '';
    const nameHeight = doc.heightOfString(name, { width: 213 });
    const rh = Math.max(28, nameHeight + 12);
    if (y + rh > 750) { doc.addPage(); y = 50; y = header(y); doc.font('vn').fontSize(9); }
    doc.rect(50, y, tableRight - 50, rh).stroke();
    doc.text(String(idx + 1), colX.stt + 2, y + 8, { width: 25 });
    doc.text(name, colX.name, y + 8, { width: 213 });
    doc.text(String(l.quantity), colX.sl, y + 8, { width: 30, align: 'center' });
    doc.text(l.warranty_months ? String(l.warranty_months) : '-', colX.bh, y + 8, { width: 45, align: 'center' });
    doc.text(money(l.unit_price), colX.price, y + 8, { width: 70, align: 'right' });
    doc.text(money(l.line_amount), colX.amount, y + 8, { width: 80, align: 'right' });
    total += l.line_amount;
    y += rh;
  });

  doc.rect(50, y, tableRight - 50, 24).stroke();
  doc.font('vn-bold').text('Tổng Cộng (VND)', colX.name, y + 7, { width: 335 });
  doc.text(money(total), colX.amount, y + 7, { width: 80, align: 'right' });
  y += 24;
  return { y, total };
}

// ================= BIEN BAN BAN GIAO =================
function generateHandoverPdf(res, invoice, lines) {
  const doc = setupDoc(res, 'BBBG-' + invoice.invoice_no);

  doc.font('vn-bold').fontSize(13).text('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', 0, 50, { align: 'center' });
  doc.fontSize(11).text('Độc lập - Tự do - Hạnh phúc', 0, 68, { align: 'center' });
  doc.moveTo(240, 88).lineTo(355, 88).stroke();

  doc.fontSize(16).text('BIÊN BẢN BÀN GIAO', 0, 110, { align: 'center' });
  doc.font('vn').fontSize(10).text(
    `Hôm nay, ${vnDateWords(invoice.invoice_date)}. Chúng tôi gồm:`, 0, 140, { align: 'center' }
  );

  let y = 175;
  doc.font('vn-bold').text('BÊN B (Bên mua): ', 50, y, { continued: true }).font('vn').text(invoice.customer_name.toUpperCase());
  y += 18;
  doc.text('Địa chỉ: ' + (invoice.customer_address || ''), 70, y, { width: 470 });
  y += doc.heightOfString('Địa chỉ: ' + (invoice.customer_address || ''), { width: 470 }) + 5;
  if (invoice.tax_code) { doc.text('Mã số thuế: ' + invoice.tax_code, 70, y); y += 16; }

  y += 8;
  doc.font('vn-bold').text('BÊN A (Bên bán): ', 50, y, { continued: true }).font('vn').text(COMPANY.name);
  y += 18;
  doc.text('Địa chỉ: ' + COMPANY.address, 70, y, { width: 470 });
  y += doc.heightOfString('Địa chỉ: ' + COMPANY.address, { width: 470 }) + 5;
  doc.text('Mã số thuế: ' + COMPANY.taxCode, 70, y);
  y += 26;

  doc.font('vn-bold').text('Hai bên tiến hành bàn giao:', 50, y);
  y += 16;
  doc.font('vn').text('Cung cấp đầy đủ hàng hóa theo thỏa thuận của hai bên đầy đủ theo các danh mục sau:', 50, y, { width: 495 });
  y += doc.heightOfString('Cung cấp đầy đủ hàng hóa theo thỏa thuận của hai bên đầy đủ theo các danh mục sau:', { width: 495 }) + 12;

  const result = drawItemsTable(doc, lines, y, true);
  y = result.y + 18;

  doc.font('vn').fontSize(10).text('Kết luận: Sản phẩm đủ chất lượng và số lượng. Sẵn sàng đưa vào sử dụng.', 50, y);
  y += 40;

  doc.font('vn-bold').text('XÁC NHẬN CỦA BÊN A', 60, y, { width: 220, align: 'center' });
  doc.text('XÁC NHẬN CỦA BÊN B', 300, y, { width: 220, align: 'center' });
  doc.font('vn').fontSize(9).text('(Ký, ghi rõ họ tên)', 60, y + 16, { width: 220, align: 'center' });
  doc.text('(Ký, ghi rõ họ tên)', 300, y + 16, { width: 220, align: 'center' });

  doc.end();
}

// ================= GIAY DE NGHI THANH TOAN =================
function generatePaymentRequestPdf(res, invoice, lines, settings) {
  const doc = setupDoc(res, 'DNTT-' + invoice.invoice_no);

  doc.font('vn').fontSize(9);
  doc.text('Đơn vị: ' + COMPANY.name, 50, 50, { width: 280 });
  doc.text('Địa chỉ: ' + COMPANY.address, 50, 64, { width: 280 });

  doc.text('Mẫu số 05 - TT', 380, 50, { width: 165, align: 'center' });
  doc.font('vn').fontSize(8).text('(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 của Bộ Tài chính)', 380, 64, { width: 165, align: 'center' });

  let y = 110;
  doc.font('vn-bold').fontSize(15).text('GIẤY ĐỀ NGHỊ THANH TOÁN', 0, y, { align: 'center' });
  y += 22;
  const invoiceRefNo = invoice.external_invoice_no || invoice.invoice_no.split('-').pop();
  const dntNo = 'ĐNTT-' + invoiceRefNo + '/' + invoice.invoice_date.slice(0, 4);
  doc.font('vn').fontSize(10).text('Số: ' + dntNo, 0, y, { align: 'center' });
  y += 15;
  doc.text(vnDateWords(invoice.invoice_date).replace(/^./, c => c.toUpperCase()), 0, y, { align: 'center' });
  y += 26;

  const requesterName = (settings && (settings.recipient_name || settings.company_name)) || COMPANY.name;
  const requesterAddress = (settings && settings.company_address) || COMPANY.address;

  doc.text('Kính gửi: ' + invoice.customer_name.toUpperCase(), 50, y, { width: 495 });
  y += doc.heightOfString('Kính gửi: ' + invoice.customer_name.toUpperCase(), { width: 495 }) + 6;
  doc.text('Họ và tên người đề nghị thanh toán: ' + requesterName, 50, y, { width: 495 });
  y += doc.heightOfString('Họ và tên người đề nghị thanh toán: ' + requesterName, { width: 495 }) + 4;
  doc.text('Địa chỉ: ' + requesterAddress, 50, y, { width: 495 });
  y += doc.heightOfString('Địa chỉ: ' + requesterAddress, { width: 495 }) + 4;
  const noiDung = 'Nội dung thanh toán: Thanh toán tiền hàng theo hóa đơn số: ' + (invoice.external_invoice_no || invoice.invoice_no);
  doc.text(noiDung, 50, y, { width: 495 });
  y += doc.heightOfString(noiDung, { width: 495 }) + 10;

  const result = drawItemsTable(doc, lines, y);
  y = result.y;

  // Bo sung dong Thue VAT va Tong tien THUC PHAI TRA (da gom VAT) - day moi la so tien
  // khach hang thuc su can thanh toan, khac voi "Thanh tien" tung dong (chua VAT) o tren
  const tableRight = 545;
  const colName = 80, colAmount = 460;
  doc.rect(50, y, tableRight - 50, 22).stroke();
  doc.font('vn').fontSize(9).text('Tiền thuế VAT', colName, y + 6, { width: 335 });
  doc.text(money(invoice.vat_amount), colAmount, y + 6, { width: 80, align: 'right' });
  y += 22;
  doc.rect(50, y, tableRight - 50, 24).stroke();
  doc.font('vn-bold').fontSize(10).text('Tổng tiền phải thanh toán (đã gồm VAT)', colName, y + 6, { width: 335 });
  doc.text(money(invoice.total_amount), colAmount, y + 6, { width: 80, align: 'right' });
  y += 24 + 15;

  doc.font('vn').fontSize(9).text('Quý công ty vui lòng thanh toán theo thông tin tài khoản dưới đây:', 50, y, { width: 495 });
  y += 16;
  doc.text('Ngân hàng ' + COMPANY.bank, 50, y); y += 14;
  doc.text('Chi nhánh: ' + COMPANY.bankBranch, 50, y); y += 14;
  doc.text('Tên tài khoản: ' + COMPANY.bankAccountName, 50, y); y += 14;
  doc.text('Số tài khoản: ' + COMPANY.bankAccountNo, 50, y); y += 18;
  doc.font('vn').fontSize(9).text('(Kèm theo Biên bản bàn giao chứng từ gốc)', 50, y);
  y += 36;

  doc.font('vn-bold').fontSize(10).text('Người đề nghị thanh toán', 60, y, { width: 220, align: 'center' });
  doc.text('Người duyệt', 300, y, { width: 220, align: 'center' });
  doc.font('vn').fontSize(9).text('(Ký, họ tên)', 60, y + 15, { width: 220, align: 'center' });
  doc.text('(Ký, họ tên)', 300, y + 15, { width: 220, align: 'center' });

  doc.end();
}

module.exports = { generateHandoverPdf, generatePaymentRequestPdf };
