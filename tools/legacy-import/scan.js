#!/usr/bin/env node
/*
 * Cong cu QUET & DOC THU chung tu cu (Bao gia / Hoa don / BBBG / DNTT) de chuan bi
 * "Nhap lieu hang loat du lieu qua khu" cho ERP Lite.
 *
 * CACH DUNG:
 *   node tools/legacy-import/scan.js "<duong dan thu muc goc chua tat ca cac don hang cu>" [MST-cong-ty]
 *
 * VD:
 *   node tools/legacy-import/scan.js "D:\Chung tu cu 2024-2026" 0318606297
 *
 * KET QUA: file "legacy-orders-review.xlsx" duoc tao trong thu muc hien tai - MO FILE NAY,
 * RA SOAT KY TUNG DONG (dac biet cac dong danh dau "Can kiem tra") TRUOC KHI dung de nhap
 * vao he thong o buoc tiep theo. Day CHI la ban goi y tu dong doc, KHONG tu dong luu vao ERP.
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { extractXmlInvoiceInfo } = require('./xmlInvoiceExtract');
const { extractPdfInvoiceInfo } = require('./pdfInvoiceExtract');

const DEFAULT_COMPANY_TAX_CODE = '0318606297'; // MST IT Hoan Hao - doi neu can qua tham so dong lenh
const IGNORE_FILENAMES = ['desktop.ini'];

const CATEGORY_KEYWORDS = {
  quotation: ['bao gia', 'báo giá', 'quotation'],
  invoice: ['hoa don', 'hóa đơn', 'hoá đơn', 'invoice', 'hoadon'],
  bbbg: ['bbbg', 'bien ban giao hang', 'biên bản giao hàng', 'biên bản bàn giao'],
  dntt: ['dntt', 'đntt', 'de nghi thanh toan', 'đề nghị thanh toán'],
};

async function main() {
  const rootDir = process.argv[2];
  const companyTaxCode = process.argv[3] || DEFAULT_COMPANY_TAX_CODE;

  if (!rootDir || !fs.existsSync(rootDir)) {
    console.error('Vui lòng truyền đúng đường dẫn thư mục gốc chứa chứng từ cũ.');
    console.error('VD: node scan.js "D:\\Chung tu cu 2024-2026" 0318606297');
    process.exit(1);
  }

  console.log(`Đang quét thư mục: ${rootDir}`);
  console.log(`Mã số thuế công ty dùng để xác định Bán/Mua: ${companyTaxCode}`);

  const allFiles = [];
  walk(rootDir, allFiles);
  console.log(`Tìm thấy ${allFiles.length} file (đã loại desktop.ini, file tạm ~$/~WRL...).`);

  // Nhom file theo "don hang" (thu muc cha gan nhat khong phai la thu muc phan loai)
  const orderGroups = new Map();
  for (const filePath of allFiles) {
    const { orderFolder, category } = classify(filePath, rootDir);
    if (!orderGroups.has(orderFolder)) orderGroups.set(orderFolder, { quotation: [], invoice: [], bbbg: [], dntt: [], other: [] });
    orderGroups.get(orderFolder)[category].push(filePath);
  }

  console.log(`Phát hiện ${orderGroups.size} nhóm đơn hàng.`);

  const rows = [];
  for (const [orderFolder, files] of orderGroups.entries()) {
    if (!files.invoice.length) {
      // Khong co file hoa don nao trong nhom nay -> khong the tao dong du lieu (bo qua, se bao cao rieng)
      if (files.quotation.length || files.bbbg.length || files.dntt.length) {
        rows.push(emptyRow(orderFolder, files, 'Cần kiểm tra', 'Không tìm thấy file Hóa đơn trong nhóm này - kiểm tra thủ công.'));
      }
      continue;
    }

    // Neu nhom nay co kem Bao gia/BBBG/DNTT thi CHAC CHAN day la don BAN (quy trinh ban hang
    // cua IT Hoan Hao luon di kem 3 loai chung tu nay). Dieu nay quan trong vi mot so PDF hoa don
    // tu xuat (EasyInvoice) bi loi thu tu doc nhan/gia tri khi qua pdf-parse, khong the doan
    // Ban/Mua chi tu noi dung PDF trong truong hop nay - phai dua vao ngu canh thu muc.
    const hasSalesSideDocs = files.quotation.length > 0 || files.bbbg.length > 0 || files.dntt.length > 0;

    // Doc thu tung file hoa don, uu tien XML (chinh xac hon PDF)
    const parsedInvoices = [];
    for (const invFile of files.invoice) {
      const ext = path.extname(invFile).toLowerCase();
      try {
        if (ext === '.xml') {
          parsedInvoices.push({ file: invFile, data: extractXmlInvoiceInfo(invFile) });
        } else if (ext === '.pdf') {
          parsedInvoices.push({ file: invFile, data: await extractPdfInvoiceInfo(invFile, companyTaxCode) });
        }
      } catch (err) {
        parsedInvoices.push({ file: invFile, data: { error: err.message } });
      }
    }

    // Gop cac file cung mo ta 1 hoa don that (vd 1 cap pdf+xml) lai theo (invoiceSerial, invoiceNo);
    // uu tien giu ban XML lam du lieu chinh, PDF lam file dinh kem tham chieu.
    const byInvoiceKey = new Map();
    for (const p of parsedInvoices) {
      const key = p.data && p.data.invoiceSerial && p.data.invoiceNo
        ? `${p.data.invoiceSerial}__${p.data.invoiceNo}`
        : `__no_key__${p.file}`;
      if (!byInvoiceKey.has(key)) {
        byInvoiceKey.set(key, { primary: p, extraFiles: [] });
      } else {
        const existing = byInvoiceKey.get(key);
        // Neu ban hien tai la XML va ban dang giu la PDF -> thay the, day PDF cu xuong file dinh kem
        if (p.file.toLowerCase().endsWith('.xml') && !existing.primary.file.toLowerCase().endsWith('.xml')) {
          existing.extraFiles.push(existing.primary.file);
          existing.primary = p;
        } else {
          existing.extraFiles.push(p.file);
        }
      }
    }

    for (const { primary, extraFiles } of byInvoiceKey.values()) {
      const d = primary.data || {};
      if (d.error) {
        rows.push(emptyRow(orderFolder, files, 'Cần kiểm tra', `Lỗi đọc file ${path.basename(primary.file)}: ${d.error}`, primary.file));
        continue;
      }

      let type = 'Không xác định';
      let partnerName = null, partnerTaxCode = null;
      if (hasSalesSideDocs) {
        // Chac chan la don Ban (co Bao gia/BBBG/DNTT kem theo) -> doi tac la nguoi MUA
        type = 'Bán'; partnerName = d.buyerName; partnerTaxCode = d.buyerTaxCode;
      } else if (d.sellerTaxCode && String(d.sellerTaxCode).startsWith(companyTaxCode)) {
        type = 'Bán'; partnerName = d.buyerName; partnerTaxCode = d.buyerTaxCode;
      } else if (d.buyerTaxCode && String(d.buyerTaxCode).startsWith(companyTaxCode)) {
        type = 'Mua'; partnerName = d.sellerName; partnerTaxCode = d.sellerTaxCode;
      } else if (d.role === 'seller') {
        type = 'Bán'; partnerName = d.buyerName; partnerTaxCode = d.buyerTaxCode;
      } else if (d.role === 'buyer') {
        type = 'Mua'; partnerName = d.sellerName; partnerTaxCode = d.sellerTaxCode;
      }

      const otherFiles = [...files.quotation, ...files.bbbg, ...files.dntt, ...extraFiles];
      const missing = [];
      if (type === 'Không xác định') missing.push('loại Bán/Mua');
      if (!partnerName) missing.push('tên đối tác');
      if (!d.totalAmount) missing.push('tổng tiền');
      if (!d.invoiceDate) missing.push('ngày hóa đơn');

      rows.push({
        orderFolder: path.relative(rootDir, orderFolder) || orderFolder,
        type,
        invoiceDate: d.invoiceDate || '',
        invoiceSerial: d.invoiceSerial || '',
        invoiceNo: d.invoiceNo || '',
        partnerName: partnerName || '',
        partnerTaxCode: partnerTaxCode || '',
        totalAmount: d.totalAmount || '',
        status: missing.length ? 'Cần kiểm tra' : 'OK',
        note: missing.length ? `Thiếu/không đọc được: ${missing.join(', ')}` : '',
        invoiceFile: path.relative(rootDir, primary.file),
        otherFiles: otherFiles.map(f => path.relative(rootDir, f)).join(' ; '),
      });
    }
  }

  await writeExcel(rows, 'legacy-orders-review.xlsx');
  console.log(`\nĐã xuất ${rows.length} dòng ra file: legacy-orders-review.xlsx`);
  const needReview = rows.filter(r => r.status === 'Cần kiểm tra').length;
  console.log(`Trong đó có ${needReview} dòng cần kiểm tra lại thủ công (xem cột "Ghi chú").`);
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      if (IGNORE_FILENAMES.includes(entry.name.toLowerCase())) continue;
      if (entry.name.startsWith('~$') || entry.name.startsWith('~WRL')) continue;
      out.push(full);
    }
  }
}

// Xac dinh thu muc "don hang" va loai chung tu cho 1 file, dua theo ten thu muc cha
// (khong phan biet hoa/thuong, khong dau) khop voi tu khoa danh muc.
function classify(filePath, rootDir) {
  const parentDir = path.dirname(filePath);
  const parentName = normalizeForMatch(path.basename(parentDir));

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => parentName.includes(normalizeForMatch(kw)))) {
      // thu muc cha la thu muc phan loai (vd "2. Hoa don") -> don hang la thu muc ong/ba (cha cua no)
      return { orderFolder: path.dirname(parentDir), category };
    }
  }

  // Khong khop thu muc phan loai nao -> thu doan qua chinh ten file, don hang = thu muc cha truc tiep
  const fileName = normalizeForMatch(path.basename(filePath));
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => fileName.includes(normalizeForMatch(kw)))) {
      return { orderFolder: parentDir, category };
    }
  }
  if (path.extname(filePath).toLowerCase() === '.xml') {
    return { orderFolder: parentDir, category: 'invoice' };
  }

  return { orderFolder: parentDir, category: 'other' };
}

function normalizeForMatch(s) {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bo dau tieng Viet
    .toLowerCase();
}

function emptyRow(orderFolder, files, status, note, invoiceFile) {
  const otherFiles = [...files.quotation, ...files.invoice, ...files.bbbg, ...files.dntt];
  return {
    orderFolder: path.basename(orderFolder),
    type: '', invoiceDate: '', invoiceSerial: '', invoiceNo: '',
    partnerName: '', partnerTaxCode: '', totalAmount: '',
    status, note,
    invoiceFile: invoiceFile ? path.basename(invoiceFile) : '',
    otherFiles: otherFiles.map(f => path.basename(f)).join(' ; '),
  };
}

async function writeExcel(rows, outPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Đơn hàng cũ');

  ws.columns = [
    { header: 'Thư mục nguồn', key: 'orderFolder', width: 40 },
    { header: 'Loại', key: 'type', width: 10 },
    { header: 'Ngày HĐ', key: 'invoiceDate', width: 12 },
    { header: 'Ký hiệu', key: 'invoiceSerial', width: 12 },
    { header: 'Số HĐ', key: 'invoiceNo', width: 10 },
    { header: 'Tên đối tác', key: 'partnerName', width: 40 },
    { header: 'MST đối tác', key: 'partnerTaxCode', width: 16 },
    { header: 'Tổng tiền (VND)', key: 'totalAmount', width: 16 },
    { header: 'Trạng thái đọc', key: 'status', width: 14 },
    { header: 'Ghi chú', key: 'note', width: 40 },
    { header: 'File hóa đơn', key: 'invoiceFile', width: 40 },
    { header: 'File đính kèm khác (báo giá/BBBG/ĐNTT...)', key: 'otherFiles', width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };

  for (const r of rows) {
    const row = ws.addRow(r);
    if (r.status === 'Cần kiểm tra') {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      });
    }
  }
  ws.getColumn('totalAmount').numFmt = '#,##0';
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(outPath);
}

main().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
