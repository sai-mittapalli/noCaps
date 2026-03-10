import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyMatches, onMatchUpdated, type MatchDTO } from '../api';
import { colors, spacing, fontSize } from '../theme';

export default function HostDashboardPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyMatches()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, []);

  // Keep list in sync when any match updates via socket
  useEffect(() => {
    return onMatchUpdated((updated) => {
      setMatches((prev) =>
        prev.map((m) => (m.code === updated.code ? updated : m))
      );
    });
  }, []);

  const active = matches.filter((m) => !m.endedAt);
  const ended = matches.filter((m) => m.endedAt);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={() => navigate('/home')} style={s.back}>← Back</button>
        <h1 style={s.title}>My Matches</h1>
        <button onClick={() => navigate('/create')} style={s.newBtn}>+ New</button>
      </div>

      {loading ? (
        <p style={s.empty}>Loading...</p>
      ) : matches.length === 0 ? (
        <div style={s.emptyState}>
          <p style={s.emptyTitle}>No matches yet</p>
          <p style={s.emptyDesc}>Create your first match to get started</p>
          <button onClick={() => navigate('/create')} style={s.createBtn}>Create Match</button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <p style={s.sectionLabel}>ACTIVE</p>
              {active.map((m) => <MatchCard key={m.code} match={m} onClick={() => navigate(`/dashboard/${m.code}`)} />)}
            </section>
          )}
          {ended.length > 0 && (
            <section style={{ marginTop: spacing.lg }}>
              <p style={s.sectionLabel}>ENDED</p>
              {ended.map((m) => <MatchCard key={m.code} match={m} onClick={() => navigate(`/dashboard/${m.code}`)} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({ match, onClick }: { match: MatchDTO; onClick: () => void }) {
  const activeCams = match.cameras.filter((c) => c.isStreaming).length;
  const connectedCams = match.cameras.length;
  const isEnded = !!match.endedAt;

  return (
    <button onClick={onClick} style={s.card}>
      <div style={s.cardLeft}>
        <div style={s.cardTitleRow}>
          <span style={s.cardTitle}>{match.title}</span>
          {match.isLive && !isEnded && <span style={s.liveDot} />}
          {isEnded && <span style={s.endedBadge}>ENDED</span>}
        </div>
        <span style={s.cardTeams}>{match.teamA} vs {match.teamB}</span>
        <span style={s.cardCode}>{match.code}</span>
      </div>
      <div style={s.cardRight}>
        {!isEnded && (
          <span style={s.cardScore}>
            {match.scoreA} – {match.scoreB}
          </span>
        )}
        {connectedCams > 0 && (
          <span style={s.camCount}>
            {activeCams}/{connectedCams} cam{connectedCams !== 1 ? 's' : ''}
          </span>
        )}
        <span style={s.chevron}>›</span>
      </div>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100dvh',
    background: colors.background, padding: `0 ${spacing.lg}px`,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.lg, paddingBottom: spacing.lg,
  },
  back: { background: 'none', color: colors.textSecondary, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
  title: { fontSize: fontSize.xl, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  newBtn: {
    background: colors.primary, color: '#000', fontSize: fontSize.sm,
    fontWeight: 700, borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
  },
  sectionLabel: {
    fontSize: fontSize.xs, color: colors.textMuted, fontWeight: 700,
    letterSpacing: 1, marginBottom: spacing.sm,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, color: colors.textPrimary, fontWeight: 600 },
  emptyDesc: { fontSize: fontSize.sm, color: colors.textSecondary },
  createBtn: {
    marginTop: spacing.md, background: colors.primary, color: '#000',
    fontWeight: 700, borderRadius: 12, padding: '12px 32px', cursor: 'pointer', fontSize: fontSize.md,
  },
  card: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: colors.surface, borderRadius: 16, padding: spacing.lg,
    border: `1px solid ${colors.border}`, cursor: 'pointer', width: '100%',
    textAlign: 'left', marginBottom: spacing.sm,
  },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  cardTitleRow: { display: 'flex', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: fontSize.md, fontWeight: 600, color: colors.textPrimary },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: colors.success, flexShrink: 0 },
  endedBadge: {
    fontSize: fontSize.xs, color: colors.textMuted, background: colors.surfaceLight,
    borderRadius: 4, padding: '2px 6px', fontWeight: 600,
  },
  cardTeams: { fontSize: fontSize.sm, color: colors.textSecondary },
  cardCode: { fontSize: fontSize.xs, color: colors.textMuted, fontFamily: 'monospace', letterSpacing: 2 },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  cardScore: { fontSize: fontSize.lg, fontWeight: 700, color: colors.primary },
  camCount: { fontSize: fontSize.xs, color: colors.textMuted },
  chevron: { fontSize: fontSize.xl, color: colors.textMuted },
};
