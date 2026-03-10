import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing, fontSize } from '../theme';
import { getSportConfig, type CameraRole, type OverlayShape } from '../data/sportCameraRoles';

interface LocationState {
  matchTitle: string;
  matchCode: string;
  teamA: string;
  teamB: string;
  sport: string;
}

function OverlayPreview({ shapes }: { shapes: OverlayShape[] }) {
  return (
    <svg viewBox="0 0 100 177" style={{ width: '100%', aspectRatio: '9/16', display: 'block' }}>
      <rect width="100" height="177" fill="#0a0f1a" rx="4" />
      {shapes.map((shape, i) => {
        const p = {
          fill: 'none' as const,
          stroke: 'rgba(255,220,50,0.85)',
          strokeWidth: 1.8,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          ...(shape.props as unknown as React.SVGAttributes<SVGElement>),
        };
        switch (shape.type) {
          case 'path':    return <path    key={i} {...p} />;
          case 'circle':  return <circle  key={i} {...p} />;
          case 'ellipse': return <ellipse key={i} {...p} />;
          case 'line':    return <line    key={i} {...p} />;
          case 'rect':    return <rect    key={i} {...p} />;
          default: return null;
        }
      })}
    </svg>
  );
}

export default function CameraRolePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matchTitle, matchCode, teamA, teamB, sport } = location.state as LocationState;
  const config = getSportConfig(sport);

  const handleSelect = (role: CameraRole) => {
    navigate('/camera', {
      state: { matchTitle, matchCode, cameraRole: role.label, cameraNumber: role.number, sport },
    });
  };

  return (
    <div style={s.page}>
      <button onClick={() => navigate(-1)} style={s.back}>← Back</button>

      <div style={s.matchBar}>
        <p style={s.matchTitle}>{matchTitle}</p>
        <p style={s.matchTeams}>{teamA} vs {teamB}</p>
        <span style={s.codeBadge}>{matchCode}</span>
      </div>

      <p style={s.sectionTitle}>{config.name} · Choose Camera Position</p>

      <div style={s.grid}>
        {config.roles.map((role) => (
          <button key={role.number} onClick={() => handleSelect(role)} style={s.card}>
            <div style={s.previewWrap}>
              <OverlayPreview shapes={role.overlay} />
              <span style={s.camTag}>CAM {role.number}</span>
            </div>
            <p style={s.roleName}>{role.label}</p>
            <p style={s.roleDesc}>{role.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: colors.background, padding: spacing.lg, overflowY: 'auto' },
  back: { background: 'none', color: colors.textMuted, fontSize: fontSize.sm, cursor: 'pointer', padding: 0, marginBottom: spacing.md, display: 'block' },
  matchBar: {
    background: colors.surface, borderRadius: 16, padding: spacing.lg, textAlign: 'center',
    border: `1px solid ${colors.border}`, marginBottom: spacing.lg,
  },
  matchTitle: { fontSize: fontSize.lg, fontWeight: 700, color: colors.textPrimary },
  matchTeams: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  codeBadge: {
    display: 'inline-block', background: colors.primaryDark, borderRadius: 8,
    padding: '2px 12px', fontSize: fontSize.sm, fontWeight: 700, color: colors.primary,
    letterSpacing: 2, marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.md,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md },
  card: {
    background: colors.surface, borderRadius: 16, padding: spacing.md, border: `1px solid ${colors.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'pointer', overflow: 'hidden',
  },
  previewWrap: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  camTag: {
    position: 'absolute', top: 6, left: 6,
    background: 'rgba(43,122,120,0.9)', borderRadius: 5,
    padding: '2px 7px', fontSize: 10, fontWeight: 700, color: colors.primary, letterSpacing: 1,
  },
  roleName: { fontSize: fontSize.md, fontWeight: 600, color: colors.textPrimary, textAlign: 'center', marginTop: 2 },
  roleDesc: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
};
