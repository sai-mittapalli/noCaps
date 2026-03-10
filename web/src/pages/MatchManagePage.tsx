import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteParticipant,
  RemoteVideoTrack,
  Track,
} from 'livekit-client';
import { getMatch, updateScore, endMatch, onMatchUpdated, getLiveKitToken, type MatchDTO } from '../api';
import { colors, spacing, fontSize } from '../theme';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string;

export default function MatchManagePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [previewCamera, setPreviewCamera] = useState<number | null>(null);

  const roomRef = useRef<Room | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCamRef = useRef<number | null>(null);

  useEffect(() => { previewCamRef.current = previewCamera; }, [previewCamera]);

  useEffect(() => {
    if (!code) return;
    getMatch(code).then(setMatch).finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    return onMatchUpdated((updated) => {
      if (updated.code === code?.toUpperCase()) setMatch(updated);
    });
  }, [code]);

  // Connect to LiveKit as a viewer so we can preview cameras
  useEffect(() => {
    if (!code || !LIVEKIT_URL || LIVEKIT_URL.includes('your-project')) return;

    const identity = `host-preview-${Math.random().toString(36).slice(2, 8)}`;
    let room: Room;

    async function connect() {
      const token = await getLiveKitToken(code!, identity, 'viewer');
      room = new Room({ adaptiveStream: true, dynacast: false });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Video) return;
        const camNum = parseCameraNumber(participant.identity);
        if (camNum === previewCamRef.current) {
          (track as RemoteVideoTrack).attach(previewVideoRef.current!);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Video) return;
        const camNum = parseCameraNumber(participant.identity);
        if (camNum === previewCamRef.current) {
          (track as RemoteVideoTrack).detach();
          if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
          setPreviewCamera(null);
        }
      });

      await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
    }

    connect().catch(console.error);
    return () => { room?.disconnect(); roomRef.current = null; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  function parseCameraNumber(identity: string): number | null {
    const m = identity.match(/^cam-(\d+)$/);
    return m ? parseInt(m[1]) : null;
  }

  const openPreview = (cameraNumber: number) => {
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    setPreviewCamera(cameraNumber);
    previewCamRef.current = cameraNumber;

    // Attach immediately if track already exists
    const room = roomRef.current;
    if (!room) return;
    const participant = room.remoteParticipants.get(`cam-${cameraNumber}`);
    if (participant) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.kind === Track.Kind.Video) {
          (pub.track as RemoteVideoTrack).attach(previewVideoRef.current!);
          return;
        }
      }
    }
  };

  const closePreview = () => {
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    setPreviewCamera(null);
    previewCamRef.current = null;
  };

  const handleScore = async (teamADelta: number, teamBDelta: number) => {
    if (!match || match.endedAt) return;
    const newA = Math.max(0, match.scoreA + teamADelta);
    const newB = Math.max(0, match.scoreB + teamBDelta);
    try {
      const updated = await updateScore(match.code, newA, newB);
      setMatch(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update score');
    }
  };

  const handleEnd = async () => {
    if (!match) return;
    if (!window.confirm(`End "${match.title}"? This cannot be undone.`)) return;
    setEnding(true);
    try {
      const updated = await endMatch(match.code);
      setMatch(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to end match');
    } finally {
      setEnding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.textMuted }}>Loading...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.error }}>Match not found</p>
        <button onClick={() => navigate('/dashboard')} style={s.backLink}>← Dashboard</button>
      </div>
    );
  }

  const isEnded = !!match.endedAt;
  const streamingCams = match.cameras.filter((c) => c.isStreaming);
  const idleCams = match.cameras.filter((c) => !c.isStreaming);

  return (
    <div style={s.page}>
      {/* Camera preview overlay */}
      {previewCamera !== null && (
        <div style={s.overlay}>
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            style={s.overlayVideo}
          />
          <div style={s.overlayTop}>
            <button onClick={closePreview} style={s.closeBtn}>✕</button>
            <span style={s.overlayLabel}>CAM {previewCamera}</span>
            <div style={{ width: 40 }} />
          </div>
          {/* Score overlay */}
          <div style={s.scoreOverlay}>
            <span style={s.scoreOverlayText}>{match.teamA} {match.scoreA} – {match.scoreB} {match.teamB}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.back}>← Dashboard</button>
        <div style={s.headerCenter}>
          <span style={s.matchCode}>{match.code}</span>
          {match.isLive && !isEnded && <span style={s.livePill}>● LIVE</span>}
          {isEnded && <span style={s.endedPill}>ENDED</span>}
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Title + teams */}
      <div style={s.titleBlock}>
        <h1 style={s.matchTitle}>{match.title}</h1>
        {match.venue ? <p style={s.subtitle}>{match.venue}</p> : null}
      </div>

      {/* Scoreboard */}
      <div style={s.scoreboard}>
        <div style={s.teamBlock}>
          <p style={s.teamName}>{match.teamA}</p>
          <p style={s.scoreNum}>{match.scoreA}</p>
          {!isEnded && (
            <div style={s.scoreButtons}>
              <button onClick={() => handleScore(1, 0)} style={s.scoreBtn}>+</button>
              <button onClick={() => handleScore(-1, 0)} style={s.scoreBtnMinus}>−</button>
            </div>
          )}
        </div>

        <div style={s.vs}><span style={s.vsText}>VS</span></div>

        <div style={s.teamBlock}>
          <p style={s.teamName}>{match.teamB}</p>
          <p style={s.scoreNum}>{match.scoreB}</p>
          {!isEnded && (
            <div style={s.scoreButtons}>
              <button onClick={() => handleScore(0, 1)} style={s.scoreBtn}>+</button>
              <button onClick={() => handleScore(0, -1)} style={s.scoreBtnMinus}>−</button>
            </div>
          )}
        </div>
      </div>

      {/* Camera Status */}
      <div style={s.section}>
        <p style={s.sectionLabel}>CAMERAS ({match.cameras.length} connected)</p>
        {match.cameras.length === 0 ? (
          <p style={s.noCams}>No cameras connected yet. Share the match code: <strong style={{ color: colors.primary, letterSpacing: 2 }}>{match.code}</strong></p>
        ) : (
          <div style={s.camGrid}>
            {[...streamingCams, ...idleCams].map((cam) => (
              <button
                key={cam.number}
                onClick={() => cam.isStreaming ? openPreview(cam.number) : undefined}
                style={{
                  ...s.camCard,
                  borderColor: cam.isStreaming ? colors.success : colors.border,
                  cursor: cam.isStreaming ? 'pointer' : 'default',
                }}
              >
                <span style={s.camNum}>CAM {cam.number}</span>
                <span style={s.camRole}>{cam.role}</span>
                <span style={{ ...s.camStatus, color: cam.isStreaming ? colors.success : colors.textMuted }}>
                  {cam.isStreaming ? '● Live' : '○ Idle'}
                </span>
                {cam.isStreaming && (
                  <span style={s.watchHint}>Tap to watch ›</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* End match */}
      {!isEnded && (
        <div style={s.dangerZone}>
          <button onClick={handleEnd} disabled={ending} style={s.endBtn}>
            {ending ? 'Ending...' : 'End Match'}
          </button>
          <p style={s.endNote}>Removes the match from the public list. Cameras will be disconnected.</p>
        </div>
      )}

      {isEnded && (
        <div style={s.endedBanner}>
          <p style={s.endedTitle}>Match ended</p>
          <p style={s.endedTime}>{new Date(match.endedAt!).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100dvh',
    background: colors.background, padding: `0 ${spacing.lg}px`, paddingBottom: spacing.xxl,
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 100, background: '#000',
    display: 'flex', flexDirection: 'column',
  },
  overlayVideo: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
  },
  overlayTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${spacing.lg}px ${spacing.md}px`,
    paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    fontSize: fontSize.md, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlayLabel: {
    fontSize: fontSize.sm, fontWeight: 700, color: '#fff',
    background: colors.primary, borderRadius: 8, padding: '4px 12px',
  },
  scoreOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: `${spacing.md}px`,
    paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 20px)',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
    display: 'flex', justifyContent: 'center',
  },
  scoreOverlayText: {
    fontSize: fontSize.md, fontWeight: 700, color: '#fff',
    background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '6px 16px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  back: { background: 'none', color: colors.textSecondary, fontSize: fontSize.sm, cursor: 'pointer', padding: 0 },
  headerCenter: { display: 'flex', alignItems: 'center', gap: spacing.sm },
  matchCode: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: 'monospace', letterSpacing: 2 },
  livePill: { fontSize: fontSize.xs, color: colors.success, fontWeight: 700 },
  endedPill: { fontSize: fontSize.xs, color: colors.textMuted, background: colors.surfaceLight, borderRadius: 4, padding: '2px 6px', fontWeight: 600 },
  backLink: { background: 'none', color: colors.primary, fontSize: fontSize.sm, cursor: 'pointer', padding: 0, marginTop: spacing.md },
  titleBlock: { marginBottom: spacing.xl },
  matchTitle: { fontSize: fontSize.xl, fontWeight: 700, color: colors.textPrimary, margin: 0 },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
  scoreboard: {
    display: 'flex', alignItems: 'center', background: colors.surface,
    borderRadius: 20, padding: `${spacing.xl}px ${spacing.lg}px`,
    border: `1px solid ${colors.border}`, marginBottom: spacing.xl,
  },
  teamBlock: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.sm },
  teamName: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: 600, textAlign: 'center' },
  scoreNum: { fontSize: 56, fontWeight: 800, color: colors.textPrimary, lineHeight: 1 },
  scoreButtons: { display: 'flex', gap: spacing.sm },
  scoreBtn: {
    width: 44, height: 44, borderRadius: 12, background: colors.primary,
    color: '#000', fontSize: fontSize.xl, fontWeight: 700, cursor: 'pointer',
  },
  scoreBtnMinus: {
    width: 44, height: 44, borderRadius: 12, background: colors.surfaceLight,
    color: colors.textSecondary, fontSize: fontSize.xl, fontWeight: 700, cursor: 'pointer',
  },
  vs: { width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: 700, letterSpacing: 2 },
  section: { marginBottom: spacing.xl },
  sectionLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: spacing.sm },
  noCams: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 },
  camGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm },
  camCard: {
    display: 'flex', flexDirection: 'column', gap: 4,
    background: colors.surface, borderRadius: 12, padding: spacing.md,
    border: '1px solid', textAlign: 'left',
  },
  camNum: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: 700, letterSpacing: 1 },
  camRole: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: 600 },
  camStatus: { fontSize: fontSize.xs, fontWeight: 600 },
  watchHint: { fontSize: fontSize.xs, color: colors.primary, marginTop: 4, fontWeight: 600 },
  dangerZone: { marginTop: 'auto', paddingTop: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.sm },
  endBtn: {
    background: 'transparent', border: `1px solid ${colors.error}`,
    color: colors.error, borderRadius: 12, padding: '14px',
    fontSize: fontSize.md, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  endNote: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  endedBanner: {
    marginTop: 'auto', paddingTop: spacing.xl,
    background: colors.surface, borderRadius: 16, padding: spacing.lg,
    border: `1px solid ${colors.border}`, textAlign: 'center',
  },
  endedTitle: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: 600 },
  endedTime: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4 },
};
