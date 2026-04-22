const LoginPage = {
  render() {
    return `
      <div class="login-page">
        <div class="login-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="3" x2="12" y2="1"/>
            <line x1="12" y1="23" x2="12" y2="21"/>
            <line x1="3" y1="12" x2="1" y2="12"/>
            <line x1="23" y1="12" x2="21" y2="12"/>
          </svg>
          <div class="login-logo-text"><span>no</span>caps</div>
        </div>
        <p class="login-tagline">AI-powered multi-camera<br>sports broadcasting</p>

        <div class="login-form">
          <div class="form-group">
            <label class="label">Your name</label>
            <input id="usernameInput" class="input" type="text" placeholder="e.g. Kiruthika" autocomplete="off" autocapitalize="words" />
          </div>
          <button class="btn btn-primary btn-full btn-lg" onclick="LoginPage.submit()">
            Continue
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  mount() {
    const input = document.getElementById('usernameInput');
    if (input) {
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') LoginPage.submit();
      });
    }
  },

  unmount() {},

  submit() {
    const val = document.getElementById('usernameInput').value.trim();
    if (!val) return;
    App.login(val);
    navigate('matches');
  },
};
