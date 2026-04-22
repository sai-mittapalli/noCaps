const DirectorPage = {
  _match: null,
  _pcs: new Map(),
  _featured: null,
  _cut: null,           // which cam is currently pushed to all viewers
  _camSocketIds: new Map(),
  _unsubOffer: null,
  _unsubIce: null,
  _unsubMatch: null,
  _autoTimer: null,
  _autoOn: false,
  _countdown: 30,
  _countdownTimer: null,

  render(params) {
    this._code = params.code;
    return `
      <div class="director-page" id="directorPage">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <button class="icon-btn" onclick="DirectorPage.leave()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div>
            <div id="dirTitle" style="font-size:17px;font-weight:700;">Loading...</div>
            <div id="dirTeams" style="font-size:12px;color:var(--text-2);margin-top:2px;"></div>
          </div>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
          <div id="dirLive"></div>
          <div id="dirCutBadge" class="hidden"></div>
        </div>
        </div>

        <!-- Cut bar -->
        <div id="dirCutBar" class="director-cut-bar hidden">
          <div class="director-cut-bar-inner">
            <span id="dirCutLabel">No cut active</span>
            <button onclick="DirectorPage.releaseCut()" class="director-cut-release">Release</button>
          </div>
        </div>

        <div class="director-grid" id="dirGrid">
          ${[1,2,3,4].map(n => this._cellHTML(n, null)).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding:0 2px;">
          <p style="color:var(--text-3);font-size:12px;">Tap to preview · Hold to push to viewers</p>
          <button id="autoBtn" onclick="DirectorPage.toggleAuto()"
            style="display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:6px 12px;color:var(--text-2);font-size:12px;font-weight:600;cursor:pointer;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Auto <span id="autoCountdown"></span>
          </button>
        </div>
      </div>
    `;
  },

  mount(params) {
    const socket = SocketClient.get();

    this._unsubOffer = async (data) => {
      const pc = this._pcs.get(data.cameraNumber);
      if (!pc) return;
      this._camSocketIds.set(data.cameraNumber, data.cameraSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { cameraSocketId: data.cameraSocketId, sdp: pc.localDescription });
    };

    this._unsubIce = (data) => {
      this._pcs.forEach(pc => {
        if (data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      });
    };

    socket.on('webrtc-offer', this._unsubOffer);
    socket.on('webrtc-ice-candidate', this._unsubIce);

    socket.emit('watch-match', { code: this._code }, (resp) => {
      if (resp.error) { navigate('broadcast'); return; }
      this._match = resp.match;
      this._updateHeader();
      this._connectAll();
    });

    this._unsubMatch = (match) => {
      if (match.code !== this._code) return;
      this._match = match;
      this._updateHeader();
      this._connectAll();
    };
    socket.on('match-updated', this._unsubMatch);
  },

  unmount() {
    this._stopAuto();
    const socket = SocketClient.get();
    if (this._unsubOffer) socket.off('webrtc-offer', this._unsubOffer);
    if (this._unsubIce) socket.off('webrtc-ice-candidate', this._unsubIce);
    if (this._unsubMatch) socket.off('match-updated', this._unsubMatch);
    this._pcs.forEach(pc => pc.close());
    this._pcs.clear();
    this._camSocketIds.clear();
    this._featured = null;
    this._cut = null;
    this._autoOn = false;
  },

  toggleAuto() {
    this._autoOn ? this._stopAuto() : this._startAuto();
  },

  _startAuto() {
    this._autoOn = true;
    this._countdown = 30;
    this._autoSwitch(); // switch immediately
    this._autoTimer = setInterval(() => this._autoSwitch(), 30000);
    this._countdownTimer = setInterval(() => {
      this._countdown--;
      if (this._countdown <= 0) this._countdown = 30;
      const el = document.getElementById('autoCountdown');
      if (el) el.textContent = `· ${this._countdown}s`;
    }, 1000);
    const btn = document.getElementById('autoBtn');
    if (btn) { btn.style.borderColor = 'var(--primary)'; btn.style.color = 'var(--primary)'; }
    const el = document.getElementById('autoCountdown');
    if (el) el.textContent = '· 30s';
  },

  _stopAuto() {
    this._autoOn = false;
    clearInterval(this._autoTimer);
    clearInterval(this._countdownTimer);
    this._autoTimer = null;
    this._countdownTimer = null;
    const btn = document.getElementById('autoBtn');
    if (btn) { btn.style.borderColor = ''; btn.style.color = ''; }
    const el = document.getElementById('autoCountdown');
    if (el) el.textContent = '';
  },

  _autoSwitch() {
    const streaming = this._match?.cameras.filter(c => c.isStreaming).map(c => c.number) || [];
    if (streaming.length < 2) return;
    const currentIdx = streaming.indexOf(this._featured);
    const nextIdx = (currentIdx + 1) % streaming.length;
    this.feature(streaming[nextIdx]);
  },

  _updateHeader() {
    const m = this._match;
    const t = document.getElementById('dirTitle');
    const tm = document.getElementById('dirTeams');
    const live = document.getElementById('dirLive');
    if (t) t.textContent = m.title;
    if (tm) tm.textContent = `${m.teamA} vs ${m.teamB}`;
    if (live) live.innerHTML = m.isLive ? '<span class="badge-live">LIVE</span>' : '';
  },

  _connectAll() {
    const streaming = this._match.cameras.filter(c => c.isStreaming);
    if (this._match.isDemo) {
      this._renderGrid();
      this._attachDemoVideos();
      return;
    }
    // Close PCs for cameras that stopped streaming
    this._pcs.forEach((pc, num) => {
      if (!streaming.find(c => c.number === num)) { pc.close(); this._pcs.delete(num); }
    });
    // Connect to new streaming cameras
    streaming.forEach(cam => {
      if (!this._pcs.has(cam.number)) this._connectCam(cam.number);
    });
    this._renderGrid();
  },

  _attachDemoVideos() {
    const cameras = this._match.cameras.filter(c => c.isStreaming && c.videoSrc);
    cameras.forEach(cam => {
      const vid = document.getElementById(`dirVid${cam.number}`);
      const overlay = document.getElementById(`dirOverlay${cam.number}`);
      if (!vid) return;
      if (!vid.src || !vid.src.endsWith(cam.videoSrc)) {
        vid.src = cam.videoSrc;
        vid.style.display = '';
        vid.load();
        // Sync to master (cam 1) time when ready
        vid.addEventListener('canplay', () => {
          const master = document.getElementById('dirVid1');
          if (master && cam.number !== 1) vid.currentTime = master.currentTime;
          vid.play().catch(() => {});
        }, { once: true });
      }
      if (overlay) overlay.style.display = 'none';
    });
    // Start master
    const master = document.getElementById('dirVid1');
    if (master && master.paused) master.play().catch(() => {});
  },

  _connectCam(num) {
    const pc = WebRTCHelper.createPC();
    this._pcs.set(num, pc);

    pc.ontrack = (e) => {
      const vid = document.getElementById(`dirVid${num}`);
      const overlay = document.getElementById(`dirOverlay${num}`);
      if (vid) vid.srcObject = e.streams[0];
      if (overlay) overlay.style.display = 'none';
    };

    pc.onicecandidate = (e) => {
      const socketId = this._camSocketIds.get(num);
      if (e.candidate && socketId) {
        SocketClient.get().emit('webrtc-ice-candidate', {
          targetSocketId: socketId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        const overlay = document.getElementById(`dirOverlay${num}`);
        if (overlay) overlay.style.display = 'flex';
        const vid = document.getElementById(`dirVid${num}`);
        if (vid) vid.srcObject = null;
        this._pcs.delete(num);
      }
    };

    SocketClient.get().emit('webrtc-request-stream', { matchCode: this._code, cameraNumber: num });
  },

  _renderGrid() {
    const grid = document.getElementById('dirGrid');
    if (!grid) return;
    const streaming = new Set(this._match?.cameras.filter(c => c.isStreaming).map(c => c.number) || []);
    grid.innerHTML = [1,2,3,4].map(n => this._cellHTML(n, streaming.has(n) ? this._match.cameras.find(c => c.number === n) : null)).join('');
  },

  _cellHTML(num, cam) {
    const isFeatured = this._featured === num;
    const isCut = this._cut === num;
    const role = cam?.role || `CAM ${num}`;
    return `
      <div class="director-cell ${isFeatured ? 'featured' : ''} ${isCut ? 'on-air' : ''}" id="dirCell${num}"
           onclick="DirectorPage.feature(${num})">
        <video id="dirVid${num}" autoplay playsinline muted style="${cam ? '' : 'display:none'}"></video>
        <div class="director-cell-overlay" id="dirOverlay${num}" style="${cam ? 'display:none' : ''}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          <span style="font-size:11px;">Waiting...</span>
        </div>
        <div class="director-cell-label">
          CAM ${num}${cam ? ' · ' + role : ''}${isFeatured ? ' ★' : ''}
        </div>
        ${cam ? `
          <button class="director-push-btn ${isCut ? 'active' : ''}"
            onclick="event.stopPropagation(); DirectorPage.pushCut(${num})">
            ${isCut ? 'ON AIR' : 'PUSH LIVE'}
          </button>
        ` : ''}
        ${isCut ? '<div class="director-onair-pip">ON AIR</div>' : ''}
      </div>
    `;
  },

  feature(num) {
    this._featured = this._featured === num ? null : num;
    document.querySelectorAll('.director-cell').forEach(el => el.classList.remove('featured'));
    if (this._featured) {
      const cell = document.getElementById(`dirCell${num}`);
      if (cell) cell.classList.add('featured');
    }
  },

  pushCut(num) {
    if (this._cut === num) { this.releaseCut(); return; }
    this._cut = num;
    SocketClient.get().emit('director-cut', { code: this._code, cameraNumber: num });
    // In demo mode also feature it locally
    if (this._match?.isDemo) this.feature(num);
    this._renderGrid();
    this._updateCutBar();
  },

  releaseCut() {
    this._cut = null;
    SocketClient.get().emit('director-cut', { code: this._code, cameraNumber: null });
    this._renderGrid();
    this._updateCutBar();
  },

  _updateCutBar() {
    const bar = document.getElementById('dirCutBar');
    const label = document.getElementById('dirCutLabel');
    if (!bar || !label) return;
    if (this._cut !== null) {
      const cam = this._match?.cameras.find(c => c.number === this._cut);
      bar.classList.remove('hidden');
      label.innerHTML = `All viewers → <strong>CAM ${this._cut}${cam?.role ? ' · ' + cam.role : ''}</strong>`;
    } else {
      bar.classList.add('hidden');
    }
  },

  leave() {
    this.unmount();
    navigate('broadcast');
  },
};
