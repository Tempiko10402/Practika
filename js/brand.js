/**
 * brand.js — Управление марками автомобилей
 * Стиль: аналогично admin.js
 * Прокси: server.py → /api/* → http://192.168.89.58:5104
 */

// ─── Auth Guard ───────────────────────────────────────────────────────────
(function authGuard() {
  const token = localStorage.getItem('accessToken');
  if (!token) window.location.replace('aut.html');
})();

// ─── State ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
let currentPage = 1;
let totalBrands  = 0;
let allBrands    = [];      // кэш текущей страницы
let searchQuery  = '';
let filterStatus = 'all';   // 'all' | 'active' | 'inactive'
let editingBrand = null;    // бренд в режиме редактирования
let statusBrand  = null;    // бренд для смены статуса

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getToken() { return localStorage.getItem('accessToken') || ''; }

function authHeaders() {
  const t = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

function authHeadersForm() {
  const t = getToken();
  const h = {};
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

/**
 * Разобрать ошибку от сервера в читаемую строку
 */
async function extractError(res) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) {
      const data = await res.json();
      // Разные форматы ошибок от .NET / custom API
      if (typeof data === 'string') return data;
      if (data.message)  return data.message;
      if (data.title)    return data.title;
      if (data.error)    return data.error;
      if (data.errors) {
        // ASP.NET validation errors: { errors: { Field: ["msg"] } }
        const msgs = Object.values(data.errors).flat();
        if (msgs.length) return msgs.join('; ');
      }
      return JSON.stringify(data);
    }
    const text = await res.text();
    return text || `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────
function showSkeleton() {
  const tbody = document.getElementById('brands-tbody');
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<tr class="skeleton-row">
      <td><div style="display:flex;align-items:center;gap:12px">
        <div class="skeleton avatar"></div>
        <div><div class="skeleton w-60" style="width:120px;margin-bottom:6px"></div>
        <div class="skeleton w-40" style="width:80px;height:10px"></div></div>
      </div></td>
      <td><div class="skeleton w-logo"></div></td>
      <td><div class="skeleton w-30" style="width:70px"></div></td>
      <td><div class="skeleton w-30" style="width:80px"></div></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

// ─── Load Brands ──────────────────────────────────────────────────────────
async function loadBrands() {
  showSkeleton();

  const body = {
    page:     currentPage,
    pageSize: PAGE_SIZE,
  };
  if (searchQuery) body.name = searchQuery;
  if (filterStatus !== 'all') body.isActive = (filterStatus === 'active');

  try {
    const res = await fetch('/api/Brand/GetBrands', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    if (!res.ok) {
      const errMsg = await extractError(res);
      showToast(`Ошибка загрузки: ${errMsg}`, 'error');
      renderBrandsError();
      return;
    }

    const data = await res.json();
    renderBrands(data);

  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
    renderBrandsError();
  }
}

function renderBrandsError() {
  document.getElementById('brands-tbody').innerHTML = `
    <tr><td colspan="4">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <h3>Ошибка загрузки</h3>
        <p>Не удалось получить список брендов</p>
      </div>
    </td></tr>`;
  document.getElementById('table-info').textContent = 'Ошибка';
  document.getElementById('pagination').innerHTML = '';
}

function renderBrands(data) {
  const tbody = document.getElementById('brands-tbody');
  let brands = [];
  let total  = 0;

  if (Array.isArray(data)) {
    brands = data; total = data.length;
  } else if (data?.items) {
    brands = data.items; total = data.totalCount || data.items.length;
  } else if (data?.data) {
    brands = data.data; total = data.totalCount || data.total || data.data.length;
  } else if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k])) { brands = data[k]; break; }
    }
    total = data.totalCount || data.total || brands.length;
  }

  allBrands    = brands;
  totalBrands  = total;

  // Stats
  const active   = brands.filter(b => b.isActive || b.IsActive).length;
  const inactive = brands.length - active;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-active').textContent   = active;
  document.getElementById('stat-inactive').textContent = inactive;

  if (brands.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM5 11l1.5-4.5h11L19 11H5z"/></svg>
          <h3>Бренды не найдены</h3>
          <p>Попробуйте изменить фильтры или добавьте первый бренд</p>
        </div>
      </td></tr>`;
    document.getElementById('table-info').textContent = 'Нет записей';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  let html = '';
  brands.forEach(b => {
    const name     = b.name     || b.Name     || '—';
    const id       = b.id       || b.Id       || '';
    const isActive = b.isActive ?? b.IsActive ?? true;
    const logoUrl  = b.logoUrl  || b.LogoUrl  || b.logo || b.Logo || '';

    const logoThumb = logoUrl
      ? `<div class="brand-logo-thumb"><img src="${escHtml(logoUrl)}" alt="${escHtml(name)}" onerror="this.parentElement.innerHTML='🚗'" /></div>`
      : `<div class="brand-logo-thumb">🚗</div>`;

    const logoCell = logoUrl
      ? `<div class="logo-cell"><img src="${escHtml(logoUrl)}" alt="${escHtml(name)}" onerror="this.parentElement.innerHTML='<div class=\\'no-logo\\'>🚫</div>'" /></div>`
      : `<div class="logo-cell"><div class="no-logo">—</div></div>`;

    const brandData = encodeURIComponent(JSON.stringify(b));

    html += `<tr>
      <td>
        <div class="brand-cell">
          ${logoThumb}
          <div>
            <div class="brand-name-text">${escHtml(name)}</div>
            <div class="brand-id-text" title="Нажмите чтобы скопировать ID" onclick="copyBrandId('${escHtml(id)}')">${escHtml(id) || '—'}</div>
          </div>
        </div>
      </td>
      <td>${logoCell}</td>
      <td>
        <span class="status-dot ${isActive ? 'active' : 'inactive'}">
          ${isActive ? 'Активен' : 'Неактивен'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Редактировать" onclick='openEditModal(${JSON.stringify(b)})'>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="action-btn toggle-status" title="Изменить статус" onclick='openStatusModal(${JSON.stringify(b)})'>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  });

  tbody.innerHTML = html;

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);
  document.getElementById('table-info').textContent = `${start}–${end} из ${total}`;

  let pag = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
  </button>`;

  const maxV = 5;
  let sp = Math.max(1, currentPage - Math.floor(maxV / 2));
  let ep = Math.min(totalPages, sp + maxV - 1);
  if (ep - sp < maxV - 1) sp = Math.max(1, ep - maxV + 1);
  for (let i = sp; i <= ep; i++) {
    pag += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  pag += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
  </button>`;

  document.getElementById('pagination').innerHTML = pag;
}

function goToPage(page) {
  currentPage = page;
  loadBrands();
}

// ─── Copy ID ──────────────────────────────────────────────────────────────
function copyBrandId(id) {
  navigator.clipboard.writeText(id).then(() => {
    showToast('ID скопирован в буфер обмена', 'success');
  }).catch(() => {
    showToast('Не удалось скопировать', 'error');
  });
}

// ─── File zone setup ──────────────────────────────────────────────────────
function setupFileZone(inputId, zoneId, previewId, nameId) {
  const input   = document.getElementById(inputId);
  const zone    = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  const nameEl  = document.getElementById(nameId);

  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) applyFile(file, zone, preview, nameEl);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      applyFile(file, zone, preview, nameEl);
    }
  });
}

function applyFile(file, zone, preview, nameEl) {
  const reader = new FileReader();
  reader.onload = e => {
    preview.src = e.target.result;
    zone.classList.add('has-file');
  };
  reader.readAsDataURL(file);
  if (nameEl) nameEl.textContent = file.name;
}

function resetFileZone(zoneId, inputId, previewId, nameId) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const nameEl  = document.getElementById(nameId);
  zone?.classList.remove('has-file');
  if (input)   input.value = '';
  if (preview) preview.src = '';
  if (nameEl)  nameEl.textContent = inputId === 'cb-logo' ? 'Нажмите или перетащите файл' : 'Нажмите или перетащите файл';
}

// ─── Create Brand ─────────────────────────────────────────────────────────
function openCreateModal() {
  document.getElementById('create-brand-form').reset();
  clearFieldErr('cb-name', 'err-cb-name');
  resetFileZone('cb-zone', 'cb-logo', 'cb-preview', 'cb-file-name');
  document.getElementById('modal-create').classList.add('visible');
}

function closeCreateModal() {
  document.getElementById('modal-create').classList.remove('visible');
}

async function submitCreate() {
  const name = document.getElementById('cb-name').value.trim();
  if (!name) {
    setFieldErr('cb-name', 'err-cb-name', 'Введите название бренда');
    return;
  }

  const btn     = document.getElementById('btn-submit-create');
  const spinner = document.getElementById('create-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const formData = new FormData();
    const logoFile = document.getElementById('cb-logo').files[0];
    if (logoFile) formData.append('LogoImage', logoFile);

    const res = await fetch(`/api/Brand/CreateBrand?Name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: authHeadersForm(),
      body: logoFile ? formData : undefined
    });

    if (res.status === 401) { localStorage.removeItem('accessToken'); window.location.replace('aut.html'); return; }

    if (res.ok) {
      showToast(`Бренд «${name}» успешно создан!`, 'success');
      closeCreateModal();
      currentPage = 1;
      loadBrands();
    } else {
      const errMsg = await extractError(res);
      showToast(`Ошибка: ${errMsg}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Edit Brand ───────────────────────────────────────────────────────────
function openEditModal(brand) {
  editingBrand = brand;
  document.getElementById('eb-name').value = brand.name || brand.Name || '';
  clearFieldErr('eb-name', 'err-eb-name');
  resetFileZone('eb-zone', 'eb-logo', 'eb-preview', 'eb-file-name');
  document.getElementById('modal-edit').classList.add('visible');
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('visible');
  editingBrand = null;
}

async function submitEdit() {
  if (!editingBrand) return;

  const name = document.getElementById('eb-name').value.trim();
  if (!name) {
    setFieldErr('eb-name', 'err-eb-name', 'Введите название бренда');
    return;
  }

  const id      = editingBrand.id || editingBrand.Id || '';
  const btn     = document.getElementById('btn-submit-edit');
  const spinner = document.getElementById('edit-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const formData = new FormData();
    const logoFile = document.getElementById('eb-logo').files[0];
    if (logoFile) formData.append('LogoImage', logoFile);

    const res = await fetch(
      `/api/Brand/UpdateBrand?Id=${encodeURIComponent(id)}&Name=${encodeURIComponent(name)}`,
      { method: 'PUT', headers: authHeadersForm(), body: logoFile ? formData : undefined }
    );

    if (res.status === 401) { localStorage.removeItem('accessToken'); window.location.replace('aut.html'); return; }

    if (res.ok) {
      showToast(`Бренд «${name}» обновлён!`, 'success');
      closeEditModal();
      loadBrands();
    } else {
      const errMsg = await extractError(res);
      showToast(`Ошибка: ${errMsg}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Change Status ────────────────────────────────────────────────────────
function openStatusModal(brand) {
  statusBrand = brand;
  const name     = brand.name || brand.Name || '—';
  const isActive = brand.isActive ?? brand.IsActive ?? true;

  document.getElementById('status-brand-name').textContent = name;
  document.getElementById('status-confirm-sub').textContent =
    isActive ? 'Сейчас бренд активен. Выберите новый статус:' : 'Сейчас бренд неактивен. Выберите новый статус:';

  // Устанавливаем текущий статус
  document.getElementById('radio-active').checked   = isActive;
  document.getElementById('radio-inactive').checked = !isActive;

  document.getElementById('modal-status').classList.add('visible');
}

function closeStatusModal() {
  document.getElementById('modal-status').classList.remove('visible');
  statusBrand = null;
}

async function submitStatus() {
  if (!statusBrand) return;

  const isActive = document.getElementById('radio-active').checked;
  const id       = statusBrand.id || statusBrand.Id || '';
  const name     = statusBrand.name || statusBrand.Name || '';

  const btn     = document.getElementById('btn-submit-status');
  const spinner = document.getElementById('status-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const res = await fetch('/api/Brand/ChangeBrandStatus', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ id, isActive })
    });

    if (res.status === 401) { localStorage.removeItem('accessToken'); window.location.replace('aut.html'); return; }

    if (res.ok) {
      const label = isActive ? 'активен' : 'неактивен';
      showToast(`Бренд «${name}» теперь ${label}`, 'success');
      closeStatusModal();
      loadBrands();
    } else {
      const errMsg = await extractError(res);
      showToast(`Ошибка: ${errMsg}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────
function setFieldErr(inputId, errId, msg) {
  document.getElementById(inputId)?.classList.add('invalid');
  const el = document.getElementById(errId);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}

function clearFieldErr(inputId, errId) {
  document.getElementById(inputId)?.classList.remove('invalid');
  const el = document.getElementById(errId);
  if (el) { el.textContent = ''; el.classList.remove('visible'); }
}

// ─── Search & Filter ──────────────────────────────────────────────────────
let searchTimer = null;
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    currentPage = 1;
    loadBrands();
  }, 1200);
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterStatus = btn.dataset.filter;
    currentPage  = 1;
    loadBrands();
  });
});

// ─── Event Listeners ──────────────────────────────────────────────────────
document.getElementById('btn-create-brand').addEventListener('click', openCreateModal);
document.getElementById('btn-refresh').addEventListener('click', loadBrands);

// Create modal
document.getElementById('modal-close-btn').addEventListener('click', closeCreateModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeCreateModal);
document.getElementById('btn-submit-create').addEventListener('click', submitCreate);

// Edit modal
document.getElementById('modal-edit-close').addEventListener('click', closeEditModal);
document.getElementById('modal-edit-cancel').addEventListener('click', closeEditModal);
document.getElementById('btn-submit-edit').addEventListener('click', submitEdit);

// Status modal
document.getElementById('modal-status-close').addEventListener('click', closeStatusModal);
document.getElementById('modal-status-cancel').addEventListener('click', closeStatusModal);
document.getElementById('btn-submit-status').addEventListener('click', submitStatus);

// Home / Logout
document.getElementById('btn-home').addEventListener('click', () => { window.location.href = 'main.html'; });
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.replace('aut.html');
});

// Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCreateModal();
    closeEditModal();
    closeStatusModal();
  }
});

// Очистка ошибок при вводе
document.getElementById('cb-name').addEventListener('input', () => clearFieldErr('cb-name', 'err-cb-name'));
document.getElementById('eb-name').addEventListener('input', () => clearFieldErr('eb-name', 'err-eb-name'));

// ─── Init file zones ──────────────────────────────────────────────────────
setupFileZone('cb-logo', 'cb-zone', 'cb-preview', 'cb-file-name');
setupFileZone('eb-logo', 'eb-zone', 'eb-preview', 'eb-file-name');

// ─── Init ─────────────────────────────────────────────────────────────────
loadBrands();
