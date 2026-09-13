const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { DATA_DIR } = require('../lib/dataDir');
const router = express.Router();

const VALID_TYPES = ['quotation', 'invoice', 'contract', 'asset', 'employee'];
// invoice dung chung thu muc voi co che dinh kem hoa don dien tu da co san (uploads/invoices)
const FOLDER_MAP = { quotation: 'quotations', invoice: 'invoices', contract: 'contracts', asset: 'assets', employee: 'employees' };

Object.values(FOLDER_MAP).forEach(f => fs.mkdirSync(path.join(DATA_DIR, 'uploads', f), { recursive: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = FOLDER_MAP[req.params.entityType] || 'documents';
      cb(null, path.join(DATA_DIR, 'uploads', folder));
    },
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/:entityType/:entityId/upload', upload.single('file'), (req, res) => {
  const { entityType, entityId } = req.params;
  const backUrl = req.body.back_url || '/';
  if (!VALID_TYPES.includes(entityType) || !req.file) {
    return res.redirect(backUrl + '?err=' + encodeURIComponent('Không thể tải lên: thiếu file hoặc loại tài liệu không hợp lệ.'));
  }
  db.prepare(`INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_size, label) VALUES (?,?,?,?,?,?)`)
    .run(entityType, entityId, req.file.originalname, req.file.filename, req.file.size, req.body.label || 'Tài liệu');
  res.redirect(backUrl + '?ok=' + encodeURIComponent('Đã lưu tài liệu thành công.'));
});

// Xoa file dinh kem (dung chung cho moi loai: hoa don, bao gia, hop dong, tai san, nhan vien...) - can mat khau quan tri vien
router.post('/attachments/:attachmentId/delete', (req, res) => {
  const { verifyCurrentUserPassword } = require('../lib/auth');
  const backUrl = req.body._back || req.body.back_url || '/';
  if (!verifyCurrentUserPassword(req, req.body.confirm_password)) {
    return res.redirect(backUrl + '?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }
  const att = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.attachmentId);
  if (!att) return res.redirect(backUrl + '?err=' + encodeURIComponent('Không tìm thấy file đính kèm.'));

  // Xac dinh dung thu muc vat ly de xoa file (invoice dung thu muc rieng 'invoices' nhu co che hoa don dien tu cu)
  const folder = FOLDER_MAP[att.entity_type] || 'documents';
  const filePath = path.join(DATA_DIR, 'uploads', folder, att.file_path);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* bo qua neu file da mat san */ }

  db.prepare('DELETE FROM attachments WHERE id=?').run(att.id);
  console.log(`[XOA] ${new Date().toISOString()} - Bang: attachments, ID: ${att.id} (${att.file_name}), Nguoi thuc hien: user#${req.session.userId}`);
  res.redirect(backUrl + '?ok=' + encodeURIComponent('Đã xóa file đính kèm.'));
});

module.exports = router;
