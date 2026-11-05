/**
 * Dynamic Futuristic HUD Navbar & AI Assistant Drawer
 */

async function renderCyberNavbar(activePage = '') {
  const mountEl = document.getElementById('cyber-navbar-mount');
  if (!mountEl) return;

  const authData = await getCurrentUser();
  const user = authData?.user;
  const profile = authData?.profile;

  const navHtml = `
    <nav class="navbar navbar-expand-xl navbar-cyber sticky-top">
      <div class="container-fluid px-lg-4">
        <!-- Brand & Planetary Telemetry -->
        <a class="navbar-brand d-flex align-items-center me-3" href="/dashboard.html">
          <div class="me-2 text-center" style="line-height: 1;">
            <i class="bi bi-disc text-info fs-3"></i>
          </div>
          <div>
            <div class="brand-font fs-4 text-white fw-bold" style="letter-spacing: 2px;">AETHERIA</div>
            <div class="tech-font text-info text-uppercase" style="font-size: 0.65rem; letter-spacing: 1.5px;">
              <span class="pulse-beacon me-1" id="hud-socket-status"></span>
              VERIDIA PRIME · NET ONLINE
            </div>
          </div>
        </a>

        <!-- World Calendar Pill -->
        <div class="d-none d-md-flex align-items-center cyber-card px-3 py-1 me-3" style="font-size: 0.85rem;">
          <i class="bi bi-clock-history text-info me-2"></i>
          <span class="tech-font text-muted me-1">CYCLE:</span>
          <span class="tech-font text-white fw-bold" id="hud-world-year">2185</span>
          <span class="text-muted mx-1">·</span>
          <span class="tech-font text-muted me-1">DAY:</span>
          <span class="tech-font text-info fw-bold" id="hud-world-day">142</span>
        </div>

        <!-- Mobile Toggler -->
        <button class="navbar-toggler border-secondary text-info" type="button" data-bs-toggle="collapse" data-bs-target="#cyberNavCollapse">
          <i class="bi bi-list fs-2"></i>
        </button>

        <!-- Nav Links -->
        <div class="collapse navbar-collapse" id="cyberNavCollapse">
          <ul class="navbar-nav me-auto mb-2 mb-xl-0">
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'dashboard' ? 'active' : ''}" href="/dashboard.html">
                <i class="bi bi-grid-1x2-fill me-1"></i> HUD
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'social' ? 'active' : ''}" href="/social.html">
                <i class="bi bi-broadcast-pin me-1"></i> Social Net
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'chat' ? 'active' : ''}" href="/chat.html">
                <i class="bi bi-chat-dots-fill me-1"></i> Comms
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'lounges' ? 'active' : ''}" href="/lounges.html">
                <i class="bi bi-cup-hot-fill me-1"></i> Lounges
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link-cyber ${activePage === 'explorer' ? 'active' : ''}" href="/explorer.html">
                <i class="bi bi-globe-americas me-1"></i> World Explorer
              </a>
            </li>

            <!-- Economy Dropdown -->
            <li class="nav-item dropdown">
              <a class="nav-link-cyber dropdown-toggle ${['wallet', 'marketplace', 'business'].includes(activePage) ? 'active' : ''}" href="#" data-bs-toggle="dropdown">
                <i class="bi bi-coin me-1"></i> Economy
              </a>
              <ul class="dropdown-menu dropdown-menu-dark cyber-card border-secondary py-2">
                <li><a class="dropdown-item tech-font py-2" href="/wallet.html"><i class="bi bi-wallet2 text-info me-2"></i> Planetary Wallet</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/marketplace.html"><i class="bi bi-shop text-success me-2"></i> Global Marketplace</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/business.html"><i class="bi bi-building text-warning me-2"></i> Corporations & Industry</a></li>
              </ul>
            </li>

            <!-- Civil & Life Dropdown -->
            <li class="nav-item dropdown">
              <a class="nav-link-cyber dropdown-toggle ${['career', 'education', 'family', 'government', 'elections', 'missions'].includes(activePage) ? 'active' : ''}" href="#" data-bs-toggle="dropdown">
                <i class="bi bi-diagram-3-fill me-1"></i> Civilization
              </a>
              <ul class="dropdown-menu dropdown-menu-dark cyber-card border-secondary py-2">
                <li><a class="dropdown-item tech-font py-2" href="/career.html"><i class="bi bi-briefcase-fill text-info me-2"></i> Career Market</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/education.html"><i class="bi bi-mortarboard-fill text-primary me-2"></i> Academies & Degrees</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/family.html"><i class="bi bi-people-fill text-success me-2"></i> Family Household</a></li>
                <li><hr class="dropdown-divider border-secondary"></li>
                <li><a class="dropdown-item tech-font py-2" href="/government.html"><i class="bi bi-bank2 text-warning me-2"></i> Supreme Parliament</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/elections.html"><i class="bi bi-fingerprint text-info me-2"></i> Elections Portal</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/missions.html"><i class="bi bi-flag-fill text-danger me-2"></i> Daily Missions</a></li>
                <li><a class="dropdown-item tech-font py-2" href="/newspaper.html"><i class="bi bi-newspaper text-info me-2"></i> Veridian Chronicle</a></li>
              </ul>
            </li>
          </ul>

          <!-- Right Status & Controls -->
          <div class="d-flex align-items-center gap-2 mt-3 mt-xl-0">
            <!-- AI Assistant Button -->
            <button class="btn btn-cyber-purple btn-sm d-flex align-items-center" type="button" data-bs-toggle="offcanvas" data-bs-target="#aiAssistantOffcanvas">
              <i class="bi bi-cpu-fill me-1"></i> <span class="d-none d-sm-inline">Ask ANI</span>
            </button>

            ${profile ? `
              <!-- Live Wallet Pill -->
              <a href="/wallet.html" class="cyber-card px-3 py-1 text-decoration-none d-flex align-items-center">
                <i class="bi bi-cash-stack text-success me-2"></i>
                <span class="tech-font text-white fw-bold" id="hud-wallet-balance">${formatCredits(profile.wallet_balance || 500)}</span>
              </a>

              <!-- User Profile Dropdown -->
              <div class="dropdown">
                <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle text-white" data-bs-toggle="dropdown">
                  <div class="rounded-circle overflow-hidden border border-info me-2" style="width: 34px; height: 34px; background: #0b1329;">
                    <img src="${profile.sprite_url || '/img/avatars/default.png'}" alt="Avatar" class="w-100 h-100" style="object-fit: cover;" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}'">
                  </div>
                  <div class="d-none d-lg-block text-start" style="line-height: 1.2;">
                    <div class="tech-font fw-bold" style="font-size: 0.9rem;">${profile.character_name}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">LVL ${profile.level || 1} · @${profile.username}</div>
                  </div>
                </a>
                <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end cyber-card border-secondary py-2">
                  <li><a class="dropdown-item tech-font py-2" href="/profile.html?id=${profile.id}"><i class="bi bi-person-badge text-info me-2"></i> View Profile</a></li>
                  <li><a class="dropdown-item tech-font py-2" href="/settings.html"><i class="bi bi-gear-fill text-muted me-2"></i> Settings</a></li>
                  ${user?.role === 'admin' ? `<li><a class="dropdown-item tech-font py-2 text-warning" href="/admin.html"><i class="bi bi-shield-lock-fill me-2"></i> Overseer Portal</a></li>` : ''}
                  <li><hr class="dropdown-divider border-secondary"></li>
                  <li><a class="dropdown-item tech-font py-2 text-danger" href="javascript:logout()"><i class="bi bi-box-arrow-right me-2"></i> Log Out</a></li>
                </ul>
              </div>
            ` : `
              <a href="/login.html" class="btn btn-cyber-primary btn-sm">
                <i class="bi bi-google me-1"></i> Sign In
              </a>
            `}
          </div>
        </div>
      </div>
    </nav>

    <!-- Slide-Out AI Assistant (ANI) Drawer -->
    <div class="offcanvas offcanvas-end cyber-card border-start border-secondary text-white" tabindex="-1" id="aiAssistantOffcanvas" style="width: 420px; background: rgba(8, 12, 24, 0.98);">
      <div class="offcanvas-header border-bottom border-secondary py-3">
        <div class="d-flex align-items-center">
          <div class="rounded-circle p-2 bg-dark border border-purple me-2" style="color: var(--neon-purple);">
            <i class="bi bi-cpu-fill fs-4"></i>
          </div>
          <div>
            <h5 class="offcanvas-title brand-font fs-6 mb-0 text-white">ANI · AI TUTORIAL ASSISTANT</h5>
            <small class="tech-font text-info">Aetheria Navigation Intelligence v2.5</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
      </div>
      <div class="offcanvas-body d-flex flex-column p-3">
        <div class="chat-messages flex-grow-1 mb-3" id="assistant-chat-history" style="max-height: calc(100vh - 220px); overflow-y: auto;">
          <div class="chat-bubble chat-bubble-npc mb-3">
            <div class="fw-bold text-info small mb-1"><i class="bi bi-stars me-1"></i>ANI:</div>
            Greetings, citizen. I am your persistent simulation guide. Ask me anything about navigating Veridia Prime, securing careers, opening corporations, participating in senate elections, or managing credits!
          </div>
        </div>
        <form id="assistant-form" onsubmit="handleAssistantQuery(event)">
          <div class="input-group">
            <input type="text" id="assistant-input" class="form-control form-control-cyber" placeholder="Ask ANI a question..." required autocomplete="off">
            <button class="btn btn-cyber-purple" type="submit">
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
    showToast('Logged out of quantum terminal.', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 500);
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
  typingEl.className = 'text-muted tech-font small mb-2';
  typingEl.id = 'ani-typing';
  typingEl.innerHTML = '<i class="bi bi-cpu me-1"></i> ANI is computing...';
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
    aniBubble.innerHTML = `<div class="fw-bold text-info small mb-1"><i class="bi bi-stars me-1"></i>ANI:</div>${data.answer}`;
    historyEl.appendChild(aniBubble);
    historyEl.scrollTop = historyEl.scrollHeight;
  } catch (err) {
    typingEl.remove();
    showToast('Failed to reach AI assistant: ' + err.message, 'danger');
  }
}

