/**
 * auth.js — Общая утилита управления сессией и токенами
 */
const API_BASE = ''; // Запросы идут через прокси-сервер (server.py)

/**
 * Очистить сессию (удалить токены)
 */
function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

/**
 * Получить заголовки с токеном авторизации
 */
function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Очистить localStorage, оставив только токены
 */
function cleanBrowserStorage() {
  const allowedKeys = ['accessToken', 'refreshToken'];
  sessionStorage.clear();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!allowedKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Попытка обновить токен через refreshToken
 * @returns {Promise<boolean>} — успех или нет
 */
async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const resp = await fetch(`${API_BASE}/api/Authorization/CheckRefresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (resp.ok) {
      const data = await resp.json();
      const newToken = data?.accessToken || data?.token;
      if (newToken) {
        localStorage.setItem('accessToken', newToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        return true;
      }
    }
  } catch {}

  return false;
}

/**
 * Проверить авторизацию. Если нет токена — редирект на aut.html
 * @returns {Promise<boolean>}
 */
async function checkAuth() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (!accessToken && !refreshToken) {
    window.location.replace('aut.html');
    return false;
  }

  if (!accessToken && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      clearSession();
      window.location.replace('aut.html');
      return false;
    }
  }

  return true;
}
