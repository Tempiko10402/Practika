/**
 * admin.js — Логика страницы администратора
 * Зависимости: auth.js
 */

const PAGE_SIZE = 10;
let currentPage = 1;
let totalUsers = 0;
let searchQuery = '';
let rolesCache = [];
let editingUser = null;
let deletingUser = null;

// ─── Auth Guard ───────────────────────────────────────────────────────────
(function authGuard() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    window.location.replace('aut.html');
  }
})();

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success'
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────
function showSkeleton() {
  const tbody = document.getElementById('users-tbody');
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<tr class="skeleton-row">
      <td><div style="display:flex;align-items:center;gap:12px"><div class="skeleton avatar"></div><div><div class="skeleton w-60" style="width:120px;margin-bottom:6px"></div><div class="skeleton w-40" style="width:80px;height:10px"></div></div></div></td>
      <td><div class="skeleton w-50" style="width:90px"></div></td>
      <td><div class="skeleton w-30" style="width:70px"></div></td>
      <td><div class="skeleton w-30" style="width:60px"></div></td>
      <td><div class="skeleton w-30" style="width:80px"></div></td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

// ─── Load Users ───────────────────────────────────────────────────────────
async function loadUsers() {
  showSkeleton();
  try {
    const res = await fetch(`${API_BASE}/api/User/GetUsers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        page: currentPage,
        pageSize: PAGE_SIZE,
        fullName: searchQuery
      })
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    const data = await res.json();
    renderUsers(data);
  } catch (err) {
    console.error('Ошибка загрузки пользователей:', err);
    showToast('Не удалось загрузить пользователей', 'error');
    document.getElementById('users-tbody').innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          <h3>Ошибка загрузки</h3>
          <p>Не удалось подключиться к серверу</p>
        </div>
      </td></tr>`;
    document.getElementById('table-info').textContent = 'Ошибка';
    document.getElementById('pagination').innerHTML = '';
  }
}

function renderUsers(data) {
  const tbody = document.getElementById('users-tbody');
  let users = [];
  let total = 0;

  if (Array.isArray(data)) {
    users = data;
    total = data.length;
  } else if (data && data.items) {
    users = data.items;
    total = data.totalCount || data.items.length;
  } else if (data && data.data) {
    users = data.data;
    total = data.totalCount || data.total || data.data.length;
  } else if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    for (const k of keys) {
      if (Array.isArray(data[k])) { users = data[k]; break; }
    }
    total = data.totalCount || data.total || users.length;
  }

  totalUsers = total;
  document.getElementById('stat-total').textContent = total;

  const activeCount = users.filter(u => !u.isLockoutEnabled && !u.lockoutEnabled).length;
  document.getElementById('stat-active').textContent = activeCount || users.length;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <h3>Нет пользователей</h3>
          <p>Создайте первого пользователя</p>
        </div>
      </td></tr>`;
    document.getElementById('table-info').textContent = 'Нет записей';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  let html = '';
  users.forEach(u => {
    const fullName = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ') || 'Без имени';
    const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?';
    const email = u.email || '—';
    const position = u.position || '—';
    const isLocked = u.isLockoutEnabled || u.lockoutEnabled || false;
    const userId = u.id || u.Id || u.userId || '';

    let rolesHtml = '';
    const roles = u.roles || u.userRoles || [];
    if (Array.isArray(roles) && roles.length > 0) {
      roles.forEach(r => {
        const roleName = typeof r === 'string' ? r : (r.name || r.roleName || '');
        const isAdmin = roleName.toLowerCase().includes('admin');
        rolesHtml += `<span class="role-badge ${isAdmin ? 'admin' : ''}">${roleName}</span> `;
      });
    } else {
      rolesHtml = '<span style="color:var(--text-dim);font-size:12px">—</span>';
    }

    // Сохраняем данные пользователя в data-атрибуте для быстрого доступа
    const userDataAttr = encodeURIComponent(JSON.stringify(u));

    html += `<tr>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${initials}</div>
          <div>
            <div class="user-name">${fullName}</div>
            <div class="user-email">${email}</div>
          </div>
        </div>
      </td>
      <td>${position}</td>
      <td>${rolesHtml}</td>
      <td><span class="status-dot ${isLocked ? 'locked' : 'active'}">${isLocked ? 'Заблокирован' : 'Активен'}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn view" title="Просмотр" onclick='openViewModal(${JSON.stringify(u)})'>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
          <button class="action-btn edit" title="Редактировать" onclick='openEditModal(${JSON.stringify(u)})'>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="action-btn ${isLocked ? 'unlock' : 'lock'}" title="${isLocked ? 'Разблокировать' : 'Заблокировать'}" onclick="toggleLockout('${userId}', ${isLocked})">
            <svg viewBox="0 0 24 24" fill="currentColor">${isLocked
              ? '<path d="M12 1C8.676 1 6 3.676 6 7v1H4v15h16V8h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>'
              : '<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>'}
            </svg>
          </button>
          <button class="action-btn delete" title="Удалить" onclick="openDeleteConfirm('${userId}', '${fullName.replace(/'/g, "\\'")}')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  });

  tbody.innerHTML = html;

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  document.getElementById('table-info').textContent = `${start}–${end} из ${total}`;

  let pagHtml = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
  </button>`;

  const maxVisible = 5;
  let startP = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endP = Math.min(totalPages, startP + maxVisible - 1);
  if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);

  for (let i = startP; i <= endP; i++) {
    pagHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  pagHtml += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
  </button>`;

  document.getElementById('pagination').innerHTML = pagHtml;
}

