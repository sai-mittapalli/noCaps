import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteParticipant,
  RemoteVideoTrack,
  Track,
} from 'livekit-client';
import { colors, spacing, fontSize } from '../theme';
import { watchMatch, onMatchUpdated, getLiveKitToken, type MatchDTO, type CameraDTO } from '../api';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string;

interface LocationState {
  matchTitle: string;
  matchCode: string;
  teamA: string;
  teamB: string;
}

type ConnectionState = 'idle' | 'connecting' | 'connected';

export default function ViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matchTitle, matchCode, teamA, teamB } = location.state as LocationState;

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const selectedCamRef = useRef<number | null>(null);

  const [cameras, setCameras] = useState<CameraDTO[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');

  useEffect(() => { selectedCamRef.current = selectedCamera; }, [selectedCamera]);

  // Fetch match state via Socket.IO
  useEffect(() => {
    watchMatch(matchCode).then((res) => {
      if (res.match) { setCameras(res.match.cameras); setIsLive(res.match.isLive); }
    });
    return onMatchUpdated((match: MatchDTO) => {
      setCameras(match.cameras);
      setIsLive(match.isLive);
    });
  }, [matchCode]);

  // Connect to LiveKit as viewer
  useEffect(() => {
    if (!LIVEKIT_URL || LIVEKIT_URL.includes('your-project')) return;

    const identity = `viewer-${Math.random().toString(36).slice(2, 8)}`;
    let room: Room;

    async function connect() {
      const token = await getLiveKitToken(matchCode, identity, 'viewer');
      room = new Room({ adaptiveStream: true, dynacast: false });
      roomRef.current = room;

      // When a camera publishes a track, attach it if it's the selected one
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Video) return;
        const camNum = parseCameraNumber(participant.identity);
        if (camNum === selectedCamRef.current) {
          attachTrack(track as RemoteVideoTrack);
        }
      });

      // When a camera track is removed, clear video if it was selected
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Video) return;
        const camNum = parseCameraNumber(participant.identity);
        if (camNum === selectedCamRef.current) {
          (track as RemoteVideoTrack).detach();
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setConnectionState('idle');
          setSelectedCamera(null);
        }
      });

      await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
    }

    connect().catch(console.error);

    return () => {
      room?.disconnect();
      roomRef.current = null;
    };
  }, [matchCode]); // eslint-disable-line react-hooks/exhaustive-deps

  function parseCameraNumber(identity: string): number | null {
    const m = identity.match(/^cam-(\d+)$/);
    return m ? parseInt(m[1]) : null;
  }

  function attachTrack(track: RemoteVideoTrack) {
    if (remoteVideoRef.current) {
      track.attach(remoteVideoRef.current);
      setConnectionState('connected');
    }
  }

  const connectToCamera = (cameraNumber: number) => {
    // Detach any currently attached remote video tracks
    if (roomRef.current) {
      for (const participant of roomRef.current.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (pub.track && pub.kind === Track.Kind.Video) {
            (pub.track as RemoteVideoTrack).detach();
          }
        }
      }
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setSelectedCamera(cameraNumber);
    selectedCamRef.current = cameraNumber;
    setConnectionState('connecting');

    // Try to attach existing published track immediately
    const room = roomRef.current;
    if (!room) return;
    const participant = room.remoteParticipants.get(`cam-${cameraNumber}`);
    if (participant) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.track && pub.kind === Track.Kind.Video) {
          attachTrack(pub.track as RemoteVideoTrack);
          return;
        }
      }
    }
    // No track yet — stay in 'connecting' state, TrackSubscribed will fire when camera publishes
  };

  const streamingCameras = cameras.filter((c) => c.isStreaming);

  return (
    <div className="fullscreen-page">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: colors.surface }}
      />

      {connectionState !== 'connected' && (
        <div style={s.placeholder}>
          {connectionState === 'connecting' ? (
            <>
              <div className="spinner" />
              <p style={s.placeholderText}>Connecting...</p>
            </>
          ) : streamingCameras.length > 0 ? (
            <>
              <p style={s.placeholderTitle}>Select a camera below</p>
              <p style={s.placeholderSub}>{streamingCameras.length} camera{streamingCameras.length !== 1 ? 's' : ''} streaming</p>
            </>
          ) : (
            <>
              <p style={s.placeholderTitle}>{isLive ? 'Waiting for streams...' : 'Match not live yet'}</p>
              <p style={s.placeholderSub}>{cameras.length} camera{cameras.length !== 1 ? 's' : ''} connected</p>
            </>
          )}
        </div>
      )}

      {/* Top overlay */}
      <div style={s.topOverlay}>
        <div style={s.topBar}>
          <button onClick={() => navigate(-1)} style={s.backArrow}>{'<'}</button>
          <div style={{ flex: 1 }}>
            <p style={s.matchLabel}>{matchTitle}</p>
            <p style={s.teamsLabel}>{teamA} vs {teamB}</p>
          </div>
          {isLive && (
            <span style={s.liveBadge}>
              <span style={s.liveDot} />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Bottom panel */}
      <div style={s.bottomPanel}>
        {streamingCameras.length > 0 && (
          <div style={s.cameraSelector}>
            <p style={s.selectorTitle}>Camera Angles</p>
            <div style={s.cameraList}>
              {streamingCameras.map((cam) => (
                <button
                  key={cam.number}
                  onClick={() => connectToCamera(cam.number)}
                  style={{ ...s.chip, ...(selectedCamera === cam.number ? s.chipActive : {}) }}
                >
                  <span style={{ ...s.chipCam, ...(selectedCamera === cam.number ? s.chipCamActive : {}) }}>
                    CAM {cam.number}
                  </span>
                  <span style={{ ...s.chipRole, ...(selectedCamera === cam.number ? s.chipRoleActive : {}) }}>
                    {cam.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={s.statsRow}>
          {[
            { value: cameras.length, label: 'Cameras' },
            { value: streamingCameras.length, label: 'Streaming' },
            { value: connectionState === 'connected' ? 'HD' : '--', label: 'Quality' },
          ].map((stat, i, arr) => (
            <div key={stat.label} style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
              <div style={s.statItem}>
                <p style={s.statValue}>{stat.value}</p>
                <p style={s.statLabel}>{stat.label}</p>
              </div>
              {i < arr.length - 1 && <div style={s.statDivider} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  placeholder: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, background: colors.surface,
  },
  placeholderTitle: { fontSize: fontSize.xl, color: colors.textMuted, fontWeight: 600 },
  placeholderText: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm },
  placeholderSub: { fontSize: fontSize.xs, color: colors.textMuted },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 'env(safe-area-inset-top, 16px)' },
  topBar: { display: 'flex', alignItems: 'center', padding: `${spacing.sm}px ${spacing.md}px`, gap: spacing.sm },
  backArrow: { background: 'none', color: '#fff', fontSize: fontSize.xxl, cursor: 'pointer', fontWeight: 300, padding: `0 ${spacing.sm}px 0 0` },
  matchLabel: { fontSize: fontSize.md, fontWeight: 600, color: '#fff' },
  teamsLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  liveBadge: {
    display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,77,77,0.9)',
    borderRadius: 6, padding: '3px 8px', fontSize: fontSize.xs, fontWeight: 800, color: '#fff', letterSpacing: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, background: '#fff', display: 'inline-block' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'rgba(13,13,13,0.95)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: `${spacing.lg}px ${spacing.lg}px`, paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 12px)',
  },
  cameraSelector: { marginBottom: spacing.md },
  selectorTitle: { fontSize: fontSize.sm, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.sm },
  cameraList: { display: 'flex', gap: spacing.sm, overflowX: 'auto', paddingBottom: 4 },
  chip: {
    background: colors.surface, borderRadius: 12, padding: `${spacing.sm}px ${spacing.md}px`,
    border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  chipActive: { background: colors.primary, borderColor: colors.primary },
  chipCam: { fontSize: fontSize.sm, fontWeight: 700, color: colors.textPrimary },
  chipCamActive: { color: colors.background },
  chipRole: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  chipRoleActive: { color: 'rgba(0,0,0,0.6)' },
  statsRow: { display: 'flex', alignItems: 'center' },
  statItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statValue: { fontSize: fontSize.lg, fontWeight: 700, color: colors.primary },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 30, background: colors.border, flexShrink: 0 },
};
