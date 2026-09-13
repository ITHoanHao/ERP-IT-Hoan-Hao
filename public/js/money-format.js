// Dinh dang tien te kieu VN: tu dong them dau cham ngan cach hang nghin khi go
// ".money-input"          -> chi so nguyen (hạn mức công nợ, số tiền thu/chi...)
// ".money-input-decimal"  -> cho phep so le, dau phay la phan thap phan (don gia san pham)

function formatVnNumber(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/\D/g, '');
  if (!cleaned) return '';
  return parseInt(cleaned, 10).toLocaleString('vi-VN');
}

// Dinh dang kieu "416.666,666667": dau cham ngan cach hang nghin, dau phay la phan thap phan
function formatVnDecimal(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^\d,]/g, ''); // chi giu so va dau phay
  const firstComma = cleaned.indexOf(',');
  if (firstComma !== -1) {
    // chi giu dau phay dau tien, bo cac dau phay thua sau do
    cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
  }
  let [intPart, decPart] = cleaned.split(',');
  intPart = intPart.replace(/^0+(?=\d)/, ''); // bo so 0 thua dau chuoi
  if (!intPart) intPart = '0';
  const intFormatted = parseInt(intPart, 10).toLocaleString('vi-VN');
  if (decPart !== undefined) {
    decPart = decPart.slice(0, 6); // toi da 6 chu so thap phan (khop do chinh xac hoa don dien tu)
    return intFormatted + ',' + decPart;
  }
  return cleaned.endsWith(',') ? intFormatted + ',' : intFormatted;
}

function attachMoneyFormatting(root) {
  (root || document).querySelectorAll('.money-input').forEach(el => {
    if (el.dataset.moneyBound) return;
    el.dataset.moneyBound = '1';
    el.setAttribute('type', 'text');
    el.setAttribute('inputmode', 'numeric');
    el.setAttribute('autocomplete', 'off');
    if (el.value) el.value = formatVnNumber(el.value);
    el.addEventListener('input', function () {
      const cursorFromEnd = this.value.length - this.selectionStart;
      this.value = formatVnNumber(this.value);
      const newPos = Math.max(0, this.value.length - cursorFromEnd);
      this.setSelectionRange(newPos, newPos);
      this.dispatchEvent(new Event('money-changed', { bubbles: true }));
    });
  });

  (root || document).querySelectorAll('.money-input-decimal').forEach(el => {
    if (el.dataset.moneyBound) return;
    el.dataset.moneyBound = '1';
    el.setAttribute('type', 'text');
    el.setAttribute('inputmode', 'decimal');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('placeholder', el.getAttribute('placeholder') || 'VD: 416.667 hoặc 416.666,67');
    if (el.value) el.value = formatVnDecimal(el.value);
    el.addEventListener('input', function () {
      const cursorFromEnd = this.value.length - this.selectionStart;
      this.value = formatVnDecimal(this.value);
      const newPos = Math.max(0, this.value.length - cursorFromEnd);
      this.setSelectionRange(newPos, newPos);
      this.dispatchEvent(new Event('money-changed', { bubbles: true }));
    });
  });
}

function rawMoneyValue(el) {
  return (el.value || '').replace(/\D/g, '') || '0';
}

// Tra ve chuoi so dang JS chuan (dau cham la thap phan) tu o nhap kieu VN co the co so le
function rawMoneyDecimalValue(el) {
  const v = (el.value || '').trim();
  if (!v) return '0';
  const noThousands = v.replace(/\./g, ''); // bo dau cham ngan cach hang nghin
  const jsNumber = noThousands.replace(',', '.'); // doi dau phay thanh dau cham thap phan
  return jsNumber || '0';
}

document.addEventListener('DOMContentLoaded', () => attachMoneyFormatting(document));

// Truoc khi submit bat ky form nao, chuyen cac o tien ve dung dinh dang so de server nhan dung
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form.querySelectorAll) return;
  form.querySelectorAll('.money-input').forEach(el => {
    el.value = rawMoneyValue(el);
  });
  form.querySelectorAll('.money-input-decimal').forEach(el => {
    el.value = rawMoneyDecimalValue(el);
  });
});
