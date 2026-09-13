// Bo loc kieu Excel cho bang: click bieu tuong pheu o tieu de cot -> chon gia tri can loc.
// Dung chung cho moi bang co data-filterable-table + th co data-filter-col="<chi so cot, bat dau tu 0>".
// Khong can thu vien ngoai, tu loc bang cach an/hien dong <tr> ngay tren trinh duyet.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('table[data-filterable-table]').forEach(initTableFilter);
});

function initTableFilter(table) {
  const headers = table.querySelectorAll('thead th[data-filter-col]');
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  const activeFilters = {}; // colIndex -> Set cac gia tri duoc phep hien

  function getDataRows() {
    // Bo qua dong "chua co du lieu" (dung colspan) de khong bi tinh nham vao danh sach gia tri loc
    return Array.from(tbody.querySelectorAll('tr')).filter(tr => !tr.querySelector('td[colspan]'));
  }

  function getCellText(tr, colIndex) {
    const td = tr.children[colIndex];
    return td ? td.textContent.trim() : '';
  }

  function applyFilters() {
    getDataRows().forEach(tr => {
      let visible = true;
      for (const colIndex in activeFilters) {
        if (!activeFilters[colIndex].has(getCellText(tr, colIndex))) { visible = false; break; }
      }
      tr.style.display = visible ? '' : 'none';
    });
  }

  headers.forEach(th => {
    const colIndex = parseInt(th.dataset.filterCol, 10);
    th.style.position = 'relative';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-link p-0 ms-1 table-filter-btn';
    btn.innerHTML = '<i class="bi bi-funnel"></i>';
    btn.title = 'Lọc theo cột này';
    btn.style.textDecoration = 'none';
    th.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'card shadow p-2';
    panel.style.cssText = 'position:fixed; z-index:2000; display:none; max-height:320px; overflow-y:auto; min-width:220px; background:#fff;';
    document.body.appendChild(panel);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = panel.style.display === 'block';
      document.querySelectorAll('.table-filter-panel-open').forEach(p => { p.style.display = 'none'; p.classList.remove('table-filter-panel-open'); });
      if (wasOpen) return;

      const rows = getDataRows();
      const uniqueValues = [...new Set(rows.map(tr => getCellText(tr, colIndex)))].sort((a, b) => a.localeCompare(b, 'vi'));
      const currentSelected = activeFilters[colIndex] || new Set(uniqueValues);

      panel.innerHTML = `
        <div class="mb-2 d-flex justify-content-between">
          <button type="button" class="btn btn-sm btn-link p-0 tf-select-all">Chọn tất cả</button>
          <button type="button" class="btn btn-sm btn-link p-0 tf-clear-all">Bỏ chọn</button>
        </div>
        <div class="tf-checklist"></div>
        <div class="mt-2 d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary tf-apply">Áp dụng</button>
          <button type="button" class="btn btn-sm btn-outline-secondary tf-cancel">Đóng</button>
        </div>`;
      const checklist = panel.querySelector('.tf-checklist');
      uniqueValues.forEach(val => {
        const id = 'tf_' + colIndex + '_' + Math.random().toString(36).slice(2);
        const div = document.createElement('div');
        div.className = 'form-check';
        const safeVal = val.replace(/"/g, '&quot;');
        div.innerHTML = `<input class="form-check-input" type="checkbox" value="${safeVal}" id="${id}" ${currentSelected.has(val) ? 'checked' : ''}>
          <label class="form-check-label small" for="${id}">${val === '' ? '(trống)' : val}</label>`;
        checklist.appendChild(div);
      });

      panel.querySelector('.tf-select-all').onclick = () => checklist.querySelectorAll('input').forEach(cb => cb.checked = true);
      panel.querySelector('.tf-clear-all').onclick = () => checklist.querySelectorAll('input').forEach(cb => cb.checked = false);
      panel.querySelector('.tf-cancel').onclick = () => { panel.style.display = 'none'; panel.classList.remove('table-filter-panel-open'); };
      panel.querySelector('.tf-apply').onclick = () => {
        const selected = new Set();
        checklist.querySelectorAll('input:checked').forEach(cb => selected.add(cb.value));
        if (selected.size === uniqueValues.length) delete activeFilters[colIndex];
        else activeFilters[colIndex] = selected;
        applyFilters();
        panel.style.display = 'none';
        panel.classList.remove('table-filter-panel-open');
        btn.classList.toggle('text-primary', activeFilters[colIndex] !== undefined);
        btn.innerHTML = activeFilters[colIndex] !== undefined ? '<i class="bi bi-funnel-fill"></i>' : '<i class="bi bi-funnel"></i>';
      };

      const rect = btn.getBoundingClientRect();
      panel.style.top = (rect.bottom + 4) + 'px';
      panel.style.left = Math.max(4, rect.left - 150) + 'px';
      panel.style.display = 'block';
      panel.classList.add('table-filter-panel-open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.table-filter-panel-open').forEach(p => { p.style.display = 'none'; p.classList.remove('table-filter-panel-open'); });
  });
}
