import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { registerApi, type UserRole } from '../api';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim() || !email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { token, user } = await registerApi({ email: email.trim(), password, role, displayName: displayName.trim() });
      login(token, user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <button onClick={() => navigate('/login')} style={s.back}>← Back</button>
        <h1 style={s.title}>Create Account</h1>
        <p style={s.subtitle}>Join noCaps to broadcast or watch games</p>

        <form onSubmit={handleSignup} style={s.form}>
          <label style={s.label}>Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name" style={s.input} autoComplete="name" />

          <label style={s.label}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" style={s.input} autoComplete="email" />

          <label style={s.label}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters" style={s.input} autoComplete="new-password" />

          <label style={s.label}>I want to...</label>
          <div style={s.roleRow}>
            <button type="button" onClick={() => setRole('viewer')}
              style={{ ...s.roleCard, ...(role === 'viewer' ? s.roleCardActive : {}) }}>
              <span style={s.roleIcon}>{'>'}</span>
              <span style={{ ...s.roleName, ...(role === 'viewer' ? s.roleNameActive : {}) }}>Watch Games</span>
              <span style={s.roleDesc}>Browse and stream live matches</span>
            </button>
            <button type="button" onClick={() => setRole('host')}
              style={{ ...s.roleCard, ...(role === 'host' ? s.roleCardActive : {}) }}>
              <span style={s.roleIcon}>+</span>
              <span style={{ ...s.roleName, ...(role === 'host' ? s.roleNameActive : {}) }}>Host Games</span>
              <span style={s.roleDesc}>Create matches and manage cameras</span>
            </button>
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p style={s.switchText}>
            Already have an account?{' '}
            <button type="button" onClick={() => navigate('/login')} style={s.link}>Sign in</button>
          </p>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: colors.background, overflowY: 'auto' },
  inner: { padding: `${spacing.lg}px ${spacing.lg}px ${spacing.xxl}px` },
  back: { background: 'none', color: colors.textMuted, fontSize: fontSize.sm, cursor: 'pointer', padding: 0, marginBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: 700, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xl },
  form: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500, marginBottom: 2 },
  input: {
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, color: colors.textPrimary,
    marginBottom: spacing.sm, width: '100%',
  },
  roleRow: { display: 'flex', gap: spacing.sm, marginBottom: spacing.sm },
  roleCard: {
    flex: 1, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16,
    padding: spacing.md, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: spacing.xs, cursor: 'pointer',
  },
  roleCardActive: { borderColor: colors.primary, background: colors.primaryDark },
  roleIcon: { fontSize: fontSize.xl, color: colors.primary, fontWeight: 700 },
  roleName: { fontSize: fontSize.sm, fontWeight: 600, color: colors.textSecondary, textAlign: 'center' as const },
  roleNameActive: { color: colors.textPrimary },
  roleDesc: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' as const },
  error: { fontSize: fontSize.sm, color: colors.error, textAlign: 'center' },
  btn: {
    background: colors.primary, color: colors.textPrimary, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, fontWeight: 600,
    marginTop: spacing.sm, width: '100%', cursor: 'pointer',
  },
  switchText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  link: { background: 'none', color: colors.primary, fontWeight: 600, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
};
