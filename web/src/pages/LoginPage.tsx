import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { loginApi } from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const { token, user } = await loginApi({ email: email.trim(), password });
      login(token, user);
      // AppRoutes will redirect to /home automatically
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.header}>
          <img src="/logo.png" alt="noCaps" style={s.logo} />
          <p style={s.tagline}>AI-POWERED SPORTS BROADCASTING</p>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={s.input}
            autoComplete="email"
          />

          <label style={s.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={s.input}
            autoComplete="current-password"
          />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p style={s.switchText}>
            Don't have an account?{' '}
            <button type="button" onClick={() => navigate('/signup')} style={s.link}>
              Create one
            </button>
          </p>
        </form>

        {/* Guest camera shortcut */}
        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <span style={s.dividerLabel}>or</span>
          <div style={s.dividerLine} />
        </div>

        <button onClick={() => navigate('/join')} style={s.guestBtn}>
          Join as Camera
        </button>
        <p style={s.guestHint}>No account needed — just enter your match code</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: colors.background, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  inner: { padding: `${spacing.xl}px ${spacing.lg}px` },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: spacing.xxl },
  logo: { width: 220, height: 65, objectFit: 'contain' },
  tagline: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 1 },
  form: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: 2 },
  input: {
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, color: colors.textPrimary,
    marginBottom: spacing.sm, width: '100%', transition: 'border-color 0.2s',
  },
  error: { fontSize: fontSize.sm, color: colors.error, textAlign: 'center' },
  btn: {
    background: colors.primary, color: colors.textPrimary, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, fontWeight: 600,
    marginTop: spacing.sm, width: '100%', cursor: 'pointer',
  },
  switchText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  link: { background: 'none', color: colors.primary, fontWeight: 600, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
  dividerRow: { display: 'flex', alignItems: 'center', gap: spacing.sm, margin: `${spacing.xl}px 0 ${spacing.md}px` },
  dividerLine: { flex: 1, height: 1, background: colors.border },
  dividerLabel: { fontSize: fontSize.xs, color: colors.textMuted, letterSpacing: 1 },
  guestBtn: {
    width: '100%', background: 'none', border: `1px solid ${colors.border}`, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, fontWeight: 600,
    color: colors.textSecondary, cursor: 'pointer',
  },
  guestHint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
};
