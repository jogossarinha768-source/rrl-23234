import React, { useState, useEffect } from 'react';
import { RoundEntry, WheelItem } from '../types';
import { WHEEL_ITEMS, INITIAL_SAMPLE_HISTORY } from '../data/items';
import { useAuth } from '../context/AuthContext';
import { VisualHistoryBar } from './VisualHistoryBar';
import { RecentTenPanel } from './RecentTenPanel';
import { PredictionPanel } from './PredictionPanel';
import { WheelAnalysisEnginePanel } from './WheelAnalysisEnginePanel';
import { AnaliseEstatisticaPanel } from './AnaliseEstatisticaPanel';
import { LiveStatusIndicator } from './LiveStatusIndicator';
import { UserWheelViewSection } from './UserWheelViewSection';
import { LogOut, User, Shield, Sparkles, RefreshCw, BarChart2 } from 'lucide-react';

const LOCAL_STORAGE_KEY_USER = 'farm_fishing_ai_history_user_v1';

export const UserPanel: React.FC = () => {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<RoundEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('[UserPanel] Erro ao carregar histórico local:', e);
    }
    return INITIAL_SAMPLE_HISTORY.map((item, index) => ({
      id: `sample_${index}_${Date.now()}`,
      item,
      timestamp: Date.now() - (INITIAL_SAMPLE_HISTORY.length - index) * 60000,
      source: 'sample' as const,
    }));
  });

  const [loading, setLoading] = useState(false);

  // Sincronização em tempo real com a fonte oficial (/api/dashboard)
  useEffect(() => {
    const fetchLatestDashboardResults = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          if (data.sucesso && Array.isArray(data.ultimosResultados)) {
            if (data.ultimosResultados.length === 0) {
              setHistory([]);
              localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify([]));
            } else {
              const formatted: RoundEntry[] = [...data.ultimosResultados]
                .reverse()
                .map((row: any, idx: number) => ({
                  id: `db_${row.rodada || idx}_${new Date(row.criadoEm || Date.now()).getTime()}_${row.resultado}`,
                  item: row.resultado as WheelItem,
                  timestamp: new Date(row.criadoEm || Date.now()).getTime(),
                  source: 'ai_vision' as const,
                }));

              setHistory(formatted);
              localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(formatted));
            }
          }
        }
      } catch (err) {
        // Silencioso para o painel do usuário
      }
    };

    fetchLatestDashboardResults();
    const interval = setInterval(fetchLatestDashboardResults, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        if (data.sucesso && Array.isArray(data.ultimosResultados)) {
          const formatted: RoundEntry[] = [...data.ultimosResultados]
            .reverse()
            .map((row: any, idx: number) => ({
              id: `db_${row.rodada || idx}_${new Date(row.criadoEm || Date.now()).getTime()}_${row.resultado}`,
              item: row.resultado as WheelItem,
              timestamp: new Date(row.criadoEm || Date.now()).getTime(),
              source: 'ai_vision' as const,
            }));
          setHistory(formatted);
          localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(formatted));
        }
      }
    } catch (e) {
      console.error('Erro ao atualizar painel do usuário:', e);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const lastItemData = lastEntry ? WHEEL_ITEMS[lastEntry.item] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 pb-12">
      
      {/* Header do Usuário */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold text-xl ring-2 ring-cyan-400/30 shrink-0">
              🎣
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                  Roda Gigante AI
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-400" /> PAINEL DO USUÁRIO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Acompanhamento e Estatísticas em Tempo Real
              </p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            <LiveStatusIndicator />

            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition-all cursor-pointer"
              title="Atualizar Resultados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-bold text-xs">
                {user?.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white leading-tight">{user?.nome || 'Usuário'}</div>
                <div className="text-[10px] text-slate-400 leading-tight">{user?.email || 'Acesso Limitado'}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-3 py-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-400" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Workspace for Users */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Banner de Última Rodada / Status Atual */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-3xl shadow-inner shrink-0">
              {lastItemData?.emoji || '🎡'}
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                Último Resultado Confirmado
              </div>
              <div className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>{lastItemData?.label || 'Aguardando rodada...'}</span>
                {lastItemData && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Rodada #{history.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Total de Rodadas Sincronizadas
              </span>
              <span className="text-lg font-black text-cyan-400">{history.length}</span>
            </div>
          </div>
        </section>

        {/* Transmissão em Tempo Real da Roda Gigante (Limitada à USER_VIEW_ZONE) */}
        <UserWheelViewSection />

        {/* Recomendações e Probabilidades Calculadas */}
        <PredictionPanel history={history} />

        {/* Histórico Visual Cronológico */}
        <VisualHistoryBar
          history={history}
          onRemoveEntry={() => {}}
          onUndoLast={() => {}}
        />

        {/* Análise de Padrões e Ciclos da Roda */}
        <WheelAnalysisEnginePanel history={history.map((h) => h.item)} />

        {/* Estatísticas Gerais */}
        <AnaliseEstatisticaPanel />

        {/* Últimos 10 Resultados */}
        <RecentTenPanel history={history} />

      </main>

      {/* Footer Clean */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-400">
            Farm Fishing AI — Roda Gigante (Painel de Acompanhamento)
          </p>
          <p className="mt-1">
            Os resultados e probabilidades exibidos são atualizados em tempo real a partir da análise estatística oficial do sistema.
          </p>
        </div>
      </footer>

    </div>
  );
};
