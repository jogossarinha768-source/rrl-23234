import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  RefreshCw,
  AlertTriangle,
  Play,
  Square,
  ShieldCheck,
  Zap,
  X,
  LogOut,
  SwitchCamera,
  CheckCircle2,
  List,
  Database,
  Layers,
  Sparkles,
  Info,
  Cpu,
  Monitor,
  Smartphone,
  Radio,
  Clock,
} from 'lucide-react';
import { useLiveSession } from '../hooks/useLiveSession';
import { LiveResultPayload } from '../types/live';
import { WHEEL_ITEMS } from '../data/items';
import { WheelItem } from '../types';
import { LiveDevMetricsPanel } from './LiveDevMetricsPanel';
import { VideoSourceType } from '../services/videoSourceManager';
import { livePipelineService, PipelineState } from '../services/livePipelineService';

export const CONFIG_CAPTURA_PADRAO = {
  captureIntervalMs: 1000,
  jpegQuality: 0.85,
  maxWidth: 1920,
  maxHeight: 1080,
};

interface LiveCameraProps {
  isOpen?: boolean;
  onClose?: () => void;
  onResultDetected?: (result: LiveResultPayload) => void;
  fps?: number;
  captureSource?: VideoSourceType;
  captureIntervalMs?: number;
  jpegQuality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export const LiveCamera: React.FC<LiveCameraProps> = ({
  isOpen = true,
  onClose,
  onResultDetected,
  fps = 1,
  captureSource = 'SCREEN_CAPTURE',
}) => {
  const {
    status,
    executarTesteSimulado,
    lastResult,
    isOnline,
    isConnecting,
    isReconnecting,
  } = useLiveSession();

  const [pipelineState, setPipelineState] = useState<PipelineState>(() =>
    livePipelineService.getState()
  );

  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [showDevPanel, setShowDevPanel] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const logsContainerRef = useRef<HTMLDivElement | null>(null);

  // Inscreve para atualizações do pipeline em segundo plano
  useEffect(() => {
    const unsubscribe = livePipelineService.subscribe((newState) => {
      setPipelineState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Inscreve para receber resultados detectados
  useEffect(() => {
    if (onResultDetected) {
      const unsubscribe = livePipelineService.onResultDetected(onResultDetected);
      return () => unsubscribe();
    }
  }, [onResultDetected]);

  // Conecta o feed de vídeo à viewport do modal quando aberto
  useEffect(() => {
    if (isOpen && videoRef.current) {
      const stream = livePipelineService.getMediaStream();
      if (stream && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current
          .play()
          .catch((err) => console.warn('[LIVE CAMERA] Video preview play notice:', err));
      }
    }
  }, [isOpen, pipelineState.cameraActive]);

  // Rola logs para baixo automaticamente
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [pipelineState.logs]);

  // Efeito ao abrir interface e ouvinte de tecla ESC
  useEffect(() => {
    if (
      isOpen &&
      !pipelineState.cameraActive &&
      !pipelineState.cameraError &&
      !pipelineState.isRequestingPermission
    ) {
      if (pipelineState.videoSource === 'CAMERA') {
        livePipelineService.startVideoStream('CAMERA');
      } else {
        livePipelineService.addLog(
          'Selecione a janela do scrcpy para compartilhar a tela do celular.',
          'info'
        );
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    pipelineState.cameraActive,
    pipelineState.cameraError,
    pipelineState.isRequestingPermission,
    pipelineState.videoSource,
    onClose,
  ]);

  const {
    videoSource,
    cameraActive,
    cameraError,
    isTransmitting,
    facingMode,
    fpsConfig,
    fpsRealtime,
    logs,
    mediaStreamSettings,
    videoDimensions,
    canvasDimensions,
    lastFrameSendMetadata,
    frameFrozenStatus,
    lastCapturedFrameDataUrl,
    isRequestingPermission,
    totalCapturados,
    totalDescartadosBackpressure,
  } = pipelineState;

  const handleStartLive = async () => {
    await livePipelineService.handleStartLive();
  };

  const handleStopLive = async () => {
    await livePipelineService.handleStopLive();
  };

  const handleSelectSource = async (source: VideoSourceType) => {
    livePipelineService.setVideoSource(source);
    if (source === 'CAMERA') {
      await livePipelineService.startVideoStream('CAMERA');
    } else {
      livePipelineService.stopFrameTransmission();
      livePipelineService.stopVideoStream();
      livePipelineService.addLog(
        'Selecione a janela do scrcpy para compartilhar a tela do celular.',
        'info'
      );
    }
  };

  const toggleFacingMode = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    livePipelineService.setFacingMode(newMode);
    if (cameraActive && videoSource === 'CAMERA') {
      setTimeout(() => livePipelineService.startVideoStream('CAMERA'), 100);
    }
  };

  const handleTestSingleFrame = async () => {
    return await livePipelineService.handleTestSingleFrame();
  };

  const ultimoObjetoConfirmado = status.ultimoObjetoConfirmado;
  const confirmedConfig = ultimoObjetoConfirmado
    ? WHEEL_ITEMS[ultimoObjetoConfirmado as WheelItem]
    : null;

  const currentCandidate = status.candidatoAtual;
  const candidateConfig = currentCandidate
    ? WHEEL_ITEMS[currentCandidate as WheelItem]
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn">
      {/* Backdrop clicável fora do modal */}
      <div
        onClick={() => {
          onClose?.();
        }}
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
        title="Clique fora para fechar (Mantém a transmissão ativa em segundo plano)"
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col relative z-10 my-auto max-h-[90dvh] overflow-y-auto">
        {/* HEADER DA CÂMERA LIVE */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 sm:p-4 bg-slate-950/90 border-b border-slate-800 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shrink-0">
              <Camera className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-1.5">
                  Câmera Live & Visão da Roda
                </h3>
                {isOnline && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                    <Radio className="w-3 h-3" /> LIVE API ON
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Captura de tela/vídeo contínua com detecção Gemini AI em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDevPanel(!showDevPanel)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                showDevPanel
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
              }`}
              title="Painel de Diagnóstico do Desenvolvedor (PROMPT LIVE 006)"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dev Panel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                showLogs
                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                  : 'bg-slate-800/40 text-slate-500 border-slate-700/40 hover:text-slate-300'
              }`}
              title="Exibir/Ocultar Terminal de Logs"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logs</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition border border-slate-700/80 ml-1"
              title="Fechar janela (O processamento continua em segundo plano)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTAINER DO VÍDEO / PREVIEW DA CÂMERA */}
        <div className="p-3 sm:p-5 space-y-4">
          <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center group">
            {/* Elemento HTML Video da Viewport do Modal */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />

            {/* Canvas invisível para manipulação técnica de diagnóstico */}
            <canvas ref={null} className="hidden" />

            {/* BADGES DE STATUS SOBRE O VÍDEO */}
            {cameraActive && (
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 z-10">
                <span
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                    isTransmitting
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-950/50'
                      : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isTransmitting ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {isTransmitting ? 'Transmitindo ao Vivo' : 'Câmera Ativa (Pausada)'}
                </span>

                <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-full text-xs font-mono font-bold text-cyan-300">
                  {videoSource === 'SCREEN_CAPTURE' ? '📺 Compartilhamento' : '📷 Câmera'}
                </span>

                {fpsRealtime > 0 && (
                  <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-full text-xs font-mono font-bold text-slate-300">
                    {fpsRealtime} FPS
                  </span>
                )}
              </div>
            )}

            {/* BOTÃO ALTERAR CÂMERA FRONTAL/TRASEIRA */}
            {cameraActive && videoSource === 'CAMERA' && (
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-xl backdrop-blur-md border border-slate-700 transition shadow-lg opacity-80 group-hover:opacity-100 z-10"
                title={`Alternar Câmera (${facingMode === 'environment' ? 'Traseira' : 'Frontal'})`}
              >
                <SwitchCamera className="w-4 h-4 text-indigo-400" />
              </button>
            )}

            {/* OVERLAY DE ESTADO OFFLINE OU ERRO DE VÍDEO */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10">
                {cameraError ? (
                  <div className="max-w-md space-y-3">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl w-fit mx-auto border border-rose-500/30">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-rose-300 text-sm sm:text-base">
                      Erro na Fonte de Vídeo
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => livePipelineService.startVideoStream(videoSource)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-950/50 flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <div className="max-w-md space-y-3">
                    <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl w-fit mx-auto border border-indigo-500/30">
                      {videoSource === 'SCREEN_CAPTURE' ? (
                        <Monitor className="w-8 h-8" />
                      ) : (
                        <Camera className="w-8 h-8" />
                      )}
                    </div>
                    <h4 className="font-bold text-slate-200 text-sm sm:text-base">
                      {videoSource === 'SCREEN_CAPTURE'
                        ? 'Compartilhamento de Tela Necessário'
                        : 'Câmera Inativa'}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {videoSource === 'SCREEN_CAPTURE'
                        ? 'Clique no botão abaixo e selecione a janela do scrcpy (espelhamento do celular) para iniciar a leitura.'
                        : 'Ative a câmera para transmitir o feed de vídeo em tempo real.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => livePipelineService.startVideoStream(videoSource)}
                      disabled={isRequestingPermission}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-950/50 flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      {isRequestingPermission ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Aguardando Seleção de Tela...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          {videoSource === 'SCREEN_CAPTURE'
                            ? 'Conectar Janela do Celular'
                            : 'Ativar Câmera'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PAINEL DE ÚLTIMA CONFIRMAÇÃO & CANDIDATO ATUAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ÚLTIMO CONFIRMADO */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 text-xl shadow-inner"
                style={{
                  backgroundColor: confirmedConfig ? `${confirmedConfig.color}20` : '#1e293b',
                  borderColor: confirmedConfig ? confirmedConfig.color : '#334155',
                }}
              >
                {confirmedConfig ? confirmedConfig.emoji : '❓'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Último Confirmado
                </span>
                <span className="font-bold text-slate-100 text-sm truncate block">
                  {confirmedConfig ? confirmedConfig.label : 'Nenhum resultado'}
                </span>
                {status.confiancaUltimaConfirmacao > 0 && (
                  <span className="text-[11px] font-bold text-emerald-400">
                    {status.confiancaUltimaConfirmacao}% de confiança
                  </span>
                )}
              </div>
            </div>

            {/* CANDIDATO EM ANÁLISE */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 text-xl shadow-inner"
                style={{
                  backgroundColor: candidateConfig ? `${candidateConfig.color}20` : '#1e293b',
                  borderColor: candidateConfig ? candidateConfig.color : '#334155',
                }}
              >
                {candidateConfig ? candidateConfig.emoji : '🔍'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Candidato Atual (Estabilização)
                </span>
                <span className="font-bold text-slate-100 text-sm truncate block">
                  {candidateConfig ? candidateConfig.label : 'Aguardando rodada...'}
                </span>
                {status.confirmacoesConsecutivas > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`w-2 h-2 rounded-full ${
                            step <= status.confirmacoesConsecutivas
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-bold text-amber-400">
                      {status.confirmacoesConsecutivas}/3 confirmações
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAINEL DE DIAGNÓSTICO DEV PANEL */}
          {showDevPanel && (
            <LiveDevMetricsPanel
              status={status}
              captureFps={fpsConfig}
              isTransmitting={isTransmitting}
              videoSource={videoSource}
              cameraActive={cameraActive}
              totalCapturados={totalCapturados}
              totalEnviados={status.totalFramesEnviados}
              totalDescartadosBackpressure={totalDescartadosBackpressure}
              lastResult={lastResult}
              cameraError={cameraError}
              onRunSimulatedTest={executarTesteSimulado}
              mediaStreamSettings={mediaStreamSettings}
              videoDimensions={videoDimensions}
              canvasDimensions={canvasDimensions}
              lastFrameSendMetadata={lastFrameSendMetadata}
              frameFrozenStatus={frameFrozenStatus}
              lastCapturedFrameDataUrl={lastCapturedFrameDataUrl}
              onTestSingleFrame={handleTestSingleFrame}
            />
          )}

          {/* TERMINAL DE LOGS */}
          {showLogs && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden text-xs font-mono">
              <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400 font-sans font-bold text-[11px]">
                <div className="flex items-center gap-2">
                  <List className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Terminal de Diagnóstico Live ({logs.length} eventos)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">1 FPS / Loop</span>
              </div>
              <div
                ref={logsContainerRef}
                className="p-3 space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
              >
                {logs.length === 0 ? (
                  <span className="text-slate-600 italic">Nenhum evento registrado ainda...</span>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                      <span
                        className={
                          log.tipo === 'confirm'
                            ? 'text-emerald-300 font-bold bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-800/40'
                            : log.tipo === 'success'
                            ? 'text-emerald-400'
                            : log.tipo === 'warning'
                            ? 'text-amber-400'
                            : log.tipo === 'error'
                            ? 'text-rose-400 font-bold'
                            : 'text-slate-300'
                        }
                      >
                        {log.mensagem}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* CONTROLES DA CÂMERA E TRANSMISSÃO */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
          {/* SELEÇÃO DA FONTE DE VÍDEO */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-2.5 bg-slate-900/90 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Fonte de vídeo:</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSelectSource('CAMERA')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  videoSource === 'CAMERA'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-indigo-200" />
                <span>( ) Câmera</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSource('SCREEN_CAPTURE')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  videoSource === 'SCREEN_CAPTURE'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/40'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-indigo-200" />
                <span>(x) Tela (scrcpy)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Frequência: {fpsConfig} FPS (1s)</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isTransmitting ? (
                <button
                  type="button"
                  onClick={handleStopLive}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Encerrar Transmissão
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartLive}
                  disabled={isRequestingPermission}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Iniciar Transmissão Live
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                title="Fechar modal mantendo a transmissão em segundo plano"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                Sair da Tela
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
