const path = require('path');
const fs = require('fs');
const os = require('os');

// Thu muc luu du lieu THAT (data.db + file dinh kem) - CO DINH, nam NGOAI thu muc code.
// Muc dich: khi nang cap len phien ban moi (giai nen vao thu muc khac), du lieu VAN O NGUYEN DAY,
// khong can copy gi ca. Mac dinh dat trong thu muc ca nhan cua nguoi dung Windows (vd: C:\Users\TenBan\ERPLiteData).
// Neu muon tuy chinh vi tri khac, dat bien moi truong ERP_DATA_DIR truoc khi chay (vd trong start.bat).
const DATA_DIR = process.env.ERP_DATA_DIR
  ? path.resolve(process.env.ERP_DATA_DIR)
  : path.join(os.homedir(), 'ERPLiteData');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'invoices'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads', 'expenses'), { recursive: true });

// ---- Tu dong chuyen du lieu CU (neu co) tu thu muc code sang thu muc moi - CHI LAM 1 LAN ----
// Ap dung cho nguoi dung dang nang cap tu ban truoc (chua co co che nay), tranh phai tu copy tay.
function migrateLegacyFile(name) {
  const newPath = path.join(DATA_DIR, name);
  const legacyPath = path.join(__dirname, '..', name);
  if (!fs.existsSync(newPath) && fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, newPath);
    console.log(`[migration] Da tu dong chuyen ${name} sang thu muc du lieu moi: ${DATA_DIR}`);
  }
}
function migrateLegacyDir(relDir) {
  const newDir = path.join(DATA_DIR, relDir);
  const legacyDir = path.join(__dirname, '..', relDir);
  if (fs.existsSync(legacyDir)) {
    const files = fs.readdirSync(legacyDir).filter(f => f !== '.gitkeep');
    files.forEach(f => {
      const dest = path.join(newDir, f);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(legacyDir, f), dest);
      }
    });
    if (files.length) console.log(`[migration] Da tu dong chuyen ${files.length} file trong ${relDir} sang thu muc du lieu moi`);
  }
}

migrateLegacyFile('data.db');
migrateLegacyFile('data.db-wal');
migrateLegacyFile('data.db-shm');
migrateLegacyDir(path.join('uploads', 'invoices'));
migrateLegacyDir(path.join('uploads', 'expenses'));

module.exports = { DATA_DIR };
