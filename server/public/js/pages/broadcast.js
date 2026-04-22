const BroadcastPage = {
  _step: 'home',  // home | create | join | role | camera
  _match: null,
  _sport: 'Basketball',
  _role: null,
  _stream: null,
  _pcs: new Map(),
  _isMobile: navigator.maxTouchPoints > 1,
  _unsubRequest: null,
  _unsubAnswer: null,
  _unsubIce: null,
  _unsubMatch: null,

  render() {
    return `<div class="broadcast-page" id="broadcastPage">${this._renderStep()}</div>`;
  },

  _renderStep() {
    if (this._step === 'home') return this._renderHome();
    if (this._step === 'create') return this._renderCreate();
    if (this._step === 'join') return this._renderJoin();
    if (this._step === 'role') return this._renderRole();
    return '';
  },

  _renderHome() {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:20px;font-weight:700;">Broadcast</h2>
        <button class="btn btn-primary" style="padding:9px 16px;font-size:14px;" onclick="BroadcastPage.goto('create')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Match
        </button>
      </div>
      <div class="label" style="margin-bottom:10px;">Active Matches</div>
      <div id="broadcastMatchList"><div style="color:var(--text-3);font-size:14px;text-align:center;padding:24px 0">Loading...</div></div>
      <div style="margin-top:16px;">
        <button class="btn btn-secondary btn-full" onclick="BroadcastPage.goto('join')">
          Enter code manually
        </button>
      </div>
    `;
  },

  _renderCreate() {
    const sports = ['Basketball', 'Soccer', 'Football', 'Baseball', 'Tennis', 'Other'];
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <button class="icon-btn" onclick="BroadcastPage.goto('home')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h2 style="font-size:20px;font-weight:700;">Create Match</h2>
      </div>
      <div class="form-group">
        <label class="label">Match Title</label>
        <input id="titleInput" class="input" placeholder="e.g. CMU vs Pitt" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;" class="form-group">
        <div>
          <label class="label">Team A</label>
          <input id="teamAInput" class="input" placeholder="Team A" />
        </div>
        <div>
          <label class="label">Team B</label>
          <input id="teamBInput" class="input" placeholder="Team B" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Sport</label>
        <div class="sport-chips">
          ${sports.map(s => `
            <div class="sport-chip ${this._sport === s ? 'active' : ''}"
                 onclick="BroadcastPage.setSport('${s}')">${s}</div>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="label">Venue (optional)</label>
        <input id="venueInput" class="input" placeholder="e.g. Gesling Stadium" />
      </div>
      <button class="btn btn-primary btn-full btn-lg" style="margin-top:8px;" onclick="BroadcastPage.createMatch()">
        Create & Get Code
      </button>
    `;
  },

  _renderJoin() {
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <button class="icon-btn" onclick="BroadcastPage.goto('home')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h2 style="font-size:20px;font-weight:700;">Join as Camera</h2>
      </div>
      <div class="form-group">
        <label class="label">Match Code</label>
        <input id="codeInput" class="input" placeholder="Enter 6-digit code" maxlength="6"
               style="text-transform:uppercase;font-size:22px;letter-spacing:4px;text-align:center;"
               oninput="this.value=this.value.toUpperCase()" />
      </div>
      <button class="btn btn-primary btn-full btn-lg" style="margin-top:8px;" onclick="BroadcastPage.joinMatch()">
        Join Match
      </button>
    `;
  },

  _renderCode() {
    const m = this._match;
    return `
      <div class="match-code-display">
        <p style="font-size:13px;color:var(--text-2);">Share this code with camera operators</p>
        <div class="code">${m.code}</div>
        <p style="font-size:13px;color:var(--text-2);">${m.title} · ${m.teamA} vs ${m.teamB}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary btn-full btn-lg" onclick="BroadcastPage.goto('role')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          Join as Camera
        </button>
        <button class="btn btn-secondary btn-full" onclick="navigate('director', { code: '${m.code}' })">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Open Director View
        </button>
      </div>
    `;
  },

  _renderRole() {
    const m = this._match;
    const roles = ['Main', 'Side', 'Close-up', 'Wide'];
    const taken = new Set(m.cameras.map(c => c.number));
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <button class="icon-btn" onclick="BroadcastPage.goto('home')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div>
          <h2 style="font-size:18px;font-weight:700;">${m.title}</h2>
          <p style="font-size:13px;color:var(--text-2);">${m.teamA} vs ${m.teamB}</p>
        </div>
      </div>
      <label class="label">Pick your camera position</label>
      <div class="role-grid">
        ${roles.map((r, i) => {
          const num = i + 1;
          const isTaken = taken.has(num);
          const isActive = this._role === num;
          return `
            <div class="role-card ${isActive ? 'active' : ''} ${isTaken ? 'taken' : ''}"
                 onclick="BroadcastPage.pickRole(${num}, '${r}', ${isTaken})">
              <div class="role-num">CAM ${num} ${isTaken ? '· TAKEN' : ''}</div>
              <div class="role-name">${r}</div>
            </div>
          `;
        }).join('')}
      </div>
      ${this._role ? `
        <button class="btn btn-primary btn-full btn-lg" style="margin-top:16px;" onclick="BroadcastPage.startCamera()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          Start Camera
        </button>
      ` : ''}
    `;
  },

  mount() {
    document.getElementById('topbarTitle').textContent = 'Broadcast';
    if (this._step === 'home') this._loadMatches();
  },

  async _loadMatches() {
    try {
      const res = await fetch('/api/matches');
      const matches = await res.json();
      const el = document.getElementById('broadcastMatchList');
      if (!el) return;
      if (!matches.length) {
        el.innerHTML = `<div style="color:var(--text-3);font-size:14px;text-align:center;padding:24px 0">No matches yet — create one above</div>`;
        return;
      }
      el.innerHTML = matches.map(m => {
        const streaming = m.cameras.filter(c => c.isStreaming).length;
        const cams = m.cameras.length;
        const isDemo = m.isDemo;
        return `
          <div class="broadcast-match-row ${isDemo ? 'broadcast-match-row-demo' : ''}"
               onclick="BroadcastPage._quickJoin('${m.code}')">
            <div class="broadcast-match-code">${m.code}</div>
            <div class="broadcast-match-info">
              <div class="broadcast-match-title">
                ${m.title}
                ${isDemo ? '<span class="broadcast-demo-pill">DEMO</span>' : ''}
              </div>
              <div class="broadcast-match-sub">
                ${m.sport || 'Sport'} · ${cams} cam${cams !== 1 ? 's' : ''}
                ${streaming ? ' · <span style="color:var(--red)">● ' + streaming + ' live</span>' : ''}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        `;
      }).join('');
    } catch {
      const el = document.getElementById('broadcastMatchList');
      if (el) el.innerHTML = `<div style="color:var(--text-3);font-size:14px;text-align:center;padding:24px 0">Could not load matches</div>`;
    }
  },

  async _quickJoin(code) {
    try {
      const res = await fetch(`/api/matches/${code}`);
      if (!res.ok) { alert('Match not found'); return; }
      this._match = await res.json();
      this._step = 'role';
      document.getElementById('broadcastPage').innerHTML = this._renderRole();
    } catch { alert('Could not join match'); }
  },

  unmount() {
    this._cleanup();
    this._step = 'home';
    this._match = null;
    this._role = null;
  },

  goto(step) {
    this._step = step;
    document.getElementById('broadcastPage').innerHTML = this._renderStep();
  },

  setSport(s) {
    this._sport = s;
    document.querySelectorAll('.sport-chip').forEach(el => {
      el.classList.toggle('active', el.textContent === s);
    });
  },

  async createMatch() {
    const title = document.getElementById('titleInput').value.trim();
    const teamA = document.getElementById('teamAInput').value.trim();
    const teamB = document.getElementById('teamBInput').value.trim();
    const venue = document.getElementById('venueInput')?.value.trim();
    if (!title || !teamA || !teamB) return;
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, teamA, teamB, sport: this._sport, venue }),
      });
      this._match = await res.json();
      App.incMatchesCreated();
      this._step = 'code';
      document.getElementById('broadcastPage').innerHTML = this._renderCode();
    } catch { alert('Failed to create match'); }
  },

  async joinMatch() {
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await fetch(`/api/matches/${code}`);
      if (!res.ok) { alert('Match not found'); return; }
      this._match = await res.json();
      this._step = 'role';
      document.getElementById('broadcastPage').innerHTML = this._renderRole();
    } catch { alert('Could not find match'); }
  },

  pickRole(num, role, taken) {
    if (taken) return;
    this._role = num;
    this._roleName = role;
    document.getElementById('broadcastPage').innerHTML = this._renderRole();
  },

  async startCamera() {
    const socket = SocketClient.get();
    const m = this._match;
    const num = this._role;
    const roleName = this._roleName;

    // Join match as camera
    socket.emit('join-match', { code: m.code, cameraNumber: num, cameraRole: roleName }, (resp) => {
      if (resp.error) { alert(resp.error); return; }
      this._launchCameraView(m, num, roleName);
    });
  },

  async _launchCameraView(m, num, roleName) {
    // Get camera stream
    try {
      this._stream = await WebRTCHelper.getLocalStream();
    } catch { alert('Camera permission denied'); return; }

    // Inject camera view over the page
    const el = document.createElement('div');
    el.id = 'cameraView';
    el.className = 'camera-view';
    el.innerHTML = `
      <div class="camera-feed">
        <video id="camVideo" autoplay playsinline muted></video>
        <div class="camera-hud-top">
          <div>
            <div style="font-size:13px;font-weight:600;">${m.title}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);">${m.teamA} vs ${m.teamB}</div>
          </div>
          <div class="code-pill">${m.code}</div>
        </div>
      </div>
      <div class="camera-controls">
        <button class="ctrl-btn" onclick="BroadcastPage.leaveCamera()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
          <button class="stream-btn" id="streamBtn" onclick="BroadcastPage.toggleStream()">
            <div class="stream-btn-inner"></div>
          </button>
          <div id="streamLabel" style="font-size:11px;color:var(--text-3);">CAM ${num} · ${roleName}</div>
        </div>
        <button class="ctrl-btn" onclick="BroadcastPage.flipCamera()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/></svg>
        </button>
      </div>
    `;
    document.getElementById('app').appendChild(el);
    document.getElementById('camVideo').srcObject = this._stream;

    this._isStreaming = false;
    this._facingMode = 'user';

    // Listen for viewer requests
    const socket = SocketClient.get();
    this._unsubRequest = async (data) => {
      if (data.cameraNumber !== num || !this._isStreaming) return;
      const pc = WebRTCHelper.createPC();
      this._pcs.set(data.viewerSocketId, pc);
      this._stream.getTracks().forEach(t => pc.addTrack(t, this._stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc-ice-candidate', {
          targetSocketId: data.viewerSocketId,
          candidate: e.candidate.toJSON(),
        });
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          pc.close(); this._pcs.delete(data.viewerSocketId);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { viewerSocketId: data.viewerSocketId, cameraNumber: num, sdp: pc.localDescription });
    };

    this._unsubAnswer = async (data) => {
      const pc = this._pcs.get(data.viewerSocketId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };

    this._unsubIce = (data) => {
      this._pcs.forEach(pc => {
        if (data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      });
    };

    socket.on('webrtc-incoming-request', this._unsubRequest);
    socket.on('webrtc-answer', this._unsubAnswer);
    socket.on('webrtc-ice-candidate', this._unsubIce);
  },

  _isStreaming: false,
  _facingMode: 'user',

  toggleStream() {
    this._isStreaming = !this._isStreaming;
    const btn = document.getElementById('streamBtn');
    const label = document.getElementById('streamLabel');
    if (btn) btn.className = `stream-btn${this._isStreaming ? ' live' : ''}`;
    if (label) label.textContent = this._isStreaming ? '● LIVE' : `CAM ${this._role} · ${this._roleName}`;
    if (label && this._isStreaming) label.style.color = 'var(--red)';
    else if (label) label.style.color = 'var(--text-3)';

    SocketClient.get().emit('stream-toggle', {
      code: this._match.code,
      cameraNumber: this._role,
      isStreaming: this._isStreaming,
    });

    if (!this._isStreaming) {
      this._pcs.forEach(pc => pc.close());
      this._pcs.clear();
    }
  },

  async flipCamera() {
    this._facingMode = this._facingMode === 'user' ? 'environment' : 'user';
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
    }
    try {
      this._stream = await WebRTCHelper.getLocalStream({ video: { facingMode: this._facingMode } });
      document.getElementById('camVideo').srcObject = this._stream;
      this._pcs.forEach(async (pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(this._stream.getVideoTracks()[0]);
      });
    } catch {}
  },

  leaveCamera() {
    this._cleanup();
    const el = document.getElementById('cameraView');
    if (el) el.remove();
    navigate('matches');
  },

  _cleanup() {
    const socket = SocketClient.get();
    if (this._unsubRequest) socket.off('webrtc-incoming-request', this._unsubRequest);
    if (this._unsubAnswer) socket.off('webrtc-answer', this._unsubAnswer);
    if (this._unsubIce) socket.off('webrtc-ice-candidate', this._unsubIce);
    this._pcs.forEach(pc => pc.close());
    this._pcs.clear();
    if (this._stream) { this._stream.getTracks().forEach(t => t.stop()); this._stream = null; }
    this._isStreaming = false;
  },
};
