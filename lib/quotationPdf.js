const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

function money(n) {
  return Math.round(n || 0).toLocaleString('vi-VN');
}
function vnDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// Ve 1 icon tick mau vang (thay cho emoji ✅ khong duoc font PDF ho tro, tranh hien o vuong)
function drawCheckIcon(doc, x, y, size) {
  doc.circle(x + size / 2, y + size / 2, size / 2).fill('#F5A623');
  doc.strokeColor('#FFFFFF').lineWidth(1.2);
  const cx = x + size / 2, cy = y + size / 2;
  doc.moveTo(cx - size * 0.22, cy).lineTo(cx - size * 0.03, cy + size * 0.22).lineTo(cx + size * 0.25, cy - size * 0.2).stroke();
  // Dat lai mau den + net ve ro rang ngay sau khi ve icon - KHONG dua vao save()/restore() vi cap nay
  // co the bi lech neu co doc.addPage() xay ra giua chung, gay "ro" mau cam sang chu binh thuong phia sau.
  doc.fillColor('black').strokeColor('black');
}

// Loai bo emoji/ky tu bieu tuong ma font DejaVuSans khong co (se hien o vuong), va dau gach dau dong cu (da co icon rieng)
function cleanNoteLine(line) {
  let t = line.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F\u25CF\u25AA]/gu, '');
  t = t.replace(/^[\s\-\*•]+/, '');
  return t.trim();
}

// Ve danh sach ghi chu dang cac dong co icon tick vang dau dong (thay cho doc.text 1 khoi don gian).
// measureOnly=true: chi tinh chieu cao can dung, khong ve gi (dung de tinh chieu cao dong bang truoc).
function renderNoteLines(doc, text, x, y, width, measureOnly) {
  if (!text) return 0;
  const iconSize = 7, gap = 4, lineSpacing = 3;
  const textWidth = width - iconSize - gap;
  const rawLines = text.split('\n').map(cleanNoteLine).filter(l => l.length > 0);
  doc.font('vn').fontSize(8);
  let curY = y;
  rawLines.forEach(line => {
    const h = doc.heightOfString(line, { width: textWidth });
    const rowH = Math.max(h, iconSize);
    if (!measureOnly) {
      drawCheckIcon(doc, x, curY + 1, iconSize);
      doc.text(line, x + iconSize + gap, curY, { width: textWidth });
    }
    curY += rowH + lineSpacing;
  });
  return rawLines.length ? curY - y - lineSpacing : 0;
}

