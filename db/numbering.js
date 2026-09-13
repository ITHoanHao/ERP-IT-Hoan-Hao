const dayjs = require('dayjs');

// Sinh ma chung tu dang PREFIX-YYYYMM-####, dem theo bang tuong ung
function genNumber(db, prefix, table, column) {
  const ym = dayjs().format('YYYYMM');
  const like = `${prefix}-${ym}-%`;
  const row = db.prepare(`SELECT ${column} as c FROM ${table} WHERE ${column} LIKE ? ORDER BY id DESC LIMIT 1`).get(like);
  let seq = 1;
  if (row) {
    const parts = row.c.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
}

module.exports = { genNumber };
