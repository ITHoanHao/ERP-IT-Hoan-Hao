const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

function drawInfoTable(doc, y, rows) {
  const labelW = 260, valueW = 275, x = 50, rightX = x + labelW;
  const tableWidth = labelW + valueW;
  rows.forEach(([label, value]) => {
    doc.font('vn-bold').fontSize(9);
    const labelHeight = doc.heightOfString(label, { width: labelW - 10 });
    doc.font('vn').fontSize(9);
    const valueHeight = doc.heightOfString(value || '', { width: valueW - 10 });
    const rowH = Math.max(labelHeight, valueHeight, 18) + 10;

    doc.rect(x, y, labelW, rowH).stroke();
    doc.rect(rightX, y, valueW, rowH).stroke();
    doc.font('vn-bold').fontSize(9).text(label, x + 5, y + 5, { width: labelW - 10 });
    doc.font('vn').fontSize(9).text(value || '', rightX + 5, y + 5, { width: valueW - 10 });
    y += rowH;
  });
  return y;
}

function generateLicenseOrderPdf(res, license, tenant, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ThongTinDatHang-${license.license_no}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  doc.font('vn-bold').fontSize(13).text('THÔNG TIN YÊU CẦU ĐẶT HÀNG LICENSE', 0, 45, { align: 'center', width: 595 });
  doc.font('vn').fontSize(10).text(`(License: ${license.license_name} — Số lượng: ${license.quantity})`, 0, 65, { align: 'center', width: 595 });

  let y = 100;
  doc.font('vn-bold').fontSize(11).text('1/. Thông tin đơn vị mua & lấy hóa đơn VAT', 50, y);
  y += 20;

  const companyName = settings.company_name || 'CÔNG TY TNHH IT HOÀN HẢO';
  y = drawInfoTable(doc, y, [
    ['Tên công ty:\nCompany name', companyName],
    ['Địa chỉ trụ sở:\nRegistered business address', settings.company_address || ''],
    ['Mã số thuế:\nTax code', settings.company_tax_code || ''],
    ['Điện thoại công ty:\nCompany phone', settings.company_phone || ''],
    ['Người nhận giấy tờ:\nRecipient of documents', settings.recipient_name || ''],
    ['Điện thoại người nhận:\nPhone of recipient', settings.recipient_phone || ''],
    ['Địa chỉ giao nhận giấy tờ:\nAddress to receive documents', settings.company_address || ''],
    ['Email nhận hóa đơn điện tử:\nAccountant email', settings.accountant_email || ''],
    ['Email nhận thông tin bản quyền:\nEmail to get license (reseller)', settings.reseller_license_email || ''],
  ]);

  y += 20;
  if (y > 650) { doc.addPage(); y = 50; }
  doc.font('vn-bold').fontSize(11).text('2/. Thông tin người dùng cuối (End-User) đăng ký bản quyền', 50, y);
  y += 20;

  const t = tenant || {};
  y = drawInfoTable(doc, y, [
    ['1/ Tên công ty:\nCompany name', t.end_user_company_name || license.customer_name || ''],
    ['2/ Địa chỉ:\nAddress', t.end_user_address || ''],
    ['3/ Điện thoại:\nPhone', t.end_user_phone || ''],
    ['4/ Người quản lý License:\nLicense manager', t.license_manager_name || ''],
    ['5/ Email quản trị/nhận License:\nAdmin email', t.admin_email || ''],
    ['6/ Tenant / domain .onmicrosoft.com:\nTenant domain', t.tenant_domain || ''],
  ]);

  y += 30;
  doc.font('vn').fontSize(8).fillColor('#888888').text(
    `Xuất từ hệ thống ERP Lite - ${companyName} - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`,
    50, y
  );

  doc.end();
}

function generateAutodeskOrderPdf(res, license, profile, settings) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ThongTinDatHang-${license.license_no}.pdf"`);
  doc.pipe(res);
  doc.registerFont('vn', FONT);
  doc.registerFont('vn-bold', FONT_BOLD);
  doc.font('vn');

  doc.font('vn-bold').fontSize(13).text('THÔNG TIN YÊU CẦU ĐẶT HÀNG LICENSE AUTODESK', 0, 45, { align: 'center', width: 595 });
  doc.font('vn').fontSize(10).text(`(License: ${license.license_name} — Số lượng: ${license.quantity})`, 0, 65, { align: 'center', width: 595 });

  let y = 100;
  doc.font('vn-bold').fontSize(11).text('1/. Thông tin đơn vị mua & lấy hóa đơn VAT', 50, y);
  y += 20;

  const companyName = settings.company_name || 'CÔNG TY TNHH IT HOÀN HẢO';
  y = drawInfoTable(doc, y, [
    ['Tên công ty:\nCompany name', companyName],
    ['Địa chỉ trụ sở:\nRegistered business address', settings.company_address || ''],
    ['Mã số thuế:\nTax code', settings.company_tax_code || ''],
    ['Điện thoại công ty:\nCompany phone', settings.company_phone || ''],
    ['Người nhận giấy tờ:\nRecipient of documents', settings.recipient_name || ''],
    ['Điện thoại người nhận:\nPhone of recipient', settings.recipient_phone || ''],
    ['Email nhận hóa đơn điện tử:\nAccountant email', settings.accountant_email || ''],
    ['Email nhận thông tin bản quyền:\nEmail to get license (reseller)', settings.reseller_license_email || ''],
  ]);

  y += 20;
  if (y > 650) { doc.addPage(); y = 50; }
  doc.font('vn-bold').fontSize(11).text('2/. Thông tin người dùng cuối (End-User) đăng ký bản quyền Autodesk', 50, y);
  y += 20;

  const p = profile || {};
  y = drawInfoTable(doc, y, [
    ['1/ Tên người dùng cuối:\nEnd user name', p.end_user_name || license.customer_name || ''],
    ['2/ Email nhận license:\nLicense email', p.license_email || ''],
    ['3/ Người quản lý license (email):\nLicense manager email', p.manager_email || ''],
    ['4/ Contract ID', p.contract_id || ''],
    ['5/ Subscription ID', p.subscription_id || ''],
  ]);

  y += 30;
  doc.font('vn').fontSize(8).fillColor('#888888').text(
    `Xuất từ hệ thống ERP Lite - ${companyName} - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`,
    50, y
  );

  doc.end();
}

module.exports = { generateLicenseOrderPdf, generateAutodeskOrderPdf };
