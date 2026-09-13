const fs = require('fs');
const pdfParse = require('pdf-parse');

// Trich xuat "goi y" tu PDF hoa don dien tu KHI KHONG CO file XML di kem (truong hop nay
// rat pho bien voi chung tu cu tu dau 2024 - thoi diem chua luu XML song song voi PDF).
// Dua tren cau truc song ngu chuan cua hoa don GTGT dien tu VN (ND123/TT78), da kiem tra
// khop voi 2 dinh dang pho bien: EasyInvoice/Viettel (co nhan "Seller:"/"Buyer:" ro rang)
// va MISA meInvoice (ten cong ty ban nam ngay dau trang, khong co nhan "Seller:").
// Ket qua CHI la goi y, luon can nguoi dung ra soat lai truoc khi luu.
async function extractPdfInvoiceInfo(filePath, companyTaxCode) {
  const buffer = fs.readFileSync(filePath);
  let text = '';
  try {
    const data = await pdfParse(buffer);
    text = data.text || '';
  } catch (err) {
    return { error: 'Không đọc được nội dung PDF (có thể là file ảnh scan, không phải văn bản).', source: 'pdf' };
  }

  const invoiceNo = firstMatch(text, [
    /S[oố]\s*\(\s*No\.?\s*\)\s*[:：]?\s*(\d{1,10})/i,
    /\bNo\.?\s*[:：]\s*(\d{1,10})/i,
  ]);
  const invoiceSerial = firstMatch(text, [
    /K[yý]\s*hi[eệ]u\s*\(\s*Serial\s*\)\s*[:：]?\s*([A-Z0-9]{5,12})/i,
  ]);

  let invoiceDate = null;
  const dateSpelled = text.match(/Ng[aà]y\s*\(Date\)\s*(\d{1,2})\s*th[aá]ng\s*\(month\)\s*(\d{1,2})\s*n[ăa]m\s*\(year\)\s*(\d{4})/i);
  if (dateSpelled) {
    invoiceDate = `${dateSpelled[3]}-${dateSpelled[2].padStart(2, '0')}-${dateSpelled[1].padStart(2, '0')}`;
  } else {
    const fallbackDate = firstMatch(text, [
      /K[yý]\s*ng[aà]y\s*[:：]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    ]);
    invoiceDate = normalizeDate(fallbackDate);
  }

  // Tong tien: cho phep bat ky chu gi giua "Tong cong" va dau hai cham (vd "(Total):")
  let totalAmount = null;
  const totalLineMatch = text.match(/T[oổ]ng\s*c[oộ]ng[^\n:：]*[:：]\s*([\d.,\s]+)/i);
  if (totalLineMatch) {
    const numbers = totalLineMatch[1].trim().split(/\s+/).filter(Boolean);
    if (numbers.length) totalAmount = parseVnNumber(numbers[numbers.length - 1]);
  }

  // Tim tat ca vi tri "Ma so thue" + ma so, kem ngu canh phia truoc de doan vai tro (ban/mua)
  const taxCodeMatches = [...text.matchAll(/M[aã]\s*s[oố]\s*thu[eế]\s*\(?\s*Tax code\s*\)?\s*[:：]?\s*([\d\-]{8,15})/gi)];

  let sellerTaxCode = null, buyerTaxCode = null;
  for (const m of taxCodeMatches) {
    const before = text.slice(Math.max(0, m.index - 150), m.index).toLowerCase();
    const isSellerCtx = /b[aá]n h[aà]ng|seller/.test(before);
    const isBuyerCtx = /mua h[aà]ng|buyer|company'?s name/.test(before);
    if (isSellerCtx && !sellerTaxCode) sellerTaxCode = m[1];
    else if (isBuyerCtx && !buyerTaxCode) buyerTaxCode = m[1];
  }
  // Neu khong doan duoc theo ngu canh, mac dinh: ma dau tien = ban, ma thu hai = mua
  if (!sellerTaxCode && !buyerTaxCode && taxCodeMatches.length >= 2) {
    sellerTaxCode = taxCodeMatches[0][1];
    buyerTaxCode = taxCodeMatches[1][1];
  }

  const sellerNameExplicit = firstMatch(text, [/Đơn vị bán hàng\s*\(Seller\)\s*[:：]\s*([^\n]+)/i]);
  const buyerNameExplicit = firstMatch(text, [/Tên đơn vị\s*\(Company'?s name\)\s*[:：]\s*([^\n]+)/i]);

  // Format MISA: ten cong ty ban thuong la dong dau tien cua ca file (truoc "Ma so thue")
  let sellerNameGuess = sellerNameExplicit;
  if (!sellerNameGuess) {
    const firstTaxIdx = text.search(/M[aã]\s*s[oố]\s*thu[eế]/i);
    if (firstTaxIdx > 0) {
      const headerText = text.slice(0, firstTaxIdx).trim();
      const lines = headerText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length) sellerNameGuess = lines[0];
    }
  }

  // Xac dinh vai tro cua chinh minh (Ban hay Mua) bang cach so sanh MST cong ty
  let role = null; // 'seller' | 'buyer'
  if (companyTaxCode) {
    if (sellerTaxCode && sellerTaxCode.startsWith(companyTaxCode)) role = 'seller';
    else if (buyerTaxCode && buyerTaxCode.startsWith(companyTaxCode)) role = 'buyer';
  }

  return {
    text,
    invoiceNo: invoiceNo || null,
    invoiceSerial: invoiceSerial || null,
    invoiceDate,
    totalAmount,
    sellerName: cleanText(sellerNameGuess),
    sellerTaxCode: sellerTaxCode || null,
    buyerName: cleanText(buyerNameExplicit),
    buyerTaxCode: buyerTaxCode || null,
    role,
    source: 'pdf',
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

function cleanText(s) {
  if (!s) return null;
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = { extractPdfInvoiceInfo };
