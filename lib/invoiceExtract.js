const fs = require('fs');
const pdfParse = require('pdf-parse');

// Trich xuat "goi y" tu noi dung text cua PDF hoa don dien tu.
// Nham chinh xac vao cau truc hoa don dien tu chuan Viet Nam (Nghi dinh 123/Thong tu 78):
// cac nhan song ngu co dinh nhu "Ký hiệu (Serial)", "Số (No.)", "Tổng cộng (Total amount)".
// Day la trich xuat tu lop text co san trong PDF (khong phai OCR anh chup) - chi hoat dong
// voi PDF dang van ban. Ket qua CHI la goi y de nguoi dung xac nhan/sua lai, khong tu dong luu thang.
async function extractInvoiceInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  let text = '';
  try {
    const data = await pdfParse(buffer);
    text = data.text || '';
  } catch (err) {
    return { text: '', invoiceNo: null, invoiceSerial: null, invoiceDate: null, totalAmount: null, error: 'Không đọc được nội dung PDF (có thể là file ảnh scan, không phải văn bản).' };
  }

  // --- So hoa don (No.): nhan "Số" + "(No.)" roi toi chu so, co the cach dong ---
  const invoiceNo = firstMatch(text, [
    /S[oố]\s*\(\s*No\.?\s*\)\s*[:：]?\s*(\d{1,10})/i,
    /\bNo\.?\s*[:：]\s*(\d{1,10})/i,
  ]);

  // --- Ky hieu (Serial): nhan "Ký hiệu" + "(Serial)" roi toi ma serial (chu+so) ---
  const invoiceSerial = firstMatch(text, [
    /K[yý]\s*hi[eệ]u\s*\(\s*Serial\s*\)\s*[:：]?\s*([A-Z0-9]{5,12})/i,
  ]);

  // --- Ngay hoa don: uu tien dung dang "Ngày (Date) D tháng (month) M năm (year) Y" ---
  let invoiceDate = null;
  const dateSpelled = text.match(/Ng[aà]y\s*\(Date\)\s*(\d{1,2})\s*th[aá]ng\s*\(month\)\s*(\d{1,2})\s*n[ăa]m\s*\(year\)\s*(\d{4})/i);
  if (dateSpelled) {
    invoiceDate = `${dateSpelled[3]}-${dateSpelled[2].padStart(2, '0')}-${dateSpelled[1].padStart(2, '0')}`;
  } else {
    // Fallback: ngay ky so "Ký ngày: dd-mm-yyyy" hoac dang dd/mm/yyyy bat ky trong van ban
    const fallbackDate = firstMatch(text, [
      /K[yý]\s*ng[aà]y\s*[:：]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    ]);
    invoiceDate = normalizeDate(fallbackDate);
  }

  // --- Tong tien: lay SO CUOI CUNG tren dong "Tổng cộng...(Total amount)" (vi dong nay co the
  // co 3 cot: tien truoc thue - tien thue - tong tien; cot cuoi moi la tong thanh toan) ---
  let totalAmount = null;
  const totalLineMatch = text.match(/T[oổ]ng\s*c[oộ]ng[^\n]*?\(?\s*Total amount\s*\)?[:：]?\s*([\d.,\s]+)/i)
    || text.match(/T[oổ]ng\s*c[oộ]ng[:：]?\s*([\d.,\s]+)/i);
  if (totalLineMatch) {
    const numbers = totalLineMatch[1].trim().split(/\s+/).filter(Boolean);
    if (numbers.length) totalAmount = parseVnNumber(numbers[numbers.length - 1]);
  }

  return {
    text,
    invoiceNo: invoiceNo || null,
    invoiceSerial: invoiceSerial || null,
    invoiceDate,
    totalAmount,
  };
}

function firstMatch(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function normalizeDate(d) {
  if (!d) return null;
  const parts = d.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let [a, b, c] = parts;
  if (c.length === 2) c = '20' + c;
  return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}

function parseVnNumber(s) {
  const cleaned = s.replace(/[.,](?=\d{3}\b)/g, '').replace(/[.,]\d{1,2}$/, '');
  const n = parseFloat(cleaned.replace(/[^\d]/g, ''));
  return isNaN(n) ? null : n;
}

module.exports = { extractInvoiceInfo };
