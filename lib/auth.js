const bcrypt = require('bcryptjs');
const db = require('../db');

// Kiem tra mat khau nhap vao co khop voi tai khoan dang dang nhap khong
function verifyCurrentUserPassword(req, password) {
  if (!req.session || !req.session.userId) return false;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return false;
  return bcrypt.compareSync(password || '', user.password_hash);
}

// Xu ly xoa dung chung: yeu cau dung mat khau, bat loi khoa ngoai (du lieu dang duoc tham chieu)
function handleDelete(req, res, { table, id, backUrl, label }) {
  const password = req.body.confirm_password;
  const fallbackBack = req.body._back || backUrl;

  if (!verifyCurrentUserPassword(req, password)) {
    return res.redirect(fallbackBack + '?err=' + encodeURIComponent('Sai mật khẩu quản trị viên — không thể xóa.'));
  }

  try {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    console.log(`[XOA] ${new Date().toISOString()} - Bang: ${table}, ID: ${id}, Nguoi thuc hien: user#${req.session.userId}, Ly do: ${req.body.delete_reason || '(khong ghi)'}`);
    res.redirect(backUrl + '?ok=' + encodeURIComponent(`Đã xóa ${label || 'bản ghi'} thành công.`));
  } catch (e) {
    let msg = 'Không thể xóa: ' + e.message;
    if (/FOREIGN KEY/i.test(e.message)) {
      msg = `Không thể xóa ${label || 'bản ghi này'} vì đang được tham chiếu bởi dữ liệu khác (ví dụ đã có đơn hàng/hóa đơn liên quan) — đây thường là dấu hiệu không nên xóa vì sẽ làm sai lệch dữ liệu đã phát sinh.`;
    }
    res.redirect(fallbackBack + '?err=' + encodeURIComponent(msg));
  }
}

module.exports = { verifyCurrentUserPassword, handleDelete };
