import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { listMatches, type MatchDTO } from '../api';

export default function MatchListPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = () => {
    setLoading(true);
    listMatches()
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMatches(); }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={() => navigate('/home')} style={s.back}>← Back</button>
        <h1 style={s.title}>Live Matches</h1>
        <button onClick={fetchMatches} style={s.refresh}>Refresh</button>
      </div>

      {loading ? (
        <div style={s.center}><div className="spinner" /></div>
      ) : matches.length === 0 ? (
        <div style={s.empty}>
          <p style={s.emptyText}>No active matches</p>
          <p style={s.emptyHint}>Matches will appear here when broadcasters create them</p>
        </div>
      ) : (
        <div style={s.list}>
          {matches.map((m) => (
            <button
              key={m.code}
              style={s.card}
              onClick={() => navigate('/viewer', { state: { matchTitle: m.title, matchCode: m.code, teamA: m.teamA, teamB: m.teamB } })}
            >
              <div style={s.cardHeader}>
                {m.sport && <span style={s.sportBadge}>{m.sport.toUpperCase()}</span>}
                {m.isLive && (
                  <span style={s.liveBadge}>
                    <span className="live-dot" style={s.liveDot} />
                    LIVE
                  </span>
                )}
              </div>
              <p style={s.matchTitle}>{m.title}</p>
              <p style={s.teams}>{m.teamA} vs {m.teamB}</p>
              {m.venue && <p style={s.venue}>{m.venue}</p>}
              {m.cameras.length > 0 && (
                <p style={s.cameras}>{m.cameras.length} camera{m.cameras.length !== 1 ? 's' : ''} broadcasting</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: colors.background, display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.lg}px ${spacing.lg}px ${spacing.sm}px` },
  back: { background: 'none', color: colors.textMuted, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
  title: { fontSize: fontSize.xl, fontWeight: 700, color: colors.textPrimary },
  refresh: { background: 'none', color: colors.primary, fontSize: fontSize.sm, fontWeight: 600, cursor: 'pointer', padding: 0 },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyText: { fontSize: fontSize.lg, color: colors.textSecondary, fontWeight: 600 },
  emptyHint: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: spacing.md, padding: spacing.lg, overflowY: 'auto' },
  card: {
    background: colors.surface, borderRadius: 16, padding: spacing.lg, border: `1px solid ${colors.border}`,
    cursor: 'pointer', textAlign: 'left', width: '100%',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sportBadge: {
    background: colors.surfaceLight, borderRadius: 8, padding: '2px 8px',
    fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: 600, letterSpacing: 0.5,
  },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,77,77,0.15)',
    borderRadius: 6, padding: '2px 8px', fontSize: fontSize.xs, fontWeight: 800, color: '#FF4D4D', letterSpacing: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, background: '#FF4D4D', display: 'inline-block' },
  matchTitle: { fontSize: fontSize.lg, fontWeight: 700, color: colors.textPrimary },
  teams: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 4 },
  venue: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
  cameras: { fontSize: fontSize.xs, color: colors.primary, marginTop: spacing.sm, fontWeight: 600 },
};
