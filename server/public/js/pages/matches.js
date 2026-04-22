const MatchesPage = {
  _matches: [],
  _tab: 'live',
  _filter: null,
  _unsub: null,

  render() {
    return `<div class="matches-page">
      <div class="avatars-row" id="avatarsRow"></div>
      <div class="tabs">
        <button class="tab-btn active" id="tab-live" onclick="MatchesPage.setTab('live')">
          <span class="live-dot"></span> Live
        </button>
        <button class="tab-btn" id="tab-upcoming" onclick="MatchesPage.setTab('upcoming')">Upcoming</button>
        <button class="tab-btn" id="tab-finished" onclick="MatchesPage.setTab('finished')">Finished</button>
      </div>
      <div class="match-list" id="matchList">
        <div class="empty-state"><p>Loading...</p></div>
      </div>
    </div>`;
  },

  async mount() {
    document.getElementById('topbarTitle').textContent = 'Matches';

    // Subscribe to real-time updates
    const socket = SocketClient.get();
    this._unsub = (match) => {
      const idx = this._matches.findIndex(m => m.code === match.code);
      if (idx >= 0) this._matches[idx] = match;
      else this._matches.unshift(match);
      this._renderList();
      this._renderAvatars();
    };
    socket.on('match-updated', this._unsub);

    await this._load();
  },

  unmount() {
    if (this._unsub) {
      SocketClient.get().off('match-updated', this._unsub);
      this._unsub = null;
    }
  },

  async _load() {
    try {
      const res = await fetch('/api/matches');
      this._matches = await res.json();
      this._renderAvatars();
      this._renderList();
    } catch {
      document.getElementById('matchList').innerHTML =
        '<div class="empty-state"><p>Could not load matches</p></div>';
    }
  },

  setTab(tab) {
    this._tab = tab;
    ['live', 'upcoming', 'finished'].forEach(t => {
      document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
    });
    this._renderList();
  },

  setFilter(team) {
    this._filter = this._filter === team ? null : team;
    document.querySelectorAll('.avatar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.team === this._filter);
    });
    this._renderList();
  },

  _filtered() {
    let list = this._matches;
    if (this._filter) {
      list = list.filter(m => m.teamA === this._filter || m.teamB === this._filter);
    }
    if (this._tab === 'live') return list.filter(m => m.isLive);
    if (this._tab === 'upcoming') return list.filter(m => !m.isLive && m.cameras.length === 0);
    return list.filter(m => !m.isLive && m.cameras.length > 0);
  },

  _renderAvatars() {
    const row = document.getElementById('avatarsRow');
    if (!row) return;
    const teams = [...new Set(this._matches.flatMap(m => [m.teamA, m.teamB]))];
    row.innerHTML = teams.map(t => `
      <button class="avatar-btn ${this._filter === t ? 'active' : ''}" data-team="${t}" onclick="MatchesPage.setFilter('${t}')">
        <div class="avatar ${WebRTCHelper.avatarColor(t)}">${WebRTCHelper.initials(t)}</div>
        <span>${t.split(' ')[0]}</span>
      </button>
    `).join('');
  },

  _renderList() {
    const list = document.getElementById('matchList');
    if (!list) return;
    const filtered = this._filtered();
    if (!filtered.length) {
      const msgs = { live: 'No live matches right now', upcoming: 'No upcoming matches', finished: 'No finished matches' };
      list.innerHTML = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>${msgs[this._tab]}</p>
      </div>`;
      return;
    }
    list.innerHTML = filtered.map(m => this._cardHTML(m)).join('');
  },

  _cardHTML(m) {
    const colA = WebRTCHelper.avatarColor(m.teamA);
    const colB = WebRTCHelper.avatarColor(m.teamB);
    const streaming = m.cameras.filter(c => c.isStreaming).length;
    const clockLabel = m.clock || (m.isLive ? `${streaming} cam${streaming !== 1 ? 's' : ''}` : '');
    const isUpcoming = !m.isLive && m.cameras.length === 0;
    const scoreA = m.scoreA != null ? m.scoreA : '–';
    const scoreB = m.scoreB != null ? m.scoreB : '–';
    const dateLabel = new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="match-card glass" onclick="navigate('watch', { code: '${m.code}' })">
        <div class="match-card-top">
          <span class="match-sport">${m.sport || 'Sport'}</span>
          ${m.isLive
            ? `<span class="match-clock">${clockLabel}</span>`
            : `<span class="match-date">${m.venue || dateLabel}</span>`
          }
        </div>
        <div class="match-teams">
          <div class="match-team">
            <div class="avatar ${colA}">${WebRTCHelper.initials(m.teamA)}</div>
            <span class="match-team-name">${m.teamA}</span>
          </div>
          <div class="match-score">
            ${isUpcoming
              ? `<span class="match-score-vs">vs</span>`
              : `<span>${scoreA}</span><span class="match-score-sep">–</span><span>${scoreB}</span>`
            }
          </div>
          <div class="match-team right">
            <div class="avatar ${colB}">${WebRTCHelper.initials(m.teamB)}</div>
            <span class="match-team-name">${m.teamB}</span>
          </div>
        </div>
      </div>
    `;
  },
};