module.exports = function generateQuotationPdf(res, quotation, lines, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotation_no}.pdf"`);
  doc.pipe(res);

  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  const companyName = settings.company_name || 'CÔNG TY TNHH IT HOÀN HẢO';

  // ---- Header cong ty ----
  const headerWidth = 350;
  let hy = 40;
  doc.font('vn-bold').fontSize(13).text(companyName, 40, hy, { width: headerWidth });
  hy += doc.heightOfString(companyName, { width: headerWidth }) + 5;
  doc.font('vn').fontSize(9);
  const headerLines = [
    'Địa chỉ: 207/45 Nam Cao, Phường Tăng Nhơn Phú, TP Hồ Chí Minh',
    'Website: http://www.ithoanhao.vn',
    'Email: sales@ithoanhao.vn',
    `Ngày báo giá: ${vnDate(quotation.quotation_date)}`,
  ];
  headerLines.forEach(t => {
    doc.text(t, 40, hy, { width: headerWidth });
    hy += doc.heightOfString(t, { width: headerWidth }) + 3;
  });

  doc.font('vn-bold').fontSize(16).text('BẢNG BÁO GIÁ', 0, 100, { align: 'center' });

  // ---- Thong tin khach hang ----
  const infoWidth = 515;
  let y = Math.max(hy + 10, 140);
  doc.font('vn-bold').fontSize(9);
  const kinhGuiText = 'Kính gửi:  ' + quotation.customer_name.toUpperCase();
  doc.text(kinhGuiText, 40, y, { width: infoWidth });
  y += doc.heightOfString(kinhGuiText, { width: infoWidth }) + 3;

  doc.font('vn');
  const infoLines = [];
  infoLines.push('Địa chỉ: ' + (quotation.customer_address || ''));
  if (quotation.tax_code) infoLines.push('Mã số thuế: ' + quotation.tax_code);
  infoLines.push('Liên hệ: ' + (quotation.contact_person || ''));
  infoLines.push('Điện thoại: ' + (quotation.phone || ''));
  infoLines.forEach(t => {
    doc.text(t, 40, y, { width: infoWidth });
    y += doc.heightOfString(t, { width: infoWidth }) + 4;
  });
  y += 4;

  doc.text('Công Ty IT Hoàn Hảo trân trọng kính gửi đến Quý Khách hàng Bảng Báo Giá thiết bị theo yêu cầu sau đây:', 40, y, { width: infoWidth });
  y += doc.heightOfString('Công Ty IT Hoàn Hảo trân trọng kính gửi đến Quý Khách hàng Bảng Báo Giá thiết bị theo yêu cầu sau đây:', { width: infoWidth }) + 10;

  // ---- Bang chi tiet ----
  // Kiem tra co dong nao thuc su co Ghi chu them hay khong, de quyet dinh bo cuc cot
  // (khong hien cot Ghi chu rieng va nhuong het khong gian cho Thiet Bi neu khong ai dung den)
  const hasAnyNotes = lines.some(l => l.product_id && l.description && l.description.trim());
  const tableRight = 555;
  let colX;
  if (hasAnyNotes) {
    colX = { stt: 40, name: 62, nameW: 123, note: 187, noteW: 118, sl: 307, slW: 25, bh: 334, bhW: 36, price: 372, priceW: 55, tax: 429, taxW: 31, amount: 460, amountW: 95 };
  } else {
    colX = { stt: 40, name: 65, nameW: 218, note: 0, noteW: 0, sl: 285, slW: 30, bh: 317, bhW: 38, price: 357, priceW: 62, tax: 421, taxW: 33, amount: 456, amountW: 99 };
  }

  const rowStartY = y;

  function drawHeaderRow(yy) {
    doc.font('vn-bold').fontSize(8);
    doc.rect(40, yy, tableRight - 40, 26).stroke();
    doc.text('Stt', colX.stt + 2, yy + 8, { width: 20 });
    doc.text('Thiết Bị', colX.name, yy + 8, { width: colX.nameW });
    if (hasAnyNotes) doc.text('Ghi chú', colX.note, yy + 8, { width: colX.noteW });
    doc.text('SL', colX.sl, yy + 8, { width: colX.slW, align: 'center' });
    doc.text('BH', colX.bh, yy + 2, { width: colX.bhW, align: 'center' });
    doc.text('(Tháng)', colX.bh, yy + 13, { width: colX.bhW, align: 'center' });
    doc.text('Đơn Giá\n(chưa VAT)', colX.price, yy + 3, { width: colX.priceW, align: 'right' });
    doc.text('Thuế', colX.tax, yy + 2, { width: colX.taxW, align: 'center' });
    doc.text('(%)', colX.tax, yy + 13, { width: colX.taxW, align: 'center' });
    doc.text('Thành Tiền\n(chưa VAT)', colX.amount, yy + 3, { width: colX.amountW, align: 'right' });
    return yy + 26;
  }

  y = drawHeaderRow(rowStartY);
  doc.font('vn').fontSize(8);
  lines.forEach((l, idx) => {
    const name = l.product_name || (l.product_id ? '' : (l.description || ''));
    // Ghi chu them: chi hien o cot rieng khi da co san pham rieng (khong trung voi truong hop dung description lam ten khi khong chon san pham)
    const note = (hasAnyNotes && l.product_id) ? (l.description || '') : '';
    const nameHeight = doc.heightOfString(name, { width: colX.nameW });
    const noteHeight = hasAnyNotes ? renderNoteLines(doc, note, colX.note, 0, colX.noteW, true) : 0; // do chieu cao truoc, chua ve
    const rh = Math.max(24, nameHeight + 10, noteHeight + 10);
    if (y + rh > 760) { doc.addPage(); y = 40; y = drawHeaderRow(y); doc.font('vn').fontSize(8); }
    doc.rect(40, y, tableRight - 40, rh).stroke();
    doc.text(String(idx + 1), colX.stt + 2, y + 6, { width: 20 });
    doc.text(name, colX.name, y + 6, { width: colX.nameW });
    if (hasAnyNotes) renderNoteLines(doc, note, colX.note, y + 6, colX.noteW, false);
    doc.text(String(l.quantity), colX.sl, y + 6, { width: colX.slW, align: 'center' });
    doc.text(l.warranty_months ? String(l.warranty_months) : '-', colX.bh, y + 6, { width: colX.bhW, align: 'center' });
    doc.text(money(l.unit_price), colX.price, y + 6, { width: colX.priceW, align: 'right' });
    doc.text(String(l.tax_rate_percent) + '%', colX.tax, y + 6, { width: colX.taxW, align: 'center' });
    doc.text(money(l.line_amount), colX.amount, y + 6, { width: colX.amountW, align: 'right' });
    y += rh;
  });

  // Ham dam bao con du cho tren trang hien tai, tu dong sang trang moi neu khong du (tranh noi dung bi day ra ngoai trang)
  function ensurePageSpace(neededHeight) {
    if (y + neededHeight > 780) { doc.addPage(); y = 40; }
  }

  // Tong cong
  ensurePageSpace(44);
  doc.rect(40, y, tableRight - 40, 22).stroke();
  doc.font('vn-bold').text('Tiền thuế VAT', colX.name, y + 6, { width: 350 });
  doc.text(money(quotation.vat_amount), colX.amount, y + 6, { width: 95, align: 'right' });
  y += 22;
  doc.rect(40, y, tableRight - 40, 22).stroke();
  doc.text('Tổng Cộng (VND)', colX.name, y + 6, { width: 350 });
  doc.text(money(quotation.total_amount), colX.amount, y + 6, { width: 95, align: 'right' });
  y += 32;

  // ---- Dieu khoan ----
  doc.font('vn').fontSize(8.5);
  const terms = [
    '- Tất cả các thiết bị nhập khẩu chính hãng.',
    `- Báo giá có hiệu lực ${quotation.valid_until ? ('đến ngày ' + vnDate(quotation.valid_until)) : '7 ngày kể từ ngày thông báo'}.`,
    '- Bảo hành: chính hãng theo tiêu chuẩn của nhà sản xuất. IT Hoàn Hảo hỗ trợ tiếp nhận sản phẩm lỗi đi bảo hành cho Quý Khách hàng.',
    '- Giao hàng: trong vòng 7 ngày kể từ ngày ký Hợp đồng mua bán, hoặc theo lịch trình của Quý khách.',
    '- Thuế GTGT (VAT): giá trên CHƯA bao gồm VAT, được cộng riêng theo thuế suất từng dòng.',
    '- Thanh toán: tiền mặt hoặc chuyển khoản.',
    '- Thông tin chuyển khoản: Ngân hàng TPBank - Tên tài khoản: CTY TNHH IT HOAN HAO - Số tài khoản: 82247724806',
  ];
  terms.forEach(t => {
    const h = doc.heightOfString(t, { width: 515 });
    ensurePageSpace(h + 3);
    doc.text(t, 40, y, { width: 515 });
    y += h + 3;
  });

  y += 15;
  ensurePageSpace(20);
  doc.font('vn').text('Mọi chi tiết vui lòng liên hệ:', 40, y);
  doc.text('Xác nhận của khách hàng', 350, y);

  doc.end();
};
