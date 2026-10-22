/**
 * aut.js — Логика страницы авторизации
 * Зависимости: auth.js, particles.js
 */

// Очищаем лишние ключи в хранилище
cleanBrowserStorage();

// Редирект если уже авторизован
(function checkSession() {
  const token = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  if (token) {
    window.location.replace('main.html');
  } else if (refreshToken) {
    tryRefreshToken().then(ok => {
      if (ok) window.location.replace('main.html');
    });
  }
})();

// Создаём частицы
createParticles('particles-container', 30);

// ─── Password toggle ──────────────────────────────────────────────────────
const toggleBtn = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');
const eyeOpen = document.getElementById('eye-open');
const eyeClosed = document.getElementById('eye-closed');

toggleBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  eyeOpen.style.display = isHidden ? 'none' : 'block';
  eyeClosed.style.display = isHidden ? 'block' : 'none';
  toggleBtn.setAttribute('aria-label', isHidden ? 'Скрыть пароль' : 'Показать пароль');
});

// ─── Error display ────────────────────────────────────────────────────────
function showError(message) {
  const box = document.getElementById('error-box');
  const text = document.getElementById('error-text');
  text.textContent = message;
  box.classList.remove('visible');
  void box.offsetWidth; // reflow to re-trigger animation
  box.classList.add('visible');
}

function hideError() {
  document.getElementById('error-box').classList.remove('visible');
}

// ─── Loading state ────────────────────────────────────────────────────────
function setLoading(state) {
  const btn = document.getElementById('submit-btn');
  const spinner = document.getElementById('spinner');
  const label = document.getElementById('btn-label');
  btn.disabled = state;
  if (state) {
    btn.classList.add('loading');
    spinner.style.display = 'block';
    label.textContent = 'Вход...';
  } else {
    btn.classList.remove('loading');
    spinner.style.display = 'none';
    label.textContent = 'Войти';
  }
}

// ─── Email validation ─────────────────────────────────────────────────────
function validateEmail(email) {
  if (!email) return { valid: false, message: 'Введите адрес электронной почты.' };
  if (/\s/.test(email)) return { valid: false, message: 'Email не должен содержать пробелы.' };
  if (/[^\x00-\x7F]/.test(email)) return { valid: false, message: 'Email должен содержать только латинские буквы.' };

  const atCount = (email.match(/@/g) || []).length;
  if (atCount === 0) return { valid: false, message: 'Email должен содержать символ «@».' };
  if (atCount > 1) return { valid: false, message: 'Email не может содержать несколько символов «@».' };

  const [local, domain] = email.split('@');
  if (!local || local.length === 0) return { valid: false, message: 'Укажите часть до «@».' };
  if (!domain || domain.length === 0) return { valid: false, message: 'Укажите домен после «@».' };
  if (!domain.includes('.')) return { valid: false, message: 'Домен должен содержать точку, например: gmail.com.' };
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return { valid: false, message: 'Некорректный домен в email-адресе.' };

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return { valid: false, message: 'Укажите корректный домен (например, gmail.com).' };

  const allowedRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!allowedRegex.test(email)) return { valid: false, message: 'Email содержит недопустимые символы.' };

  return { valid: true, message: '' };
}

// ─── Field error helpers ──────────────────────────────────────────────────
function showFieldError(fieldId, errorId, message) {
  document.getElementById(fieldId).classList.add('invalid');
  const errEl = document.getElementById(errorId);
  errEl.textContent = message;
  errEl.classList.add('visible');
}

function clearFieldError(fieldId, errorId) {
  document.getElementById(fieldId).classList.remove('invalid');
  const errEl = document.getElementById(errorId);
  errEl.textContent = '';
  errEl.classList.remove('visible');
}

// ─── Form submit ──────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const emailValue = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  let hasError = false;
  const emailCheck = validateEmail(emailValue);
  if (!emailCheck.valid) {
    showFieldError('email', 'email-error', emailCheck.message);
    hasError = true;
  } else {
    clearFieldError('email', 'email-error');
  }

  if (!password) {
    showFieldError('password', 'password-error', 'Введите пароль.');
    hasError = true;
  } else {
    clearFieldError('password', 'password-error');
  }

  if (hasError) return;

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/Authorization/Login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email: emailValue, password })
    });

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    }

    if (response.ok) {
      const accessToken = data?.accessToken || data?.token || data?.access_token || '';
      const refreshToken = data?.refreshToken || data?.refresh_token || '';
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      window.location.replace('main.html');
    } else {
      const msg = data?.message || data?.error || data?.title || 'Неверный логин или пароль. Попробуйте ещё раз.';
      showError(msg);
    }
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      showError('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
    } else {
      showError('Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.');
    }
    console.error('Login error:', err);
  } finally {
    setLoading(false);
  }
});

// Сброс ошибок при вводе
document.getElementById('email').addEventListener('input', () => {
  clearFieldError('email', 'email-error');
  hideError();
});
document.getElementById('password').addEventListener('input', () => {
  clearFieldError('password', 'password-error');
  hideError();
});
