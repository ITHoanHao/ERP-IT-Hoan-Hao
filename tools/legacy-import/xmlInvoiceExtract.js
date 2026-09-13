const fs = require('fs');

// Trich xuat du lieu tu file XML hoa don dien tu chuan TCT (Nghi dinh 123/Thong tu 78).
// Dung regex don gian (khong can them thu vien parser XML) vi cau truc the rat co dinh:
// <NBan>...<Ten>..</Ten><MST>..</MST>...</NBan>, <NMua>...</NMua>, <TToan>...</TToan>
// Da kiem tra khop voi nhieu phan mem hoa don dien tu khac nhau (EasyInvoice, Viettel S-Invoice,
// MISA meInvoice) - deu dung chung 1 chuan the XML nay du giao dien PDF xuat ra khac nhau.
function extractXmlInvoiceInfo(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  const nLap = tagValue(raw, 'NLap'); // ngay lap: dang YYYY-MM-DD san co
  const khmsHDon = tagValue(raw, 'KHMSHDon'); // mau so hoa don, vd "1"
  const khhDon = tagValue(raw, 'KHHDon'); // ky hieu hoa don, vd C26MTT
  const shDon = tagValue(raw, 'SHDon'); // so hoa don
  // Ky hieu day du nhu in tren PDF/ten file la MAU SO + KY HIEU ghep lai (vd "1" + "C26MTT" = "1C26MTT")
  const fullSerial = `${khmsHDon || ''}${khhDon || ''}` || null;

  const nBanBlock = blockContent(raw, 'NBan');
  const nMuaBlock = blockContent(raw, 'NMua');
  const tToanBlock = blockContent(raw, 'TToan');

  const sellerName = nBanBlock ? tagValue(nBanBlock, 'Ten') : null;
  const sellerTaxCode = nBanBlock ? tagValue(nBanBlock, 'MST') : null;
  const buyerName = nMuaBlock ? tagValue(nMuaBlock, 'Ten') : null;
  const buyerTaxCode = nMuaBlock ? tagValue(nMuaBlock, 'MST') : null;

  let totalAmount = tToanBlock ? tagValue(tToanBlock, 'TgTTTBSo') : null;
  totalAmount = totalAmount ? parseFloat(totalAmount) : null;
  const totalAmountWords = tToanBlock ? tagValue(tToanBlock, 'TgTTTBChu') : null;

  return {
    invoiceDate: nLap || null,
    invoiceSerial: fullSerial,
    invoiceNo: shDon || null,
    sellerName: cleanText(sellerName),
    sellerTaxCode: sellerTaxCode || null,
    buyerName: cleanText(buyerName),
    buyerTaxCode: buyerTaxCode || null,
    totalAmount,
    totalAmountWords: cleanText(totalAmountWords),
    source: 'xml',
  };
}

function tagValue(text, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// Lay noi dung ben trong 1 the cha (vd <NBan>...</NBan>), khong lay nham cua the con trung ten
// (VD ca NBan va NMua deu co <Ten> va <MST> ben trong, phai gioi han pham vi truoc khi doc)
function blockContent(text, tag) {
  const startTag = new RegExp(`<${tag}[^>]*>`, 'i');
  const startMatch = text.match(startTag);
  if (!startMatch) return null;
  const start = startMatch.index + startMatch[0].length;
  const endIdx = text.indexOf(`</${tag}>`, start);
  if (endIdx === -1) return null;
  return text.slice(start, endIdx);
}

function cleanText(s) {
  if (!s) return null;
  return s.replace(/\s+/g, ' ').trim();
}

module.exports = { extractXmlInvoiceInfo };
