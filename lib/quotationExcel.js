const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

function vnDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } };
const WHITE_BOLD_HEADER = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
const BLUE = { argb: 'FF0000FF' };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};
const MONEY_FMT = '#,##0';
// Dieu quan trong: gia tri thuc trong o VAN LA SO (0, 8, 10...) de cong thuc tinh dung binh thuong,
// chi doi CACH HIEN THI - hien "Không chịu thuế" khi = 0, con lai hien "N%". Khac voi file mau Chau
// gui (luu chu "Không chịu thuế" nhu VAN BAN THAT trong o, lam cong thuc VAT o do bi sai/tinh thieu).
const VAT_DISPLAY_FMT = '[=0]"Không chịu thuế";0"%"';

// Uoc luong so dong chu se xuong khi wrap trong 1 cot, de tu dat chieu cao dong phu hop.
// ExcelJS/Excel khong luu san gia tri "auto-fit chieu cao" trong file (Excel chi tu tinh
// luc MO file bang UI, khong the ghi san lam gia tri co dinh) nen phai tu uoc luong khi tao file.
function estimateRowHeight(textsWithCharWidth) {
  let maxLines = 1;
  for (const [text, widthChars] of textsWithCharWidth) {
    if (!text) continue;
    const charsPerLine = Math.max(Math.floor(widthChars * 1.8), 5);
    const linesNeeded = Math.max(1, Math.ceil(String(text).length / charsPerLine));
    maxLines = Math.max(maxLines, linesNeeded);
  }
  return Math.max(20, maxLines * 15 + 8);
}

function loadImageAsset(filename) {
  try {
    const p = path.join(__dirname, '..', 'assets', 'images', filename);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  } catch (e) { /* bo qua, khong co logo/dau thi vẫn xuat file binh thuong */ }
  return null;
}

