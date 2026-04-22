// ── Router & App State ──────────────────────────────────────

const App = {
  username: localStorage.getItem('nc_username') || null,
  matchesCreated: parseInt(localStorage.getItem('nc_matches_created') || '0'),

  login(username) {
    this.username = username;
    localStorage.setItem('nc_username', username);
  },

  logout() {
    this.username = null;
    localStorage.removeItem('nc_username');
    SocketClient.disconnect();
    navigate('login');
  },

  incMatchesCreated() {
    this.matchesCreated++;
    localStorage.setItem('nc_matches_created', this.matchesCreated);
  },
};

// Pages registry — each page exports { render, mount, unmount }
const Pages = {
  login: LoginPage,
  matches: MatchesPage,
  watch: WatchPage,
  broadcast: BroadcastPage,
  director: DirectorPage,
  replays: ReplaysPage,
  profile: ProfilePage,
};

let currentPage = null;
let currentPageName = null;

const NAV_PAGES = ['matches', 'broadcast', 'replays', 'profile'];

function navigate(name, params = {}) {
  // Unmount current page
  if (currentPage && currentPage.unmount) currentPage.unmount();

  currentPageName = name;
  currentPage = Pages[name];

  const pageEl = document.getElementById('page');
  const topbar = document.getElementById('topbar');
  const bottomnav = document.getElementById('bottomnav');
  const backBtn = document.getElementById('backBtn');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarRight = document.getElementById('topbarRight');

  // Auth guard
  if (name !== 'login' && !App.username) {
    navigate('login');
    return;
  }

  // Reset top bar extras
  topbarTitle.textContent = '';
  topbarRight.innerHTML = '';

  // Show/hide chrome
  if (name === 'login') {
    topbar.classList.add('hidden');
    bottomnav.classList.add('hidden');
  } else if (name === 'watch' || name === 'director') {
    topbar.classList.add('hidden');
    bottomnav.classList.add('hidden');
  } else {
    topbar.classList.remove('hidden');
    bottomnav.classList.remove('hidden');
    backBtn.classList.add('hidden');
  }

  // Update bottom nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === name);
  });

  // Render page
  pageEl.innerHTML = currentPage.render(params);

  // Mount lifecycle
  if (currentPage.mount) currentPage.mount(params);
}

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  if (!App.username) {
    navigate('login');
  } else {
    navigate('matches');
  }
});
