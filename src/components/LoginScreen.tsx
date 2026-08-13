import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, User, Lock, LogIn, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha.trim()) {
      setErrorMsg('Por favor, informe o e-mail/usuário e a senha.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const res = await login(usuario, senha);
    setLoading(false);

    if (!res.sucesso) {
      setErrorMsg(res.mensagem || 'Credenciais inválidas. Tente novamente.');
    }
  };

  const fillDemoAccount = (user: string, pass: string) => {
    setUsuario(user);
    setSenha(pass);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans text-slate-100">
      
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md relative z-10">
        
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 text-white text-3xl font-bold ring-4 ring-cyan-500/20 mb-4">
            🎣
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Roda Gigante AI
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Acesse o sistema com suas credenciais autorizadas
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Usuário ou E-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ex: admin ou usuario@rodagigante.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Autenticando...
              </span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Account Selector */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Contas de Teste Rápido
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('admin', 'admin123')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-xs font-bold text-cyan-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Admin Demo</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('usuario', 'user123')}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Usuário Demo</span>
            </button>
          </div>
        </div>

      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-slate-500 font-medium">
        Farm Fishing AI &copy; {new Date().getFullYear()} — Plataforma da Roda Gigante
      </p>
    </div>
  );
};
