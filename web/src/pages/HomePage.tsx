import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { useAuth } from '../context/AuthContext';
import { disconnectSocket } from '../api';

const hostActions = [
  { key: 'dashboard', title: 'My Dashboard', description: 'Manage your matches & scores', icon: '▤', path: '/dashboard' },
  { key: 'create', title: 'Create Match', description: 'Set up a new broadcast', icon: '+', path: '/create' },
  { key: 'join', title: 'Join as Camera', description: 'Enter a match code', icon: '~', path: '/join' },
  { key: 'watch', title: 'Watch a Match', description: 'Browse live streams', icon: '>', path: '/matches' },
];

const viewerActions = [
  { key: 'watch', title: 'Watch a Match', description: 'Browse live streams', icon: '>', path: '/matches' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const actions = user?.role === 'host' ? hostActions : viewerActions;

  const handleLogout = () => {
    if (!window.confirm('Sign out of noCaps?')) return;
    disconnectSocket();
    logout();
  };

  return (
    <div style={s.page}>
      {/* Top bar */}
      <div style={s.topBar}>
        <div>
          <p style={s.greeting}>Hello, {user?.displayName}</p>
          <span style={s.badge}>{user?.role === 'host' ? 'HOST' : 'VIEWER'}</span>
        </div>
        <button onClick={handleLogout} style={s.signOutBtn}>Sign Out</button>
      </div>

      {/* Logo */}
      <div style={s.logoArea}>
        <img src="/logo.png" alt="noCaps" style={s.logo} />
        <p style={s.tagline}>AI-POWERED SPORTS BROADCASTING</p>
      </div>

      {/* Action cards */}
      <div style={s.actions}>
        {actions.map((a) => (
          <button key={a.key} onClick={() => navigate(a.path)} style={s.card}>
            <div style={s.cardIcon}><span style={s.cardIconText}>{a.icon}</span></div>
            <div style={s.cardContent}>
              <p style={s.cardTitle}>{a.title}</p>
              <p style={s.cardDesc}>{a.description}</p>
            </div>
            <span style={s.chevron}>{'>'}</span>
          </button>
        ))}

        {user?.role === 'viewer' && (
          <p style={s.viewerNote}>Want to host? Create a new account with the Host role.</p>
        )}
      </div>

      <p style={s.footer}>Team 3: Tabish, Akshara, Sai, Kiruthika</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: colors.background, padding: `0 ${spacing.lg}px` },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: spacing.lg },
  greeting: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 500 },
  badge: {
    display: 'inline-block', marginTop: 4, background: colors.primaryDark, borderRadius: 6,
    padding: '2px 8px', fontSize: fontSize.xs, color: colors.primary, fontWeight: 700, letterSpacing: 1,
  },
  signOutBtn: { background: 'none', color: colors.textMuted, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
  logoArea: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 260, height: 75, objectFit: 'contain' },
  tagline: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm, letterSpacing: 1 },
  actions: { display: 'flex', flexDirection: 'column', gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    display: 'flex', alignItems: 'center', background: colors.surface, borderRadius: 16,
    padding: spacing.lg, border: `1px solid ${colors.border}`, cursor: 'pointer', width: '100%', textAlign: 'left',
    gap: spacing.md,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12, background: colors.primaryDark,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardIconText: { fontSize: fontSize.xl, color: colors.primary, fontWeight: 700 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: 600, color: colors.textPrimary },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: fontSize.lg, color: colors.textMuted },
  viewerNote: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  footer: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', paddingBottom: spacing.md },
};
