// WebRTC helpers
const WebRTCHelper = (() => {
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  function createPC() {
    return new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  async function getLocalStream(constraints = {}) {
    return navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, frameRate: 30, ...constraints.video },
      audio: constraints.audio !== false,
    });
  }

  // Avatar color from team name
  function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `av-${Math.abs(hash) % 8}`;
  }

  function initials(name) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  return { createPC, getLocalStream, avatarColor, initials };
})();
