// Bien bat ky <select class="searchable-select"> thanh o go-de-tim-kiem (khong can jQuery).
// Dung chung cho: chon San pham, Khach hang, Nha cung cap o moi noi trong he thong.
// Ho tro ca dong duoc them sau (vd: bam "+ Them dong" trong Bao gia/Don mua hang).

function initSearchableSelects(root) {
  (root || document).querySelectorAll('select.searchable-select').forEach(el => {
    if (el.tomselect || el.dataset.tomBound) return; // tranh khoi tao trung
    el.dataset.tomBound = '1';
    new TomSelect(el, {
      create: false,
      allowEmptyOption: true,
      placeholder: el.dataset.placeholder || 'Gõ để tìm...',
      maxOptions: 500,
      onChange: function () {
        // Bao cho cac script khac (vd: tinh toan dong bao gia) biet gia tri da doi
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  });
}

document.addEventListener('DOMContentLoaded', () => initSearchableSelects(document));

// Dat gia tri cho 1 select da duoc nang cap thanh Tom Select (hoac select thuong neu chua nang cap)
// setValue() chi doi "gia tri da chon", KHONG tu xoa chu con go do trong o tim kiem (vd khi
// go tim khong thay, bam "+ Them moi..." roi tao xong) -> phai xoa tay bang setTextboxValue('')
// neu khong chu go do se con dinh lai canh ten vua chon, nhin giong bi lap/tran chu.
function tsSetValue(selectEl, value) {
  if (selectEl.tomselect) {
    selectEl.tomselect.setValue(value);
    selectEl.tomselect.setTextboxValue('');
  } else {
    selectEl.value = value;
  }
}

// Them 1 lua chon moi vao select da nang cap Tom Select (hoac select thuong)
function tsAddOption(selectEl, value, text) {
  if (selectEl.tomselect) {
    selectEl.tomselect.addOption({ value: String(value), text });
    selectEl.tomselect.refreshOptions(false);
  } else {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    selectEl.appendChild(opt);
  }
}
