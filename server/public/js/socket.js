// Socket.IO singleton
const SocketClient = (() => {
  let _socket = null;

  function get() {
    if (!_socket) {
      _socket = io({ transports: ['websocket'] });
      _socket.on('disconnect', () => console.log('[socket] disconnected'));
    }
    return _socket;
  }

  function disconnect() {
    if (_socket) { _socket.disconnect(); _socket = null; }
  }

  return { get, disconnect };
})();
