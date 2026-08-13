import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'USUARIO';
  status: 'ativo' | 'inativo';
  ultimoAcesso?: string;
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isUser: boolean;
  loading: boolean;
  login: (usuario: string, senha: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  logout: () => void;
  setUserSession: (user: UserSession) => void;
}

const AUTH_STORAGE_KEY = 'rodagigante_auth_session_v1';

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  isAdmin: false,
  isUser: false,
  loading: true,
  login: async () => ({ sucesso: false }),
  logout: () => {},
  setUserSession: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaurar sessão ao inicializar
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.user && parsed.token) {
            // Validar com o backend
            const res = await fetch('/api/auth/me', {
              headers: { Authorization: parsed.token },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.sucesso && data.user) {
                setUser(data.user);
                setToken(parsed.token);
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.error('[AuthContext] Erro ao restaurar sessão:', e);
      }
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(null);
      setToken(null);
      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (usuario: string, senha: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });

      const data = await res.json();

      if (data.sucesso && data.user && data.token) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ user: data.user, token: data.token })
        );
        return { sucesso: true };
      } else {
        return {
          sucesso: false,
          mensagem: data.mensagem || 'Falha ao autenticar. Verifique seus dados.',
        };
      }
    } catch (err: any) {
      console.error('[AuthContext] Erro de rede ao realizar login:', err);
      return {
        sucesso: false,
        mensagem: 'Erro ao conectar ao servidor de autenticação.',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const setUserSession = (updatedUser: UserSession) => {
    setUser(updatedUser);
    if (token) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: updatedUser, token })
      );
    }
  };

  const isLoggedIn = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isUser = user?.role === 'USUARIO';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoggedIn,
        isAdmin,
        isUser,
        loading,
        login,
        logout,
        setUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