function goToPage(page) {
  currentPage = page;
  loadUsers();
}

// ─── Load Roles ───────────────────────────────────────────────────────────
async function loadRoles() {
  try {
    const res = await fetch(`${API_BASE}/api/User/GetRoles`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    rolesCache = Array.isArray(data) ? data : (data.items || data.data || []);
    document.getElementById('stat-roles').textContent = rolesCache.length;
    renderRoleCheckboxes('roles-checkboxes');
  } catch (err) {
    console.error('Ошибка загрузки ролей:', err);
    document.getElementById('roles-checkboxes').innerHTML =
      '<span style="color:var(--text-dim);font-size:13px">Не удалось загрузить роли</span>';
  }
}

function renderRoleCheckboxes(containerId, selectedRoleIds = []) {
  const container = document.getElementById(containerId);
  if (rolesCache.length === 0) {
    container.innerHTML = '<span style="color:var(--text-dim);font-size:13px">Нет доступных ролей</span>';
    return;
  }
  container.innerHTML = rolesCache.map(r => {
    const id = r.id || r.Id || r.roleId;
    const name = r.name || r.Name || r.roleName || id;
    const isChecked = selectedRoleIds.includes(id) || selectedRoleIds.includes(String(id));
    return `<label class="checkbox-pill ${isChecked ? 'checked' : ''}" data-role-id="${id}">
      <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''} />
      ${name}
    </label>`;
  }).join('');

  container.querySelectorAll('.checkbox-pill').forEach(pill => {
    const cb = pill.querySelector('input');
    cb.addEventListener('change', () => {
      pill.classList.toggle('checked', cb.checked);
    });
  });
}

// ─── View User Modal ──────────────────────────────────────────────────────
function openViewModal(user) {
  const fullName = [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ') || 'Без имени';
  const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || '?';
  const isLocked = user.isLockoutEnabled || user.lockoutEnabled || false;

  const roles = user.roles || user.userRoles || [];
  let rolesHtml = '';
  if (Array.isArray(roles) && roles.length > 0) {
    roles.forEach(r => {
      const roleName = typeof r === 'string' ? r : (r.name || r.roleName || '');
      const isAdmin = roleName.toLowerCase().includes('admin');
      rolesHtml += `<span class="role-badge ${isAdmin ? 'admin' : ''}">${roleName}</span>`;
    });
  } else {
    rolesHtml = '<span style="color:var(--text-dim)">Без ролей</span>';
  }

  document.getElementById('view-avatar').textContent = initials;
  document.getElementById('view-fullname').textContent = fullName;
  document.getElementById('view-email').textContent = user.email || '—';
  document.getElementById('view-position').textContent = user.position || '—';
  document.getElementById('view-roles').innerHTML = rolesHtml;
  document.getElementById('view-status').innerHTML = `<span class="status-dot ${isLocked ? 'locked' : 'active'}">${isLocked ? 'Заблокирован' : 'Активен'}</span>`;

  document.getElementById('modal-view').classList.add('visible');
}

function closeViewModal() {
  document.getElementById('modal-view').classList.remove('visible');
}

// ─── Create User Modal ────────────────────────────────────────────────────
function openModal() {
  document.getElementById('modal-create').classList.add('visible');
  document.getElementById('create-user-form').reset();
  clearAllFieldErrors();
  renderRoleCheckboxes('roles-checkboxes');
}

function closeModal() {
  document.getElementById('modal-create').classList.remove('visible');
}

function clearAllFieldErrors() {
  document.querySelectorAll('#create-user-form .field-error').forEach(el => {
    el.classList.remove('visible');
    el.textContent = '';
  });
  document.querySelectorAll('#create-user-form .form-input').forEach(el => {
    el.classList.remove('invalid');
  });
}

function showFieldErr(fieldId, errId, msg) {
  document.getElementById(fieldId).classList.add('invalid');
  const el = document.getElementById(errId);
  el.textContent = msg;
  el.classList.add('visible');
}

async function submitCreateUser() {
  clearAllFieldErrors();

  const lastName = document.getElementById('cu-lastName').value.trim();
  const firstName = document.getElementById('cu-firstName').value.trim();
  const middleName = document.getElementById('cu-middleName').value.trim();
  const position = document.getElementById('cu-position').value.trim();
  const email = document.getElementById('cu-email').value.trim();
  const password = document.getElementById('cu-password').value;

  let hasErr = false;
  if (!lastName) { showFieldErr('cu-lastName', 'err-lastName', 'Введите фамилию'); hasErr = true; }
  if (!firstName) { showFieldErr('cu-firstName', 'err-firstName', 'Введите имя'); hasErr = true; }
  if (!email) { showFieldErr('cu-email', 'err-email', 'Введите email'); hasErr = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldErr('cu-email', 'err-email', 'Некорректный email'); hasErr = true; }
  if (!password) { showFieldErr('cu-password', 'err-password', 'Введите пароль'); hasErr = true; }
  else if (password.length < 6) { showFieldErr('cu-password', 'err-password', 'Минимум 6 символов'); hasErr = true; }

  if (hasErr) return;

  const selectedRoles = [];
  document.querySelectorAll('#roles-checkboxes input:checked').forEach(cb => {
    selectedRoles.push(cb.value);
  });

  const btn = document.getElementById('btn-submit-user');
  const spinner = document.getElementById('create-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/api/User/CreateUser`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ lastName, firstName, middleName, position, email, password, idRoles: selectedRoles })
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    if (res.ok) {
      showToast(`Пользователь ${firstName} ${lastName} создан!`, 'success');
      closeModal();
      loadUsers();
    } else {
      let errMsg = 'Ошибка при создании пользователя';
      try {
        const errData = await res.json();
        errMsg = errData.message || errData.title || errData.error || JSON.stringify(errData.errors || errData);
      } catch {}
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Edit User Modal ──────────────────────────────────────────────────────
function openEditModal(user) {
  editingUser = user;

  document.getElementById('eu-lastName').value = user.lastName || '';
  document.getElementById('eu-firstName').value = user.firstName || '';
  document.getElementById('eu-middleName').value = user.middleName || '';
  document.getElementById('eu-position').value = user.position || '';
  document.getElementById('eu-email').value = user.email || '';

  // Определяем роли пользователя
  const userRoles = user.roles || user.userRoles || [];
  const selectedRoleIds = userRoles.map(r => {
    if (typeof r === 'string') return r;
    return r.id || r.Id || r.roleId || r.name || '';
  });

  clearEditFieldErrors();
  renderRoleCheckboxes('edit-roles-checkboxes', selectedRoleIds);

  document.getElementById('modal-edit').classList.add('visible');
}

function closeEditModal() {
  document.getElementById('modal-edit').classList.remove('visible');
  editingUser = null;
}

function clearEditFieldErrors() {
  document.querySelectorAll('#edit-user-form .field-error').forEach(el => {
    el.classList.remove('visible');
    el.textContent = '';
  });
  document.querySelectorAll('#edit-user-form .form-input').forEach(el => {
    el.classList.remove('invalid');
  });
}

function showEditFieldErr(fieldId, errId, msg) {
  document.getElementById(fieldId).classList.add('invalid');
  const el = document.getElementById(errId);
  el.textContent = msg;
  el.classList.add('visible');
}

async function submitEditUser() {
  if (!editingUser) return;
  clearEditFieldErrors();

  const lastName = document.getElementById('eu-lastName').value.trim();
  const firstName = document.getElementById('eu-firstName').value.trim();
  const middleName = document.getElementById('eu-middleName').value.trim();
  const position = document.getElementById('eu-position').value.trim();
  const email = document.getElementById('eu-email').value.trim();

  let hasErr = false;
  if (!lastName) { showEditFieldErr('eu-lastName', 'eu-err-lastName', 'Введите фамилию'); hasErr = true; }
  if (!firstName) { showEditFieldErr('eu-firstName', 'eu-err-firstName', 'Введите имя'); hasErr = true; }
  if (!email) { showEditFieldErr('eu-email', 'eu-err-email', 'Введите email'); hasErr = true; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showEditFieldErr('eu-email', 'eu-err-email', 'Некорректный email'); hasErr = true; }

  if (hasErr) return;

  const selectedRoles = [];
  document.querySelectorAll('#edit-roles-checkboxes input:checked').forEach(cb => {
    selectedRoles.push(cb.value);
  });

  const userId = editingUser.id || editingUser.Id || editingUser.userId || '';

  const btn = document.getElementById('btn-edit-submit');
  const spinner = document.getElementById('edit-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/api/User/UpdateUser`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: userId, lastName, firstName, middleName, position, email, idRoles: selectedRoles })
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    if (res.ok) {
      showToast(`Данные ${firstName} ${lastName} обновлены!`, 'success');
      closeEditModal();
      loadUsers();
    } else {
      let errMsg = 'Ошибка при обновлении';
      try {
        const errData = await res.json();
        errMsg = errData.message || errData.title || errData.error || JSON.stringify(errData.errors || errData);
      } catch {}
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось подключиться к серверу', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Toggle Lockout ───────────────────────────────────────────────────────
async function toggleLockout(userId, isCurrentlyLocked) {
  const newState = !isCurrentlyLocked;
  const actionText = newState ? 'блокировки' : 'разблокировки';

  try {
    const res = await fetch(`${API_BASE}/api/User/IsLockoutEnabled`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, enabled: newState })
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    if (res.ok) {
      showToast(newState ? 'Пользователь заблокирован' : 'Пользователь разблокирован', 'success');
      loadUsers();
    } else {
      let errMsg = `Ошибка ${actionText}`;
      try {
        const errData = await res.json();
        errMsg = errData.message || errData.title || errMsg;
      } catch {}
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast(`Не удалось выполнить ${actionText}`, 'error');
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────
function openDeleteConfirm(userId, fullName) {
  deletingUser = { id: userId, name: fullName };
  document.getElementById('delete-user-name').textContent = fullName;
  document.getElementById('modal-delete').classList.add('visible');
}

function closeDeleteConfirm() {
  document.getElementById('modal-delete').classList.remove('visible');
  deletingUser = null;
}

async function confirmDelete() {
  if (!deletingUser) return;

  const btn = document.getElementById('btn-delete-confirm');
  const spinner = document.getElementById('delete-spinner');
  btn.disabled = true;
  spinner.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/api/User/DeleteUser?id=${encodeURIComponent(deletingUser.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.replace('aut.html');
      return;
    }

    if (res.ok) {
      showToast(`Пользователь «${deletingUser.name}» удалён`, 'success');
      closeDeleteConfirm();
      loadUsers();
    } else {
      let errMsg = 'Ошибка при удалении';
      try {
        const errData = await res.json();
        errMsg = errData.message || errData.title || errMsg;
      } catch {}
      showToast(errMsg, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось удалить пользователя', 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// ─── Search debounce ──────────────────────────────────────────────────────
let searchTimer = null;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    currentPage = 1;
    loadUsers();
  }, 1500);
});

// ─── Event Listeners ──────────────────────────────────────────────────────
document.getElementById('btn-create-user').addEventListener('click', openModal);
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('btn-submit-user').addEventListener('click', submitCreateUser);
document.getElementById('btn-refresh').addEventListener('click', () => loadUsers());

// Просмотр
document.getElementById('modal-view-close-btn').addEventListener('click', closeViewModal);

// Редактирование
document.getElementById('modal-edit-close-btn').addEventListener('click', closeEditModal);
document.getElementById('modal-edit-cancel-btn').addEventListener('click', closeEditModal);
document.getElementById('btn-edit-submit').addEventListener('click', submitEditUser);

// Удаление
document.getElementById('btn-delete-confirm').addEventListener('click', confirmDelete);
document.getElementById('btn-delete-cancel').addEventListener('click', closeDeleteConfirm);
document.getElementById('modal-delete-close-btn').addEventListener('click', closeDeleteConfirm);

// На главную
document.getElementById('btn-home').addEventListener('click', () => {
  window.location.href = 'main.html';
});

// Выход
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.replace('aut.html');
});

// Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeEditModal();
    closeViewModal();
    closeDeleteConfirm();
  }
});

// Убираем ошибки валидации при вводе
document.querySelectorAll('#create-user-form .form-input').forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    const errEl = input.parentElement.querySelector('.field-error');
    if (errEl) { errEl.classList.remove('visible'); errEl.textContent = ''; }
  });
});
document.querySelectorAll('#edit-user-form .form-input').forEach(input => {
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    const errEl = input.parentElement.querySelector('.field-error');
    if (errEl) { errEl.classList.remove('visible'); errEl.textContent = ''; }
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────
loadUsers();
loadRoles();
