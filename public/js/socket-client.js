/**
 * Aetheria Real-Time Socket.IO Client
 */

let socket = null;

function initSocketConnection() {
  if (typeof io === 'undefined') {
    console.warn('[SOCKET] Socket.IO script not loaded yet.');
    return null;
  }

  if (!socket) {
    socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to Aetheria Quantum Net (ID:', socket.id, ')');
      const beacon = document.getElementById('hud-socket-status');
      if (beacon) beacon.classList.add('bg-success');
    });

    socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from Aetheria Quantum Net');
      const beacon = document.getElementById('hud-socket-status');
      if (beacon) beacon.classList.remove('bg-success');
    });

    socket.on('new_notification', (notif) => {
      showToast(notif.message, 'info');
      const badge = document.getElementById('notif-count-badge');
      if (badge) {
        badge.classList.remove('d-none');
        badge.innerText = parseInt(badge.innerText || '0', 10) + 1;
      }
    });

    socket.on('world_tick', (data) => {
      const yearEl = document.getElementById('hud-world-year');
      const dayEl = document.getElementById('hud-world-day');
      if (yearEl) yearEl.innerText = data.worldYear;
      if (dayEl) dayEl.innerText = data.worldDay;
    });
  }

  return socket;
}

// Ensure socket is initialized when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initSocketConnection();
});

