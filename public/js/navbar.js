/**
 * Aetheria Clean Website Navigation & AI Assistant Controller
 */

async function renderCyberNavbar(activePage = '') {
  const mountEl = document.getElementById('cyber-navbar-mount');
  if (!mountEl) return;

  const authData = await getCurrentUser();
  const user = authData?.user;
  const profile = authData?.profile;

  const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';

  const navHtml = `
    <nav class="navbar navbar-expand-xl navbar-cyber sticky-top">
      <div class="container-fluid px-lg-4">
        <!-- Brand & Planetary Context -->
        <a class="navbar-brand d-flex align-items-center me-3 text-decoration-none" href="/dashboard.html">
          <div class="me-2 text-primary fs-4">
            <i class="bi bi-globe2"></i>
          </div>
          <div>
            <div class="brand-font fs-5 fw-bold mb-0">Aetheria</div>
            <div class="text-muted small" style="font-size: 0.72rem;">
              <span class="pulse-beacon me-1" id="hud-socket-status"></span>
              Veridia Prime
            </div>
          </div>
        </a>

        <!-- World Calendar Badge -->
        <div class="d-none d-md-flex align-items-center card px-2 py-1 me-3 border shadow-sm" style="font-size: 0.8rem;">
          <i class="bi bi-calendar3 text-primary me-2"></i>
          <span class="text-muted me-1">Cycle</span>
          <span class="fw-semibold me-2" id="hud-world-year">2185</span>
          <span class="text-muted me-1">Day</span>
          <span class="fw-semibold text-primary" id="hud-world-day">142</span>
        </div>

        <!-- Mobile Toggler -->
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#cyberNavCollapse">
          <i class="bi bi-list fs-3"></i>
        </button>

        <!-- Nav Links -->
        <div class="collapse navbar-collapse" id="cyberNavCollapse">
          <ul class="navbar-nav me-auto mb-2 mb-xl-0">
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'dashboard' ? 'active' : ''}" href="/dashboard.html">
                <i class="bi bi-speedometer2 me-1"></i> Dashboard
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'social' ? 'active' : ''}" href="/social.html">
                <i class="bi bi-chat-square-text me-1"></i> Feed
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'chat' ? 'active' : ''}" href="/chat.html">
                <i class="bi bi-chat-dots me-1"></i> Chat
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'lounges' ? 'active' : ''}" href="/lounges.html">
                <i class="bi bi-people me-1"></i> Lounges
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'explorer' ? 'active' : ''}" href="/explorer.html">
                <i class="bi bi-compass me-1"></i> World Explorer
              </a>
            </li>

            <!-- Economy Dropdown -->
            <li class="nav-item dropdown">
              <a class="nav-link-cyber dropdown-toggle ${['wallet', 'marketplace', 'business'].includes(activePage) ? 'active' : ''}" href="#" data-bs-toggle="dropdown">
                <i class="bi bi-coin me-1"></i> Economy
              </a>
              <ul class="dropdown-menu border shadow-sm py-2">
                <li><a class="dropdown-item py-2" href="/wallet.html"><i class="bi bi-wallet2 text-primary me-2"></i> Wallet & Banking</a></li>
                <li><a class="dropdown-item py-2" href="/marketplace.html"><i class="bi bi-shop text-success me-2"></i> Marketplace</a></li>
                <li><a class="dropdown-item py-2" href="/business.html"><i class="bi bi-building text-warning me-2"></i> Businesses & Companies</a></li>
              </ul>
            </li>

            <!-- Civil & Life Dropdown -->
            <li class="nav-item dropdown">
              <a class="nav-link-cyber dropdown-toggle ${['career', 'education', 'family', 'government', 'elections', 'missions'].includes(activePage) ? 'active' : ''}" href="#" data-bs-toggle="dropdown">
                <i class="bi bi-bank me-1"></i> Civilization
              </a>
              <ul class="dropdown-menu border shadow-sm py-2">
                <li><a class="dropdown-item py-2" href="/career.html"><i class="bi bi-briefcase text-primary me-2"></i> Careers & Jobs</a></li>
                <li><a class="dropdown-item py-2" href="/education.html"><i class="bi bi-mortarboard text-info me-2"></i> Education & Academies</a></li>
                <li><a class="dropdown-item py-2" href="/family.html"><i class="bi bi-heart text-danger me-2"></i> Family & Lineage</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item py-2" href="/government.html"><i class="bi bi-building-columns text-warning me-2"></i> Government & Laws</a></li>
                <li><a class="dropdown-item py-2" href="/elections.html"><i class="bi bi-check2-square text-primary me-2"></i> Voting & Elections</a></li>
                <li><a class="dropdown-item py-2" href="/missions.html"><i class="bi bi-flag text-danger me-2"></i> Missions & Goals</a></li>
                <li><a class="dropdown-item py-2" href="/newspaper.html"><i class="bi bi-newspaper text-info me-2"></i> World Newspaper</a></li>
              </ul>
            </li>
          </ul>

          <!-- Right Status & Controls -->
          <div class="d-flex align-items-center gap-2 mt-3 mt-xl-0">
            <!-- Theme Mode Switcher -->
            <button class="btn btn-outline-secondary btn-sm d-flex align-items-center" onclick="toggleAppTheme()" title="Toggle Light/Dark Theme" id="theme-toggle-btn">
              <i class="bi ${currentTheme === 'dark' ? 'bi-sun-fill text-warning' : 'bi-moon-fill'}" id="theme-icon"></i>
            </button>

            <!-- AI Assistant Button -->
            <button class="btn btn-outline-primary btn-sm d-flex align-items-center" type="button" data-bs-toggle="offcanvas" data-bs-target="#aiAssistantOffcanvas">
              <i class="bi bi-robot me-1"></i> <span class="d-none d-sm-inline">AI Assistant</span>
            </button>

            ${profile ? `
              <!-- Live Wallet Pill -->
              <a href="/wallet.html" class="card px-3 py-1 text-decoration-none d-flex align-items-center border shadow-sm" style="font-size: 0.9rem;">
                <i class="bi bi-cash-stack text-success me-2"></i>
                <span class="fw-bold" id="hud-wallet-balance">${formatCredits(profile.wallet_balance || 500)}</span>
              </a>

              <!-- User Profile Dropdown -->
              <div class="dropdown">
                <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle" data-bs-toggle="dropdown">
                  <div class="rounded-circle overflow-hidden border me-2" style="width: 32px; height: 32px;">
                    <img src="${profile.sprite_url || '/img/avatars/default.png'}" alt="Avatar" class="w-100 h-100" style="object-fit: cover;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}'">
                  </div>
                  <div class="d-none d-lg-block text-start" style="line-height: 1.2;">
                    <div class="fw-semibold" style="font-size: 0.88rem;">${profile.character_name}</div>
                    <div class="text-muted" style="font-size: 0.72rem;">@${profile.username}</div>
                  </div>
                </a>
                <ul class="dropdown-menu dropdown-menu-end border shadow-sm py-2">
                  <li><a class="dropdown-item py-2" href="/profile.html?id=${profile.id}"><i class="bi bi-person me-2"></i> View Profile</a></li>
                  <li><a class="dropdown-item py-2" href="/settings.html"><i class="bi bi-gear me-2"></i> Settings</a></li>
                  ${user?.role === 'admin' ? `<li><a class="dropdown-item py-2 text-warning" href="/admin.html"><i class="bi bi-shield-check me-2"></i> Admin Portal</a></li>` : ''}
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item py-2 text-danger" href="javascript:logout()"><i class="bi bi-box-arrow-right me-2"></i> Sign Out</a></li>
                </ul>
              </div>
            ` : `
              <a href="/login.html" class="btn btn-primary btn-sm">
                <i class="bi bi-box-arrow-in-right me-1"></i> Sign In
              </a>
            `}
          </div>
        </div>
      </div>
    </nav>

    <!-- Slide-Out AI Assistant Drawer -->
    <div class="offcanvas offcanvas-end" tabindex="-1" id="aiAssistantOffcanvas" style="width: 400px;">
      <div class="offcanvas-header border-bottom py-3">
        <div class="d-flex align-items-center">
          <div class="rounded-circle p-2 bg-primary bg-opacity-10 text-primary me-2">
            <i class="bi bi-robot fs-5"></i>
          </div>
          <div>
            <h6 class="offcanvas-title fw-bold mb-0">AI Assistant</h6>
            <small class="text-muted">Aetheria Navigation Intelligence</small>
          </div>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body d-flex flex-column p-3">
        <div class="chat-messages flex-grow-1 mb-3" id="assistant-chat-history" style="max-height: calc(100vh - 220px); overflow-y: auto;">
          <div class="chat-bubble chat-bubble-npc mb-3">
            <div class="fw-bold text-primary small mb-1"><i class="bi bi-stars me-1"></i>Assistant:</div>
            Hello! I am your simulation guide. Ask me anything about exploring Veridia Prime, securing jobs, starting businesses, taking courses, voting in elections, or managing your credits.
          </div>
        </div>
        <form id="assistant-form" onsubmit="handleAssistantQuery(event)">
          <div class="input-group">
            <input type="text" id="assistant-input" class="form-control" placeholder="Ask a question..." required autocomplete="off">
            <button class="btn btn-primary" type="submit">
              <i class="bi bi-send-fill"></i>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  mountEl.innerHTML = navHtml;
}

// Global Logout Handler
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    showToast('Signed out successfully.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 400);
  } catch {
    window.location.href = '/login.html';
  }
}

// Global Assistant Handler
async function handleAssistantQuery(e) {
  e.preventDefault();
  const inputEl = document.getElementById('assistant-input');
  const historyEl = document.getElementById('assistant-chat-history');
  const query = inputEl.value.trim();
  if (!query) return;

  // Append user bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble chat-bubble-sent mb-2';
  userBubble.innerText = query;
  historyEl.appendChild(userBubble);
  inputEl.value = '';
  historyEl.scrollTop = historyEl.scrollHeight;

  // Typing indicator
  const typingEl = document.createElement('div');
  typingEl.className = 'text-muted small mb-2';
  typingEl.id = 'ani-typing';
  typingEl.innerHTML = '<i class="bi bi-cpu me-1"></i> Assistant is typing...';
  historyEl.appendChild(typingEl);
  historyEl.scrollTop = historyEl.scrollHeight;

  try {
    const data = await apiFetch('/api/assistant/ask', {
      method: 'POST',
      body: { query }
    });

    typingEl.remove();

    const aniBubble = document.createElement('div');
    aniBubble.className = 'chat-bubble chat-bubble-npc mb-3';
    aniBubble.innerHTML = `<div class="fw-bold text-primary small mb-1"><i class="bi bi-stars me-1"></i>Assistant:</div>${data.answer}`;
    historyEl.appendChild(aniBubble);
    historyEl.scrollTop = historyEl.scrollHeight;
  } catch (err) {
    typingEl.remove();
    showToast('Failed to reach AI assistant: ' + err.message, 'danger');
  }
}
