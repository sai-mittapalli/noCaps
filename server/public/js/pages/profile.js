const ProfilePage = {
  _university: 'CMU',
  _sports: ['Billiards'],

  render() {
    const name = App.username || '?';
    const color = WebRTCHelper.avatarColor(name);
    const initials = WebRTCHelper.initials(name);
    const unis = ['CMU', 'Pitt', 'Penn State', 'Duquesne', 'Chatham'];
    const sports = ['Billiards', 'Basketball', 'Soccer', 'Tennis', 'Volleyball', 'Baseball'];
    return `
      <div class="profile-page">
        <div class="profile-header">
          <div class="avatar profile-avatar ${color}">${initials}</div>
          <div class="profile-name">${name}</div>
          <div style="font-size:13px;color:var(--text-3)">${this._university} · Team 3</div>
        </div>

        <div class="profile-section-title">University</div>
        <div class="profile-pills" id="uniPills">
          ${unis.map(u => `
            <button class="profile-pill ${u === this._university ? 'active' : ''}"
              onclick="ProfilePage._setUni('${u}')">${u}</button>
          `).join('')}
        </div>

        <div class="profile-section-title" style="margin-top:20px">Favorite Sports</div>
        <div class="profile-pills" id="sportPills">
          ${sports.map(s => `
            <button class="profile-pill ${this._sports.includes(s) ? 'active' : ''}"
              onclick="ProfilePage._toggleSport('${s}')">${s}</button>
          `).join('')}
        </div>

        <div class="profile-section-title" style="margin-top:20px">Activity</div>
        <div class="profile-list">
          <div class="profile-row">
            <span class="profile-row-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              Matches Created
            </span>
            <span class="profile-row-value">${App.matchesCreated}</span>
          </div>
          <div class="profile-row" style="margin-top:2px">
            <span class="profile-row-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Replays Watched
            </span>
            <span class="profile-row-value">–</span>
          </div>
        </div>

        <div class="profile-section-title" style="margin-top:20px">App</div>
        <div class="profile-list">
          <div class="profile-row">
            <span class="profile-row-label">Version</span>
            <span class="profile-row-value" style="color:var(--primary)">nocaps v0.4</span>
          </div>
        </div>

        <div style="margin-top:28px;">
          <button class="btn btn-danger btn-full" onclick="App.logout()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </div>
    `;
  },

  mount() {
    document.getElementById('topbarTitle').textContent = 'Profile';
  },

  unmount() {},

  _setUni(u) {
    this._university = u;
    document.querySelectorAll('#uniPills .profile-pill').forEach(btn => {
      btn.classList.toggle('active', btn.textContent === u);
    });
    document.querySelector('.profile-header div:last-child').textContent = `${u} · Team 3`;
  },

  _toggleSport(s) {
    const idx = this._sports.indexOf(s);
    if (idx >= 0) this._sports.splice(idx, 1);
    else this._sports.push(s);
    document.querySelectorAll('#sportPills .profile-pill').forEach(btn => {
      btn.classList.toggle('active', this._sports.includes(btn.textContent));
    });
  },
};
