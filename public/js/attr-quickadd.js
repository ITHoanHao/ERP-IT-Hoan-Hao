// Dung chung cho ca form San pham chinh thuc va popup "Them san pham nhanh" trong Bao gia.
// Cho phep them moi Nhom san pham / Thuong hieu / Don vi tinh ngay tai cho, luu lai de dung tiep lan sau.

let attrQuickAddModalInstance = null;
let attrQuickAddTargetSelect = null;
let attrQuickAddType = null;
let attrQuickAddParentModalInstance = null; // modal cha can mo lai sau khi dong (truong hop popup long nhau)

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('attrQuickAddModal');
  if (!el) return;
  attrQuickAddModalInstance = new bootstrap.Modal(el);
  document.getElementById('attrQuickAddCancelBtn').addEventListener('click', () => {
    if (attrQuickAddParentModalInstance) {
      attrQuickAddModalInstance.hide();
      attrQuickAddParentModalInstance.show();
      attrQuickAddParentModalInstance = null;
    }
  });
});

const ATTR_LABELS = {
  category: { title: 'Thêm nhóm sản phẩm mới', label: 'Tên nhóm sản phẩm' },
  brand: { title: 'Thêm thương hiệu mới', label: 'Tên thương hiệu' },
  unit: { title: 'Thêm đơn vị tính mới', label: 'Tên đơn vị tính' },
  position: { title: 'Thêm chức vụ mới', label: 'Tên chức vụ' },
  branch: { title: 'Thêm chi nhánh/phòng ban mới', label: 'Tên chi nhánh/phòng ban' },
  bank: { title: 'Thêm ngân hàng mới', label: 'Tên ngân hàng' },
};

// selectEl: the <select> that triggered this (via "+ Thêm mới..." option)
// attrType: 'category' | 'brand' | 'unit'
// parentModalInstance: neu popup nay dang nam trong 1 modal khac, truyen modal do vao de tam an/hien lai
function handleAttrSelect(selectEl, attrType, parentModalInstance) {
  if (selectEl.value !== '__add_new__') return;
  attrQuickAddTargetSelect = selectEl;
  attrQuickAddType = attrType;
  selectEl.value = ''; // ve trang thai chua chon trong luc mo popup

  const info = ATTR_LABELS[attrType];
  document.getElementById('attrQuickAddTitle').textContent = info.title;
  document.getElementById('attrQuickAddLabel').textContent = info.label;
  document.getElementById('attrQuickAddInput').value = '';
  document.getElementById('attrQuickAddError').classList.add('d-none');

  if (parentModalInstance) {
    attrQuickAddParentModalInstance = parentModalInstance;
    parentModalInstance.hide();
  }
  attrQuickAddModalInstance.show();
  setTimeout(() => document.getElementById('attrQuickAddInput').focus(), 300);
}

async function submitAttrQuickAdd() {
  const value = document.getElementById('attrQuickAddInput').value.trim();
  const errBox = document.getElementById('attrQuickAddError');
  if (!value) {
    errBox.textContent = 'Vui lòng nhập giá trị.';
    errBox.classList.remove('d-none');
    return;
  }
  try {
    const res = await fetch('/product-attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ attr_type: attrQuickAddType, value }),
    });
    if (!res.ok) throw new Error('Lỗi máy chủ');
    const data = await res.json();

    // Them option moi vao TAT CA select cung loai tren trang (kể cả trong <template> cho dong them sau)
    const selector = `select[data-attr-type="${attrQuickAddType}"]`;
    document.querySelectorAll(selector).forEach(sel => {
      if (![...sel.options].some(o => o.value === data.value)) {
        const opt = document.createElement('option');
        opt.value = data.value;
        opt.textContent = data.value;
        // chen truoc option "+ Them moi..." (luon la option cuoi cung)
        sel.insertBefore(opt, sel.lastElementChild);
      }
    });
    document.querySelectorAll('template').forEach(tpl => {
      const sel = tpl.content.querySelector(selector);
      if (sel && ![...sel.options].some(o => o.value === data.value)) {
        const opt = document.createElement('option');
        opt.value = data.value;
        opt.textContent = data.value;
        sel.insertBefore(opt, sel.lastElementChild);
      }
    });

    if (attrQuickAddTargetSelect) {
      attrQuickAddTargetSelect.value = data.value;
    }
    attrQuickAddModalInstance.hide();
    if (attrQuickAddParentModalInstance) {
      attrQuickAddParentModalInstance.show();
      attrQuickAddParentModalInstance = null;
    }
  } catch (e) {
    errBox.textContent = 'Không thể lưu: ' + e.message;
    errBox.classList.remove('d-none');
  }
}
