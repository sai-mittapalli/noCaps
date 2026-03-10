import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Room,
  createLocalVideoTrack,
  createLocalAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  Track,
  VideoPresets,
} from 'livekit-client';
import { colors, spacing, fontSize } from '../theme';
import { joinMatchAsCamera, toggleStream, onMatchUpdated, getLiveKitToken, type MatchDTO } from '../api';
import { getSportConfig, type OverlayShape } from '../data/sportCameraRoles';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string;

interface LocationState {
  matchTitle: string;
  matchCode: string;
  cameraRole: string;
  cameraNumber: number;
  sport: string;
}

type FacingMode = 'environment' | 'user';

function GuideOverlay({ shapes }: { shapes: OverlayShape[] }) {
  return (
    <svg
      viewBox="0 0 100 177"
      preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {shapes.map((shape, i) => {
        const p = {
          fill: 'none' as const,
          stroke: 'rgba(255,220,50,0.8)',
          strokeWidth: 1.5,
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

export default function CameraPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matchTitle, matchCode, cameraRole, cameraNumber, sport } = location.state as LocationState;

  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);

  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<FacingMode>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectedCameras, setConnectedCameras] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getSportConfig(sport);
  const role = config.roles.find(r => r.number === cameraNumber) ?? null;
  const hasGuide = role !== null && role.overlay.length > 0;

  // Start camera preview + connect to LiveKit room
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!LIVEKIT_URL || LIVEKIT_URL.includes('your-project')) {
        setError('LiveKit URL not configured. Set VITE_LIVEKIT_URL in web/.env');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera requires a secure connection (HTTPS). Make sure you opened the app via https://');
        return;
      }

      try {
        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack({ facingMode: 'environment', resolution: VideoPresets.h720.resolution }),
          createLocalAudioTrack(),
        ]);

        if (!mounted) { videoTrack.stop(); audioTrack.stop(); return; }

        videoTrackRef.current = videoTrack;
        audioTrackRef.current = audioTrack;

        if (videoRef.current) videoTrack.attach(videoRef.current);
        setReady(true);

        const token = await getLiveKitToken(matchCode, `cam-${cameraNumber}`, 'camera');
        if (!mounted) return;

        const room = new Room({ adaptiveStream: false, dynacast: false });
        roomRef.current = room;
        await room.connect(LIVEKIT_URL, token, { autoSubscribe: false });
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to start camera');
      }
    }

    init();

    return () => {
      mounted = false;
      videoTrackRef.current?.stop();
      audioTrackRef.current?.stop();
      roomRef.current?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join match via Socket.IO (for host dashboard awareness)
  useEffect(() => {
    joinMatchAsCamera(matchCode, cameraNumber, cameraRole);
    return onMatchUpdated((match: MatchDTO) => {
      setConnectedCameras(match.cameras.length);
    });
  }, [matchCode, cameraNumber, cameraRole]);

  const handleStreamToggle = async () => {
    const room = roomRef.current;
    const videoTrack = videoTrackRef.current;
    const audioTrack = audioTrackRef.current;
    if (!room || !videoTrack || !audioTrack) return;

    const next = !isStreaming;

    if (next) {
      await room.localParticipant.publishTrack(videoTrack, {
        simulcast: false,
        videoEncoding: { maxBitrate: 2_000_000, maxFramerate: 30 },
      });
      await room.localParticipant.publishTrack(audioTrack);
    } else {
      const vidPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const audPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (vidPub?.track) await room.localParticipant.unpublishTrack(vidPub.track as LocalVideoTrack);
      if (audPub?.track) await room.localParticipant.unpublishTrack(audPub.track as LocalAudioTrack);
    }

    setIsStreaming(next);
    toggleStream(matchCode, cameraNumber, next);
  };

  const handleFlip = async () => {
    const room = roomRef.current;
    const oldTrack = videoTrackRef.current;
    if (!oldTrack) return;

    const newFacing: FacingMode = facing === 'environment' ? 'user' : 'environment';
    try {
      const newTrack = await createLocalVideoTrack({
        facingMode: newFacing,
        resolution: VideoPresets.h720.resolution,
      });

      if (isStreaming && room) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.track) await room.localParticipant.unpublishTrack(pub.track as LocalVideoTrack);
        await room.localParticipant.publishTrack(newTrack, {
          simulcast: false,
          videoEncoding: { maxBitrate: 2_000_000, maxFramerate: 30 },
        });
      }

      oldTrack.detach();
      oldTrack.stop();
      videoTrackRef.current = newTrack;
      if (videoRef.current) newTrack.attach(videoRef.current);
      setFacing(newFacing);
    } catch (err) {
      console.error('Failed to flip camera:', err);
    }
  };

  if (error) {
    return (
      <div style={s.errorPage}>
        <p style={s.errorTitle}>Camera Error</p>
        <p style={s.errorText}>{error}</p>
        <button onClick={() => navigate(-1)} style={s.backBtn}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="fullscreen-page">
      {/* Camera preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          transform: facing === 'user' ? 'scaleX(-1)' : 'none',
          background: colors.surface,
        }}
      />

      {/* Guide overlay */}
      {showGuide && hasGuide && role && <GuideOverlay shapes={role.overlay} />}

      {!ready && (
        <div style={s.loadingOverlay}>
          <div className="spinner" />
          <p style={{ color: colors.textMuted, marginTop: spacing.md, fontSize: fontSize.sm }}>Starting camera...</p>
        </div>
      )}

      {/* Top overlay */}
      <div style={s.topOverlay}>
        <div style={s.topBar}>
          <button onClick={() => navigate(-1)} style={s.backArrow}>{'<'}</button>
          <div style={{ flex: 1 }}>
            <p style={s.matchLabel}>{matchTitle}</p>
            <p style={s.matchCode}>{matchCode}</p>
          </div>
          <span style={s.camBadge}>CAM {cameraNumber}</span>
        </div>
        {isStreaming && (
          <div style={s.livePill}>
            <span style={s.liveDot} />
            <span style={s.liveText}>LIVE</span>
          </div>
        )}
      </div>

      {/* Bottom overlay */}
      <div style={s.bottomOverlay}>
        <div style={s.roleBanner}>
          <span style={s.roleText}>{cameraRole.toUpperCase()}</span>
        </div>

        {/* Positioning tip shown when guide is active */}
        {showGuide && role && (
          <div style={s.tipCard}>
            <p style={s.tipText}>{role.tip}</p>
          </div>
        )}

        <div style={s.controls}>
          <button onClick={handleFlip} style={s.controlBtn}>
            <div style={s.controlCircle}><span style={s.controlIcon}>↻</span></div>
            <span style={s.controlLabel}>Flip</span>
          </button>

          <button onClick={handleStreamToggle} disabled={!ready} style={isStreaming ? s.streamBtnActive : s.streamBtn}>
            <div style={isStreaming ? s.streamInnerActive : s.streamInner} />
          </button>

          {hasGuide ? (
            <button onClick={() => setShowGuide(!showGuide)} style={s.controlBtn}>
              <div style={{ ...s.controlCircle, ...(showGuide ? s.controlCircleActive : {}) }}>
                <span style={s.controlIcon}>⊕</span>
              </div>
              <span style={s.controlLabel}>Guide</span>
            </button>
          ) : (
            <div style={{ width: 60 }} />
          )}
        </div>

        <div style={s.statusBar}>
          <span style={s.statusText}>{isStreaming ? 'Streaming live...' : 'Ready to stream'}</span>
          <span style={s.statusText}>{connectedCameras} camera{connectedCameras !== 1 ? 's' : ''} connected</span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  errorPage: {
    minHeight: '100dvh', background: colors.background, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md,
  },
  errorTitle: { fontSize: fontSize.xl, fontWeight: 700, color: colors.textPrimary },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
  backBtn: {
    marginTop: spacing.xl, padding: `${spacing.md}px ${spacing.xl}px`,
    background: colors.surface, borderRadius: 12, color: colors.textMuted, fontSize: fontSize.md, cursor: 'pointer',
  },
  loadingOverlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', background: colors.surface,
  },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 'env(safe-area-inset-top, 16px)' },
  topBar: { display: 'flex', alignItems: 'center', padding: `${spacing.sm}px ${spacing.md}px`, gap: spacing.sm },
  backArrow: { background: 'none', color: '#fff', fontSize: fontSize.xxl, cursor: 'pointer', padding: `0 ${spacing.sm}px 0 0`, fontWeight: 300 },
  matchLabel: { fontSize: fontSize.md, fontWeight: 600, color: '#fff' },
  matchCode: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  camBadge: { background: colors.primary, borderRadius: 8, padding: '3px 10px', fontSize: fontSize.xs, fontWeight: 700, color: colors.background },
  livePill: {
    display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'center',
    background: 'rgba(255,77,77,0.9)', borderRadius: 6, padding: '3px 10px',
    margin: `${spacing.sm}px auto 0`, width: 'fit-content',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, background: '#fff', display: 'inline-block' },
  liveText: { fontSize: fontSize.xs, fontWeight: 800, color: '#fff', letterSpacing: 1 },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 'env(safe-area-inset-bottom, 8px)' },
  roleBanner: {
    alignSelf: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 8,
    padding: '4px 14px', marginBottom: spacing.sm, display: 'flex', justifyContent: 'center',
  },
  roleText: { fontSize: fontSize.sm, fontWeight: 600, color: colors.primary, letterSpacing: 1 },
  tipCard: {
    background: 'rgba(0,0,0,0.75)', borderRadius: 10, padding: `${spacing.sm}px ${spacing.md}px`,
    marginBottom: spacing.sm, marginLeft: spacing.md, marginRight: spacing.md,
  },
  tipText: { fontSize: fontSize.xs, color: 'rgba(255,220,50,0.9)', lineHeight: 1.5, textAlign: 'center' },
  controls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: spacing.xl, padding: `${spacing.md}px 0` },
  controlBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', cursor: 'pointer', gap: 4 },
  controlCircle: {
    width: 44, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  controlCircleActive: { background: 'rgba(255,220,50,0.25)', border: '1px solid rgba(255,220,50,0.6)' },
  controlIcon: { fontSize: fontSize.xl, color: '#fff' },
  controlLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)' },
  streamBtn: {
    width: 72, height: 72, borderRadius: 36, border: '4px solid #fff', background: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  },
  streamBtnActive: {
    width: 72, height: 72, borderRadius: 36, border: '4px solid #FF4D4D', background: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  },
  streamInner: { width: 56, height: 56, borderRadius: 28, background: '#FF4D4D' },
  streamInnerActive: { width: 28, height: 28, borderRadius: 6, background: '#FF4D4D' },
  statusBar: { display: 'flex', justifyContent: 'space-between', padding: `0 ${spacing.lg}px ${spacing.sm}px` },
  statusText: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)' },
};
