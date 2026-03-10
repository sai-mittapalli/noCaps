import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { getMatch } from '../api';
import { useAuth } from '../context/AuthContext';

export default function JoinMatchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    setLoading(true);
    setError('');
    try {
      const match = await getMatch(code.trim());
      if (!match) { setError('No match found with that code.'); return; }
      navigate('/camera-role', {
        state: { matchTitle: match.title, matchCode: match.code, teamA: match.teamA, teamB: match.teamB, sport: match.sport },
      });
    } catch {
      setError('Could not connect to server. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <button onClick={() => navigate(user ? '/home' : '/login')} style={s.back}>← Back</button>
      <div style={s.content}>
        <h1 style={s.title}>Enter Match Code</h1>
        <p style={s.hint}>Get the 6-character code from the match organizer</p>

        <form onSubmit={handleJoin} style={{ width: '100%' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={s.codeInput}
          />

          {error && <p style={s.error}>{error}</p>}

          <button
            type="submit"
            disabled={code.length < 6 || loading}
            style={{ ...s.btn, ...(code.length < 6 ? s.btnDisabled : {}) }}
          >
            {loading ? 'Joining...' : 'Join Match'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh', background: colors.background, display: 'flex', flexDirection: 'column',
    padding: `${spacing.lg}px ${spacing.lg}px`,
  },
  back: { background: 'none', color: colors.textMuted, fontSize: fontSize.sm, cursor: 'pointer', padding: 0, alignSelf: 'flex-start' },
  content: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md,
  },
  title: { fontSize: fontSize.xxl, fontWeight: 700, color: colors.textPrimary },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  codeInput: {
    background: colors.surface, border: `2px solid ${colors.border}`, borderRadius: 16,
    padding: `${spacing.lg}px ${spacing.xl}px`, fontSize: 36, fontWeight: 800,
    color: colors.primary, letterSpacing: 8, width: '100%', textAlign: 'center',
    display: 'block', marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  error: { fontSize: fontSize.sm, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  btn: {
    background: colors.primary, color: colors.textPrimary, borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, fontWeight: 700, width: '100%', cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.4 },
};
