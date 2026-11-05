/**
 * Aetheria Core API Client & Toast System
 */

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
    info: 'var(--neon-cyan)',
    success: 'var(--neon-emerald)',
    warning: 'var(--neon-amber)',
    danger: 'var(--neon-rose)'
  };
  const borderColor = borderColors[type] || borderColors.info;

  const toastEl = document.createElement('div');
  toastEl.className = 'toast show cyber-card mb-2 text-white';
  toastEl.id = toastId;
  toastEl.style.borderLeft = `4px solid ${borderColor}`;
  toastEl.style.minWidth = '300px';
  toastEl.innerHTML = `
    <div class="toast-body d-flex justify-content-between align-items-center">
      <div>
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill text-success' : type === 'danger' ? 'bi-exclamation-triangle-fill text-danger' : 'bi-info-circle-fill text-info'} me-2"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white ms-2" onclick="document.getElementById('${toastId}').remove()"></button>
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
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include HTTP-only cookie
    ...options,
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData) {
    delete config.headers['Content-Type']; // Let browser set boundary
  }

  try {
    const res = await fetch(endpoint, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Check if redirect required (e.g. character creation required)
      if (data.redirect && window.location.pathname !== data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API ERROR] ${endpoint}:`, err);
    showToast(err.message, 'danger');
    throw err;
  }
}

// Session Check
async function getCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

// Quick Currency Formatter
function formatCredits(val) {
  const num = parseFloat(val) || 0;
  return `₡${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

