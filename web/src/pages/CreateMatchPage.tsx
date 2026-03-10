import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spacing, fontSize } from '../theme';
import { createMatch } from '../api';

const SPORTS = ['Basketball', 'Table Tennis', 'Billiards', 'Soccer', 'Football', 'Tennis', 'Volleyball', 'Baseball', 'Other'];

export default function CreateMatchPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [sport, setSport] = useState('');
  const [venue, setVenue] = useState('');
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !teamA.trim() || !teamB.trim()) {
      setError('Please fill in match title and both team names.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const match = await createMatch({ title, teamA, teamB, sport, venue });
      setMatchCode(match.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create match. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!matchCode) return;
    navigate('/camera-role', { state: { matchTitle: title || `${teamA} vs ${teamB}`, matchCode, teamA, teamB, sport } });
  };

  if (matchCode) {
    return (
      <div style={s.page}>
        <div style={s.codeScreen}>
          <p style={s.codeLabel}>Your Match Code</p>
          <p style={s.codeText}>{matchCode}</p>
          <p style={s.codeHint}>Share this code with camera operators to join your broadcast</p>

          <div style={s.summary}>
            <p style={s.summaryTitle}>{title || `${teamA} vs ${teamB}`}</p>
            <p style={s.summaryDetail}>{teamA} vs {teamB}</p>
            {sport && <p style={s.summaryDetail}>{sport}</p>}
            {venue && <p style={s.summaryDetail}>{venue}</p>}
          </div>

          <button onClick={handleContinue} style={s.btn}>Continue as Camera</button>
          <button onClick={() => navigate('/home')} style={s.secondaryBtn}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <button onClick={() => navigate('/home')} style={s.back}>← Back</button>
        <h1 style={s.title}>Create Match</h1>

        <form onSubmit={handleCreate} style={s.form}>
          <p style={s.sectionLabel}>MATCH DETAILS</p>

          <label style={s.label}>Match Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CMU vs Pitt" style={s.input} />

          <label style={s.label}>Team A</label>
          <input value={teamA} onChange={(e) => setTeamA(e.target.value)}
            placeholder="Home team name" style={s.input} />

          <label style={s.label}>Team B</label>
          <input value={teamB} onChange={(e) => setTeamB(e.target.value)}
            placeholder="Away team name" style={s.input} />

          <label style={s.label}>Sport</label>
          <div style={s.chipRow}>
            {SPORTS.map((s_) => (
              <button key={s_} type="button" onClick={() => setSport(s_)}
                style={{ ...chipStyle, ...(sport === s_ ? activeChipStyle : {}) }}>
                {s_}
              </button>
            ))}
          </div>

          <label style={s.label}>Venue / Court</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Gesling Stadium" style={s.input} />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Creating...' : 'Create Match'}
          </button>
        </form>
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  padding: `${6}px ${14}px`, borderRadius: 20, background: '#1A1A1A',
  border: '1px solid #2A2A2A', fontSize: 14, color: '#A0A0A0', cursor: 'pointer',
};
const activeChipStyle: React.CSSProperties = {
  background: '#2B7A78', borderColor: '#3AAFA9', color: '#3AAFA9', fontWeight: 600,
};

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: '#0D0D0D', overflowY: 'auto' },
  inner: { padding: `${spacing.lg}px ${spacing.lg}px ${spacing.xxl}px` },
  back: { background: 'none', color: '#666', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: 700, color: '#fff', marginBottom: spacing.xl },
  form: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: 600, color: '#A0A0A0', letterSpacing: 1, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: 600, color: '#A0A0A0', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  input: {
    background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12,
    padding: `${spacing.md}px`, fontSize: fontSize.md, color: '#fff',
    marginBottom: spacing.sm, width: '100%',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  error: { fontSize: fontSize.sm, color: '#FF4D4D', textAlign: 'center' },
  btn: {
    background: '#3AAFA9', color: '#fff', borderRadius: 12, padding: `${spacing.md}px`,
    fontSize: fontSize.md, fontWeight: 700, marginTop: spacing.lg, width: '100%', cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'none', color: '#666', fontSize: fontSize.sm, cursor: 'pointer',
    padding: `${spacing.sm}px`, marginTop: spacing.sm, width: '100%',
  },
  codeScreen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100dvh', padding: spacing.lg,
  },
  codeLabel: { fontSize: fontSize.md, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: 1 },
  codeText: { fontSize: 56, fontWeight: 800, color: '#3AAFA9', letterSpacing: 8, marginTop: spacing.sm },
  codeHint: { fontSize: fontSize.sm, color: '#666', textAlign: 'center', marginTop: spacing.md, maxWidth: 280 },
  summary: {
    background: '#1A1A1A', borderRadius: 16, padding: spacing.lg, marginTop: spacing.xl,
    width: '100%', border: '1px solid #2A2A2A', textAlign: 'center',
  },
  summaryTitle: { fontSize: fontSize.lg, fontWeight: 700, color: '#fff' },
  summaryDetail: { fontSize: fontSize.sm, color: '#A0A0A0', marginTop: 4 },
};
