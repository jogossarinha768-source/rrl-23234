import React, { useState, useEffect, useRef } from 'react';
import { UserViewZoneConfig, UserViewZoneService } from '../services/userViewZoneService';
import { Eye, ShieldCheck, RefreshCw, Radio, Lock } from 'lucide-react';

export const UserWheelViewSection: React.FC = () => {
  const [userZoneConfig, setUserZoneConfig] = useState<UserViewZoneConfig>(() =>
    UserViewZoneService.getUserViewZoneConfig()
  );
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Sincronização periódica da USER_VIEW_ZONE com o Servidor (Regra de Segurança)
  useEffect(() => {
    const syncUserZoneConfig = async () => {
      try {
        const res = await fetch('/api/live/user-view-zone');
        if (res.ok) {
          const data = await res.json();
          if (data.sucesso && data.config) {
            setUserZoneConfig(data.config);
            UserViewZoneService.setUserViewZoneConfig(data.config);
          }
        }
      } catch (err) {
        // Silencioso em caso de falha de rede temporária
      }
    };

    syncUserZoneConfig();
    const interval = setInterval(syncUserZoneConfig, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Busca periódica do último frame transmitido pelo servidor
  useEffect(() => {
    const fetchLatestFrame = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.sucesso && data.ultimoFrameDataUrl) {
            setFrameUrl(data.ultimoFrameDataUrl);
            setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
            setIsConnected(true);
          }
        }
      } catch (err) {
        setIsConnected(false);
      }
    };

    fetchLatestFrame();
    const frameInterval = setInterval(fetchLatestFrame, 2000);
    return () => clearInterval(frameInterval);
  }, []);

  // 3. Renderização do corte restrito no Canvas (Garantia de Segurança do lado do Cliente)
  useEffect(() => {
    if (!frameUrl || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = frameUrl;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const crop = UserViewZoneService.calculateUserCrop(img.naturalWidth, img.naturalHeight, userZoneConfig);

      canvas.width = Math.max(10, crop.width);
      canvas.height = Math.max(10, crop.height);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Desenha ESTRITAMENTE a região permitida (USER_VIEW_ZONE). Regiões externas não existem no DOM do usuário.
        ctx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }
    };
  }, [frameUrl, userZoneConfig]);

  return (
    <section className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header do Bloco da Roda */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
                TRANSMISSÃO DA RODA GIGANTE AO VIVO
              </h2>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> ÁREA AUTORIZADA
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização recortada configurada e transmitida pelo Administrador.
            </p>
          </div>
        </div>

        {/* Status da Transmissão */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
          }`}>
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            {isConnected ? 'AO VIVO' : 'SINCRONIZANDO'}
          </span>
          {lastUpdate && (
            <span className="text-[10px] text-slate-500">Atualizado: {lastUpdate}</span>
          )}
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO CANVAS (Recorte da USER_VIEW_ZONE) */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center p-2 shadow-inner group">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-800 transition-all duration-300"
        />

        {!frameUrl && (
          <div className="text-center p-8 space-y-3 text-slate-500">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-slate-300">
              Aguardando transmissão de imagem do servidor...
            </p>
            <p className="text-[10px] text-slate-500">
              A transmissão será exibida assim que a câmera do Administrador estiver ativa.
            </p>
          </div>
        )}

        {/* Badge Flutuante de Segurança */}
        <div className="absolute top-3 right-3 bg-slate-950/90 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold text-emerald-300 flex items-center gap-1.5 shadow backdrop-blur-sm">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>VISÃO PROTEGIDA PELO SERVIDOR</span>
        </div>
      </div>

      {/* Rodapé Informativo */}
      <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono pt-1">
        <span>Dimensão do Corte: {userZoneConfig.wPct.toFixed(0)}% × {userZoneConfig.hPct.toFixed(0)}%</span>
        <span>Posição Relativa: X:{userZoneConfig.xPct.toFixed(0)}%, Y:{userZoneConfig.yPct.toFixed(0)}%</span>
      </div>
    </section>
  );
};
