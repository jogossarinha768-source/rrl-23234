import React, { useState, useEffect, useRef } from 'react';
import { UserViewZoneConfig, UserViewZoneService } from '../services/userViewZoneService';
import { Eye, Save, RotateCcw, Sliders, CheckCircle2, Shield, X, Maximize2, Move, Crop } from 'lucide-react';

interface UserViewZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFrameUrl?: string | null;
}

export const UserViewZoneModal: React.FC<UserViewZoneModalProps> = ({
  isOpen,
  onClose,
  currentFrameUrl,
}) => {
  const [config, setConfig] = useState<UserViewZoneConfig>(() => UserViewZoneService.getUserViewZoneConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; startXPct: number; startYPct: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Buscar configuração oficial do backend ao abrir
  useEffect(() => {
    if (isOpen) {
      fetchConfigFromBackend();
    }
  }, [isOpen]);

  const fetchConfigFromBackend = async () => {
    try {
      const res = await fetch('/api/live/user-view-zone');
      if (res.ok) {
        const data = await res.json();
        if (data.sucesso && data.config) {
          setConfig(data.config);
          UserViewZoneService.setUserViewZoneConfig(data.config);
        }
      }
    } catch (err) {
      // Fallback para local
      setConfig(UserViewZoneService.getUserViewZoneConfig());
    }
  };

  // Renderizar a prévia recortada da visão do usuário
  useEffect(() => {
    if (!currentFrameUrl || !previewCanvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentFrameUrl;
    img.onload = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const crop = UserViewZoneService.calculateUserCrop(img.naturalWidth, img.naturalHeight, config);
      canvas.width = Math.max(10, crop.width);
      canvas.height = Math.max(10, crop.height);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  }, [currentFrameUrl, config]);

  if (!isOpen) return null;

  const handleSliderChange = (field: keyof UserViewZoneConfig, val: number) => {
    const updated = {
      ...config,
      enabled: true,
      [field]: val,
    };
    setConfig(updated);
  };

  const handlePreset = (xPct: number, yPct: number, wPct: number, hPct: number) => {
    const updated = {
      ...config,
      enabled: true,
      xPct,
      yPct,
      wPct,
      hPct,
    };
    setConfig(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Atualizar no backend
      const res = await fetch('/api/live/user-view-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sucesso && data.config) {
          setConfig(data.config);
          UserViewZoneService.setUserViewZoneConfig(data.config);
        }
      } else {
        UserViewZoneService.setUserViewZoneConfig(config);
      }

      setToastMessage('✅ Área dos Usuários (USER_VIEW_ZONE) salva com sucesso!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      UserViewZoneService.setUserViewZoneConfig(config);
      setToastMessage('✅ Área dos Usuários salva localmente.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultConfig = UserViewZoneService.resetUserViewZoneConfig();
    setConfig(defaultConfig);
    try {
      await fetch('/api/live/user-view-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultConfig),
      });
    } catch {
      // ignore
    }
    setToastMessage('Restaurado para a área padrão (80% centralizada).');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Suporte a arrasto intuitivo na tela
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startXPct: config.xPct,
      startYPct: config.yPct,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100 - config.wPct, dragStart.startXPct + deltaX));
    const newY = Math.max(0, Math.min(100 - config.hPct, dragStart.startYPct + deltaY));

    setConfig((prev) => ({
      ...prev,
      xPct: Number(newX.toFixed(1)),
      yPct: Number(newY.toFixed(1)),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header do Modal */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  CONFIGURAÇÃO DA VISUALIZAÇÃO DOS USUÁRIOS
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full uppercase">
                  USER_VIEW_ZONE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ajuste manualmente a área da Roda Gigante permitida para visualização dos usuários.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informação / Aviso de Isolamento da RESULT_ZONE */}
        <div className="bg-emerald-950/30 border-b border-emerald-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Independência Garantida:</strong> A USER_VIEW_ZONE controla apenas o que o usuário vê. A RESULT_ZONE (análise técnica de IA) permanece 100% intacta.
            </span>
          </div>
        </div>

        {/* Conteúdo Principal (Prévia + Controles) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Toast Notification */}
          {toastMessage && (
            <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 animate-fade-in font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Grid de Visualização Lado a Lado (Roda Completa vs O Que o Usuário Vê) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Lado Esquerdo: Roda Completa + Retângulo do Corte */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Maximize2 className="w-4 h-4" /> 1. Visão Completa da Roda (Administrador)
                </span>
                <span className="text-[10px] text-slate-400">Arraste para reposicionar</span>
              </div>

              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-video flex items-center justify-center select-none cursor-move group shadow-inner"
              >
                {currentFrameUrl ? (
                  <img
                    src={currentFrameUrl}
                    alt="Roda Completa"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500 text-xs space-y-2">
                    <Crop className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                    <p>Aguardando frame de vídeo ou câmera ativa...</p>
                    <p className="text-[10px] text-slate-600">Ligue a câmera ou transmissão para prévia ao vivo.</p>
                  </div>
                )}

                {/* Overlay da USER_VIEW_ZONE */}
                <div
                  style={{
                    left: `${config.xPct}%`,
                    top: `${config.yPct}%`,
                    width: `${config.wPct}%`,
                    height: `${config.hPct}%`,
                  }}
                  className="absolute border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded-lg transition-none flex flex-col justify-between p-1.5 pointer-events-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow uppercase tracking-wider flex items-center gap-1">
                      <Eye className="w-3 h-3" /> USER_VIEW_ZONE
                    </span>
                    <span className="text-[9px] font-mono text-emerald-300 font-bold bg-slate-950/80 px-1 py-0.5 rounded border border-emerald-500/30">
                      {config.wPct.toFixed(0)}% × {config.hPct.toFixed(0)}%
                    </span>
                  </div>

                  <div className="text-center text-[10px] font-bold text-emerald-200 bg-slate-950/80 rounded py-0.5 px-2 mx-auto border border-emerald-400/30">
                    ÁREA VISÍVEL PARA USUÁRIOS
                  </div>
                </div>
              </div>
            </div>

            {/* Lado Direito: O Que o Usuário Enxerga */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Eye className="w-4 h-4" /> 2. O que os Usuários Enxergam
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Recorte Final</span>
              </div>

              <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl overflow-hidden aspect-video flex items-center justify-center p-2 shadow-inner relative">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-slate-800"
                />

                {!currentFrameUrl && (
                  <div className="text-center p-6 text-slate-500 text-xs">
                    <Eye className="w-8 h-8 mx-auto text-emerald-500/40 mb-2" />
                    <p>Prévia do resultado recortado para o usuário</p>
                  </div>
                )}

                <div className="absolute bottom-2 right-2 bg-slate-900/90 border border-emerald-500/40 px-2.5 py-1 rounded-xl text-[10px] text-emerald-300 font-bold flex items-center gap-1.5 shadow">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  VISÃO LIMITADA
                </div>
              </div>
            </div>

          </div>

          {/* Presets Rápidos */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Atalhos de Ajuste Rápido:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePreset(10, 10, 80, 80)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                🎯 Padrao Centralizado (80%)
              </button>
              <button
                onClick={() => handlePreset(20, 20, 60, 60)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                🔍 Foco Fechado (60%)
              </button>
              <button
                onClick={() => handlePreset(0, 0, 100, 100)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                🎡 Roda Completa (100%)
              </button>
            </div>
          </div>

          {/* Sliders de Ajuste Numérico Fino */}
          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Ajuste Fino de Posição e Dimensão
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                X: {config.xPct}% | Y: {config.yPct}% | W: {config.wPct}% | H: {config.hPct}%
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              
              {/* Slider X */}
              <div className="space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span>Posição X (%):</span>
                  <strong className="text-emerald-400 font-mono">{config.xPct.toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="0.5"
                  value={config.xPct}
                  onChange={(e) => handleSliderChange('xPct', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
              </div>

              {/* Slider Y */}
              <div className="space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span>Posição Y (%):</span>
                  <strong className="text-emerald-400 font-mono">{config.yPct.toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="0.5"
                  value={config.yPct}
                  onChange={(e) => handleSliderChange('yPct', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
              </div>

              {/* Slider W */}
              <div className="space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span>Largura W (%):</span>
                  <strong className="text-amber-400 font-mono">{config.wPct.toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max={100 - config.xPct}
                  step="0.5"
                  value={config.wPct}
                  onChange={(e) => handleSliderChange('wPct', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
              </div>

              {/* Slider H */}
              <div className="space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <div className="flex justify-between text-slate-300 font-semibold">
                  <span>Altura H (%):</span>
                  <strong className="text-amber-400 font-mono">{config.hPct.toFixed(1)}%</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max={100 - config.yPct}
                  step="0.5"
                  value={config.hPct}
                  onChange={(e) => handleSliderChange('hPct', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded cursor-pointer"
                />
              </div>

            </div>
          </div>

        </div>

        {/* Footer do Modal com Ações */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Padrão
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'SALVAR ÁREA DOS USUÁRIOS'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
