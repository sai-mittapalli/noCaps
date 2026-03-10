import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setAuthToken, disconnectSocket } from './api';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import CreateMatchPage from './pages/CreateMatchPage';
import JoinMatchPage from './pages/JoinMatchPage';
import CameraRolePage from './pages/CameraRolePage';
import CameraPage from './pages/CameraPage';
import MatchListPage from './pages/MatchListPage';
import ViewerPage from './pages/ViewerPage';
import HostDashboardPage from './pages/HostDashboardPage';
import MatchManagePage from './pages/MatchManagePage';

import { colors } from './theme';

function Spinner() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.background }}>
      <div className="spinner" />
    </div>
  );
}

/** Syncs the API auth token whenever auth state changes */
function TokenSync() {
  const { token } = useAuth();
  useEffect(() => { setAuthToken(token); }, [token]);
  return null;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;

  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to={user ? '/home' : '/login'} replace />} />

      {/* Auth pages — redirect away if already logged in */}
      <Route path="/login" element={user ? <Navigate to="/home" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/home" replace /> : <SignupPage />} />

      {/* Protected main pages */}
      <Route path="/home" element={user ? <HomePage /> : <Navigate to="/login" replace />} />
      <Route path="/matches" element={user ? <MatchListPage /> : <Navigate to="/login" replace />} />
      <Route path="/viewer" element={user ? <ViewerPage /> : <Navigate to="/login" replace />} />

      {/* Camera flow — public, authenticated by match code instead of account */}
      <Route path="/join" element={<JoinMatchPage />} />
      <Route path="/camera-role" element={<CameraRolePage />} />
      <Route path="/camera" element={<CameraPage />} />

      {/* Host-only pages */}
      <Route
        path="/create"
        element={user?.role === 'host' ? <CreateMatchPage /> : <Navigate to="/home" replace />}
      />
      <Route
        path="/dashboard"
        element={user?.role === 'host' ? <HostDashboardPage /> : <Navigate to="/home" replace />}
      />
      <Route
        path="/dashboard/:code"
        element={user?.role === 'host' ? <MatchManagePage /> : <Navigate to="/home" replace />}
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  // Clean up socket on tab close
  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <TokenSync />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
