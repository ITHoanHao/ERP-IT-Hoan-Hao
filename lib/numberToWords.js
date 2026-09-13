// Chuyen so tien (VND, nguyen duong) thanh chu tieng Viet, dung chuan ke toan/hop dong.
// Vi du: 634320000 -> "Sáu trăm ba mươi tư triệu ba trăm hai mươi nghìn đồng"

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function threeDigitsToWords(n, isFirstGroup) {
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  const ten = Math.floor(remainder / 10);
  const unit = remainder % 10;
  let words = [];

  if (hundred > 0 || !isFirstGroup) {
    words.push(DIGITS[hundred] + ' trăm');
  }

  if (ten === 0) {
    if (unit > 0) {
      if (hundred > 0 || !isFirstGroup) words.push('lẻ');
      words.push(DIGITS[unit]);
    }
  } else if (ten === 1) {
    words.push('mười');
    if (unit === 1) words.push('một');
    else if (unit === 5) words.push('lăm');
    else if (unit > 0) words.push(DIGITS[unit]);
  } else {
    words.push(DIGITS[ten] + ' mươi');
    if (unit === 1) words.push('mốt');
    else if (unit === 4) words.push('tư');
    else if (unit === 5) words.push('lăm');
    else if (unit > 0) words.push(DIGITS[unit]);
  }

  return words.join(' ');
}

function numberToVietnameseWords(num) {
  num = Math.round(Math.abs(num));
  if (num === 0) return 'không đồng';

  const units = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups = [];
  let n = num;
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  let parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const isFirstGroup = i === groups.length - 1;
    const groupWords = threeDigitsToWords(groups[i], isFirstGroup);
    parts.push(groupWords + units[i]);
  }

  let result = parts.join(' ').replace(/\s+/g, ' ').trim();
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result + ' đồng';
}

module.exports = { numberToVietnameseWords };
