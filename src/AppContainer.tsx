import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { UserPanel } from './components/UserPanel';
import AppAdmin from './App';

const AppContent: React.FC = () => {
  const { isLoggedIn, isAdmin, isUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Carregando Roda Gigante AI...
          </p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  if (isAdmin) {
    return <AppAdmin />;
  }

  if (isUser) {
    return <UserPanel />;
  }

  return <LoginScreen />;
};

export default function AppContainer() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
