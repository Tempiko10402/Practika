/**
 * main.js — Логика главной страницы (личный кабинет)
 * Зависимости: auth.js, particles.js
 */

// Очищаем лишние ключи в хранилище
cleanBrowserStorage();

// Создаём частицы
createParticles('particles-container', 25);

// ─── Logout ───────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  window.location.replace('aut.html');
});

// ─── Время входа ──────────────────────────────────────────────────────────
function setLoginTime() {
  const now = new Date();
  const formatted = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
  document.getElementById('login-time').textContent = formatted;
}

// ─── Init ─────────────────────────────────────────────────────────────────
(async function init() {
  const isAuthed = await checkAuth();
  if (!isAuthed) return;

  // Показываем страницу только после проверки авторизации
  document.getElementById('page-content').style.display = 'flex';

  // Время входа
  setLoginTime();
})();