// Cot: A=dem cho logo (khong dung de nhap lieu), B=STT, C+D=Ten hang hoa (gop),
// E=Ghi chu/Quy cach, F=DVT, G=So luong, H=Don gia, I=VAT%, J=Thanh tien chua VAT
module.exports = async function generateQuotationExcel(res, quotation, lines, settings) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERP Lite - IT Hoàn Hảo';
  wb.created = new Date();
  const ws = wb.addWorksheet('Báo giá', { properties: { defaultRowHeight: 18 } });

  const widths = { A: 2, B: 5, C: 15, D: 18, E: 42, F: 9, G: 10, H: 16, I: 17, J: 20 };
  Object.entries(widths).forEach(([col, w]) => { ws.getColumn(col).width = w; });

  let r = 1;
  const companyName = (settings && settings.company_name) || 'CÔNG TY TNHH IT HOÀN HẢO';

  // ---- Logo + con dau cong ty (neu co file trong assets/images) ----
  const logoBuf = loadImageAsset('company-logo.png');
  if (logoBuf) {
    const logoId = wb.addImage({ buffer: logoBuf, extension: 'png' });
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 62 } });
  }
  const stampBuf = loadImageAsset('company-stamp.png');
  if (stampBuf) {
    const stampId = wb.addImage({ buffer: stampBuf, extension: 'png' });
    ws.addImage(stampId, { tl: { col: 8, row: 0 }, ext: { width: 85, height: 85 } });
  }

  function writeLine(text, opts = {}) {
    const colStart = opts.colStart || 3; // mac dinh bat dau tu C, chua cho logo o A-B
    const colEnd = opts.colEnd || 10;
    const cell = ws.getCell(r, colStart);
    cell.value = text;
    cell.font = Object.assign({ name: 'Arial', size: opts.size || 11 }, opts.font || {});
    if (opts.align) cell.alignment = { horizontal: opts.align, vertical: 'middle' };
    if (colEnd > colStart) ws.mergeCells(r, colStart, r, colEnd);
    r += 1;
    return cell;
  }

  writeLine(companyName, { font: { bold: true, size: 14 } });
  writeLine('Địa chỉ: 207/45 Nam Cao, Phường Tăng Nhơn Phú, TP Hồ Chí Minh');
  writeLine('Website: http://www.ithoanhao.vn');
  writeLine('Email: sales@ithoanhao.vn');
  writeLine(`Ngày báo giá: ${vnDate(quotation.quotation_date)}`);
  r += 1;
  writeLine('BẢNG BÁO GIÁ', { font: { bold: true, size: 20 }, align: 'center' });

  // ---- Thong tin khach hang (bat dau tu cot B, khong phai C, giong mau) ----
  writeLine(`Kính gửi: ${(quotation.customer_name || '').toUpperCase()}`, { colStart: 2, font: { bold: true } });
  writeLine(`Địa chỉ: ${quotation.customer_address || ''}`, { colStart: 2 });
  if (quotation.tax_code) writeLine(`Mã số thuế: ${quotation.tax_code}`, { colStart: 2 });
  writeLine(`Liên hệ: ${quotation.contact_person || ''}`, { colStart: 2 });
  writeLine(`Điện thoại: ${quotation.phone || ''}`, { colStart: 2 });
  writeLine('Công Ty IT Hoàn Hảo trân trọng kính gửi đến Quý Khách hàng Bảng Báo Giá thiết bị theo yêu cầu sau đây:', { colStart: 2 });
  r += 1;

  // ---- Bang chi tiet ----
  const headerMap = { 2: 'STT', 3: 'Tên Hàng Hoá / Dịch Vụ', 5: 'Ghi Chú / Quy Cách', 6: 'ĐVT', 7: 'Số Lượng', 8: 'Đơn Giá (VNĐ)', 9: 'VAT (%)', 10: 'Thành Tiền Chưa VAT (VNĐ)' };
  const headerRow = r;
  for (let col = 2; col <= 10; col++) {
    const cell = ws.getCell(headerRow, col);
    if (headerMap[col]) cell.value = headerMap[col];
    cell.font = WHITE_BOLD_HEADER;
    cell.fill = NAVY_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  }
  ws.mergeCells(headerRow, 3, headerRow, 4);
  ws.getRow(headerRow).height = 30;
  r += 1;

  const firstDataRow = r;
  lines.forEach((l, idx) => {
    const name = l.product_name || (l.product_id ? '' : (l.description || ''));
    const note = l.product_id ? (l.description || '') : '';
    const row = r;

    const cStt = ws.getCell(row, 2); cStt.value = idx + 1; cStt.alignment = { horizontal: 'center', vertical: 'top' };
    const cName = ws.getCell(row, 3); cName.value = name; cName.alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(row, 3, row, 4);
    const cNote = ws.getCell(row, 5); cNote.value = note; cNote.alignment = { wrapText: true, vertical: 'top' };
    const cUnit = ws.getCell(row, 6); cUnit.value = l.product_unit || ''; cUnit.alignment = { horizontal: 'center', vertical: 'top' };

    // Cac o nguoi dung co the sua tay - to mau xanh duong theo quy uoc (input)
    const cQty = ws.getCell(row, 7); cQty.value = l.quantity; cQty.font = { name: 'Arial', color: BLUE }; cQty.alignment = { horizontal: 'center', vertical: 'top' };
    const cPrice = ws.getCell(row, 8); cPrice.value = l.unit_price; cPrice.font = { name: 'Arial', color: BLUE }; cPrice.numFmt = MONEY_FMT; cPrice.alignment = { vertical: 'top' };
    const cTax = ws.getCell(row, 9); cTax.value = l.tax_rate_percent || 0; cTax.font = { name: 'Arial', color: BLUE }; cTax.numFmt = VAT_DISPLAY_FMT; cTax.alignment = { horizontal: 'center', vertical: 'top' };

    // Thanh tien = ROUND(SL x Don gia) - dung nhu quy tac lam tron cua he thong (routes/quotations.js)
    const cAmount = ws.getCell(row, 10);
    cAmount.value = { formula: `ROUND(G${row}*H${row},0)` };
    cAmount.numFmt = MONEY_FMT; cAmount.alignment = { vertical: 'top' };

    for (let col = 2; col <= 10; col++) ws.getCell(row, col).border = THIN_BORDER;
    ws.getRow(row).height = estimateRowHeight([[name, 33], [note, 42]]);
    r += 1;
  });
  const lastDataRow = r - 1;

  function totalsRow(label, formula, opts = {}) {
    const row = r;
    ws.mergeCells(row, 3, row, 9);
    const lc = ws.getCell(row, 3); lc.value = label; lc.font = { name: 'Arial', bold: true, size: opts.size || 11 };
    const vc = ws.getCell(row, 10); vc.value = { formula }; vc.numFmt = MONEY_FMT; vc.font = { name: 'Arial', bold: true, size: opts.size || 11 };
    for (let col = 2; col <= 10; col++) ws.getCell(row, col).border = THIN_BORDER;
    r += 1;
    return row;
  }

  const subtotalRow = totalsRow('Cộng tiền hàng hoá (chưa VAT):', `SUM(J${firstDataRow}:J${lastDataRow})`);
  // Tinh VAT bang SUMPRODUCT tren toan bo dai dong (khac file mau Chau gui - ho de cung 1 khoang
  // dong nho co dinh nen thieu neu them/bot dong - o day luon dung du moi dong hien co)
  const vatRow = totalsRow('Tiền thuế VAT:', `SUMPRODUCT(G${firstDataRow}:G${lastDataRow}*H${firstDataRow}:H${lastDataRow}*I${firstDataRow}:I${lastDataRow}/100)`);
  const totalRow = totalsRow('Tổng Cộng (VND)', `J${subtotalRow}+J${vatRow}`, { size: 12 });
  r += 1;

  // ---- Dieu khoan thuong mai & ghi chu (giong noi dung da co san trong lib/quotationPdf.js) ----
  ws.getCell(r, 3).value = 'ĐIỀU KHOẢN THƯƠNG MẠI & GHI CHÚ:';
  ws.getCell(r, 3).font = { name: 'Arial', bold: true };
  r += 1;
  const terms = [
    '1. Tất cả các thiết bị, phần mềm nhập khẩu chính hãng 100%.',
    `2. Báo giá có hiệu lực ${quotation.valid_until ? ('đến ngày ' + vnDate(quotation.valid_until)) : '7 ngày kể từ ngày thông báo'}.`,
    '3. Bảo hành: chính hãng theo tiêu chuẩn của nhà sản xuất. IT Hoàn Hảo hỗ trợ tiếp nhận sản phẩm lỗi đi bảo hành cho Quý Khách hàng.',
    '4. Giao hàng: trong vòng 7 ngày kể từ ngày ký Hợp đồng mua bán, hoặc theo lịch trình của Quý khách.',
    '5. Thuế GTGT (VAT): giá trên CHƯA bao gồm VAT, được cộng riêng theo thuế suất từng dòng.',
    '6. Thanh toán: tiền mặt hoặc chuyển khoản. Ngân hàng TPBank - CTY TNHH IT HOAN HAO - Số tài khoản: 82247724806.',
  ];
  terms.forEach(t => {
    ws.mergeCells(r, 3, r, 10);
    const c = ws.getCell(r, 3); c.value = t; c.font = { name: 'Arial', italic: true, size: 10 };
    c.alignment = { wrapText: true };
    r += 1;
  });
  r += 2;
  ws.getCell(r, 3).value = 'Mọi chi tiết vui lòng liên hệ:';
  ws.getCell(r, 8).value = 'Xác nhận của khách hàng';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotation_no}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};
