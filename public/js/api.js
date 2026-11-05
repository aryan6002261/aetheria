/**
 * Aetheria Core API Client, Theme Controller & Toast System
 */

// Initialize Theme (Default to dark if system prefers or light otherwise)
(function initAppTheme() {
  const storedTheme = localStorage.getItem('aetheria_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-bs-theme', initialTheme);
})();

function toggleAppTheme() {
  const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-bs-theme', next);
  localStorage.setItem('aetheria_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (theme === 'dark') {
      icon.className = 'bi bi-sun-fill text-warning';
    } else {
      icon.className = 'bi bi-moon-fill text-secondary';
    }
  }
}

// Global Toast Dispatcher
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'position-fixed bottom-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const toastId = 'toast_' + Date.now();
  const borderColors = {
    info: 'var(--app-accent-primary, #2563eb)',
    success: 'var(--app-accent-success, #16a34a)',
    warning: 'var(--app-accent-warning, #d97706)',
    danger: 'var(--app-accent-danger, #dc2626)'
  };
  const borderColor = borderColors[type] || borderColors.info;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast show card mb-2 shadow-sm';
  toastEl.id = toastId;
  toastEl.style.borderLeft = `4px solid ${borderColor}`;
  toastEl.style.minWidth = '300px';
  toastEl.innerHTML = `
    <div class="toast-body d-flex justify-content-between align-items-center">
      <div>
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill text-success' : type === 'danger' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-info-circle-fill text-primary'} me-2"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close ms-2" onclick="document.getElementById('${toastId}').remove()"></button>
    </div>
  `;

  container.appendChild(toastEl);
  setTimeout(() => {
    if (document.getElementById(toastId)) {
      toastEl.remove();
    }
  }, 5000);
}

// Unified Fetch API Wrapper
async function apiFetch(endpoint, options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Automatically passes HTTP-only cookies
  };

  if (options.body) {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(endpoint, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

// Session Identity Helper
async function getCurrentUser() {
  try {
    return await apiFetch('/api/auth/me');
  } catch (err) {
    return null;
  }
}

// Format currency credits helper
function formatCredits(amount) {
  const num = Number(amount) || 0;
  return '₡' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Export global helpers to window
window.apiFetch = apiFetch;
window.showToast = showToast;
window.getCurrentUser = getCurrentUser;
window.formatCredits = formatCredits;
window.toggleAppTheme = toggleAppTheme;
window.updateThemeIcon = updateThemeIcon;
