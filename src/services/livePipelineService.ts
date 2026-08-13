import { liveService } from './liveService';
import { VideoSourceType, videoSourceManager } from './videoSourceManager';
import { WheelRegionDetector } from './WheelRegionDetector';
import { WheelResultScreenDetector } from './WheelResultScreenDetector';
import { computeBase64Hash, computeBase64Bytes } from '../utils/hashUtils';
import { LiveFramePayload, LiveResultPayload } from '../types/live';

export interface LiveLogEntry {
  id: string;
  timestamp: string;
  mensagem: string;
  tipo: 'info' | 'success' | 'warning' | 'error' | 'confirm';
}

export interface PipelineState {
  videoSource: VideoSourceType;
  cameraActive: boolean;
  isTransmitting: boolean;
  cameraError: string | null;
  facingMode: 'environment' | 'user';
  fpsConfig: number;
  fpsRealtime: number;
  lastFrameTime: number | null;
  logs: LiveLogEntry[];
  mediaStreamSettings: any | null;
  videoDimensions: { width: number; height: number };
  canvasDimensions: { width: number; height: number };
  lastFrameSendMetadata: any | null;
  frameFrozenStatus: 'FRAME_ATUALIZANDO' | 'FRAME_CONGELADO';
  lastCapturedFrameDataUrl: string | null;
  isRequestingPermission: boolean;
  totalCapturados: number;
  totalDescartadosBackpressure: number;
}

const DEFAULT_PIPELINE_STATE: PipelineState = {
  videoSource: 'SCREEN_CAPTURE',
  cameraActive: false,
  isTransmitting: false,
  cameraError: null,
  facingMode: 'environment',
  fpsConfig: 1,
  fpsRealtime: 0,
  lastFrameTime: null,
  logs: [],
  mediaStreamSettings: null,
  videoDimensions: { width: 0, height: 0 },
  canvasDimensions: { width: 0, height: 0 },
  lastFrameSendMetadata: null,
  frameFrozenStatus: 'FRAME_ATUALIZANDO',
  lastCapturedFrameDataUrl: null,
  isRequestingPermission: false,
  totalCapturados: 0,
  totalDescartadosBackpressure: 0,
};

type StateListener = (state: PipelineState) => void;
type ResultCallback = (result: LiveResultPayload) => void;

class LivePipelineService {
  private state: PipelineState = { ...DEFAULT_PIPELINE_STATE };
  private stateListeners: Set<StateListener> = new Set();
  private resultCallbacks: Set<ResultCallback> = new Set();

  private mediaStream: MediaStream | null = null;
  private persistentVideo: HTMLVideoElement | null = null;
  private persistentCanvas: HTMLCanvasElement | null = null;
  private timer: NodeJS.Timeout | null = null;

  private isProcessingFrame: boolean = false;
  private totalFramesCapturados: number = 0;
  private totalFramesDescartadosBackpressure: number = 0;
  private previousFrameBase64: string | null = null;
  private objectUrl: string | null = null;

  private latestFramePayload: {
    framePayload: LiveFramePayload;
    frameId: number;
    targetWidth: number;
    targetHeight: number;
    jpegSizeKB: string;
    effectiveJpegQuality: number;
    roi: any;
    currentFrozenStatus: string;
  } | null = null;

  constructor() {
    this.ensurePersistentVideoElement();
  }

  /**
   * Garante a existência de um elemento <video> oculto no DOM
   * de forma que a decodificação de quadros e o canvas.drawImage NUNCA parem,
   * mesmo que a modal da Câmera Live seja fechada.
   */
  private ensurePersistentVideoElement(): void {
    if (typeof document === 'undefined') return;

    if (!this.persistentVideo) {
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.id = 'persistent-live-pipeline-video';

      // Estilização segura que NUNCA usa display:none / hidden
      // Mantém o vídeo no DOM ativo e GPU pipeline sem congelar a decodificação
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      video.style.width = '640px';
      video.style.height = '360px';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-9999';

      document.body.appendChild(video);
      this.persistentVideo = video;
    }

    if (!this.persistentCanvas) {
      this.persistentCanvas = document.createElement('canvas');
    }
  }

  public getState(): PipelineState {
    return { ...this.state };
  }

  public getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onResultDetected(callback: ResultCallback): () => void {
    this.resultCallbacks.add(callback);
    return () => {
      this.resultCallbacks.delete(callback);
    };
  }

  private notifyStateChange(): void {
    const currentState = this.getState();
    this.stateListeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (err) {
        console.error('Erro em listener do LivePipelineService:', err);
      }
    });
  }

  public addLog(mensagem: string, tipo: LiveLogEntry['tipo'] = 'info'): void {
    const newEntry: LiveLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      mensagem,
      tipo,
    };

    this.state = {
      ...this.state,
      logs: [...this.state.logs.slice(-49), newEntry],
    };
    this.notifyStateChange();
  }

  public setVideoSource(source: VideoSourceType): void {
    this.state = { ...this.state, videoSource: source };
    this.notifyStateChange();
  }

  public setFacingMode(mode: 'environment' | 'user'): void {
    this.state = { ...this.state, facingMode: mode };
    this.notifyStateChange();
  }

  /**
   * Encerra com segurança a captura de vídeo atual
   */
  public stopVideoStream = (): void => {
    videoSourceManager.stopCurrentStream();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Erro ao parar track de vídeo:', e);
        }
      });
      this.mediaStream = null;
    }
    if (this.persistentVideo) {
      this.persistentVideo.srcObject = null;
    }

    this.state = {
      ...this.state,
      cameraActive: false,
      mediaStreamSettings: null,
    };
    this.notifyStateChange();
  };

  /**
   * Interrompe o loop de transmissão de quadros
   */
  public stopFrameTransmission = (): void => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = { ...this.state, isTransmitting: false };
    this.notifyStateChange();
  };

  /**
   * Solicita e ativa a fonte de vídeo
   */
  public startVideoStream = async (targetSource?: VideoSourceType): Promise<boolean> => {
    const activeSource = targetSource || this.state.videoSource;
    this.state = { ...this.state, cameraError: null, isRequestingPermission: true };
    this.notifyStateChange();

    this.stopVideoStream();

    if (activeSource === 'SCREEN_CAPTURE') {
      this.addLog('Selecione a janela do scrcpy para compartilhar a tela do celular.', 'info');
    }

    videoSourceManager.setConfig({
      sourceType: activeSource,
      facingMode: this.state.facingMode,
      captureFps: this.state.fpsConfig,
      jpegQuality: 0.85,
      maxWidth: 1920,
      maxHeight: 1080,
    });

    try {
      const { stream, sourceType } = await videoSourceManager.requestStream(() => {
        this.addLog('Tela desconectada: O compartilhamento de tela foi encerrado.', 'warning');
        this.stopFrameTransmission();
        this.stopVideoStream();
        this.state = { ...this.state, cameraError: 'Tela desconectada' };
        this.notifyStateChange();
      });

      this.mediaStream = stream;
      this.ensurePersistentVideoElement();

      if (this.persistentVideo) {
        this.persistentVideo.srcObject = stream;
        await this.persistentVideo.play();

        this.state = {
          ...this.state,
          videoDimensions: {
            width: this.persistentVideo.videoWidth || 0,
            height: this.persistentVideo.videoHeight || 0,
          },
        };
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        const trackInfo = {
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          displaySurface: (settings as any).displaySurface || 'N/A',
          label: videoTrack.label || 'N/A',
          cursor: (settings as any).cursor || 'N/A',
        };
        this.state = {
          ...this.state,
          mediaStreamSettings: trackInfo,
          cameraActive: true,
          cameraError: null,
          videoSource: activeSource,
        };
        this.addLog(
          `[MEDIASTREAM INFO] Track: "${trackInfo.label}" | Res: ${trackInfo.width || 'N/A'}x${trackInfo.height || 'N/A'} @ ${trackInfo.frameRate || 'N/A'}fps`,
          'info'
        );
      } else {
        this.state = { ...this.state, cameraActive: true, cameraError: null, videoSource: activeSource };
      }

      if (sourceType === 'SCREEN_CAPTURE') {
        this.addLog('✓ Tela conectada com sucesso (scrcpy)', 'success');
      } else {
        this.addLog('Câmera física do dispositivo ativada com sucesso.', 'success');
      }

      this.notifyStateChange();
      return true;
    } catch (err: any) {
      console.error('[LIVE PIPELINE] Erro ao iniciar vídeo:', err);
      const errMsg = err.message || 'Não foi possível inicializar a fonte de vídeo.';

      this.state = { ...this.state, cameraError: errMsg, cameraActive: false };
      this.addLog(`Erro na fonte de vídeo (${activeSource}): ${errMsg}`, 'error');
      this.notifyStateChange();
      return false;
    } finally {
      this.state = { ...this.state, isRequestingPermission: false };
      this.notifyStateChange();
    }
  };

  /**
   * Inicia o loop contínuo de transmissão de quadros
   */
  public startFrameTransmission = (): void => {
    this.stopFrameTransmission();

    const intervalMs = Math.max(250, Math.round(1000 / this.state.fpsConfig));
    this.state = { ...this.state, isTransmitting: true };
    this.notifyStateChange();

    this.captureAndSendFrame();

    this.timer = setInterval(() => {
      this.captureAndSendFrame();
    }, intervalMs);

    this.addLog(`Transmissão contínua iniciada (${this.state.fpsConfig} FPS - ${intervalMs}ms interval)`, 'info');
  };

  /**
   * Inicia o fluxo completo da Live (Vídeo + Sessão Gemini + Transmissão)
   */
  public handleStartLive = async (): Promise<boolean> => {
    this.state = { ...this.state, cameraError: null };
    this.notifyStateChange();

    let okCam = this.state.cameraActive;
    if (!okCam) {
      okCam = await this.startVideoStream();
    }

    if (!okCam) return false;

    if (liveService.status().estado !== 'conectado') {
      this.addLog('Conectando à Gemini Live API...', 'info');
      await liveService.iniciarSessao({
        fps: this.state.fpsConfig,
        consecutiveConfirmationsRequired: 3,
        minConfidenceRequired: 85,
      });
    }

    this.startFrameTransmission();
    return true;
  };

  /**
   * Encerra a transmissão e fecha a fonte de vídeo com segurança
   */
  public handleStopLive = async (): Promise<void> => {
    this.stopFrameTransmission();
    this.stopVideoStream();
    await liveService.encerrarSessao('Transmissão encerrada manualmente pelo usuário');
    this.addLog('Transmissão Live encerrada pelo usuário.', 'info');
  };

  /**
   * Executa teste estático em 1 único frame capturado
   */
  public handleTestSingleFrame = async (): Promise<any> => {
    this.addLog('🧪 Executando Teste de Frame Estático Real da Tela...', 'info');

    const video = this.persistentVideo;
    if (!video || video.paused || video.ended || video.readyState < 2) {
      this.addLog('❌ Vídeo da tela não está disponível ou ativo.', 'error');
      return { httpStatus: 'Erro: Vídeo Inativo', erro: 'O vídeo da tela não está ativo.' };
    }

    const canvas = this.persistentCanvas || document.createElement('canvas');
    this.persistentCanvas = canvas;

    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;
    canvas.width = vWidth;
    canvas.height = vHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return { erro: 'Não foi possível obter contexto 2D do Canvas' };

    ctx.drawImage(video, 0, 0, vWidth, vHeight);
    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.85);

    const tStart = Date.now();
    try {
      const res = await liveService.enviarFrameFull({
        base64Data: jpegBase64,
        mimeType: 'image/jpeg',
        timestamp: tStart,
        width: vWidth,
        height: vHeight,
        source: 'SCREEN_CAPTURE',
      });
      const tEnd = Date.now();

      this.addLog(
        `✓ Teste Frame Estático concluído em ${tEnd - tStart}ms. Objeto: "${res?.objetoDetectado || 'nenhum'}" (${res?.confianca || 0}%)`,
        'success'
      );

      return {
        httpStatus: '200 OK',
        tempoMs: tEnd - tStart,
        largura: vWidth,
        altura: vHeight,
        respostaBrutaGemini: res?.geminiRawResponse || res?.rawText || 'Sem resposta',
        estadoGemini: res?.geminiEstadoLog || 'N/A',
        objetoDetectado: res?.objetoDetectado || 'Nenhum',
        confianca: res?.confianca || 0,
        frameDiagnostico: res?.frameDiagnostico,
        estabilizacao: res?.estabilizacao,
      };
    } catch (err: any) {
      this.addLog(`❌ Erro no Teste de Frame Estático: ${err?.message}`, 'error');
      return {
        httpStatus: '500 Error',
        erro: err?.message || 'Erro ao enviar frame estático',
      };
    }
  };

  /**
   * Processador do quadro mais recente (Latest Frame Wins).
   * Garante exatamente UMA requisição ao Gemini por vez.
   */
  private processLatestFrame = async (): Promise<void> => {
    if (this.isProcessingFrame || !this.latestFramePayload) {
      return;
    }

    this.isProcessingFrame = true;
    const currentItem = this.latestFramePayload;
    this.latestFramePayload = null; // consome o frame mais recente

    const {
      framePayload,
      frameId,
      targetWidth,
      targetHeight,
      jpegSizeKB,
      effectiveJpegQuality,
      roi,
    } = currentItem;

    const requestStarted = Date.now();

    try {
      this.addLog(`[SEND] Frame #${frameId} (ROI: ${roi.width}x${roi.height})`, 'info');
      this.addLog(`[BACKEND_WAIT] Frame #${frameId} enviado, aguardando resposta...`, 'info');

      const res = await liveService.enviarFrameFull(framePayload);
      const requestFinished = Date.now();
      const durationMs = requestFinished - requestStarted;

      if (res) {
        const httpStatusStr = res.geminiHttpStatus ? `HTTP ${res.geminiHttpStatus}` : 'HTTP 200';
        this.addLog(`[BACKEND_RESPONSE] Frame #${frameId} — ${durationMs}ms (${httpStatusStr})`, 'info');

        const objDetected = res.objetoDetectado || 'nenhum';
        const confScore = res.confianca || 0;

        this.addLog(`[GEMINI_RESULT] Frame #${frameId} → ${objDetected}`, 'info');
        this.addLog(`[CONFIDENCE] Frame #${frameId} → ${confScore}%`, 'info');

        if (res.estabilizacao) {
          const est = res.estabilizacao;
          const cand = est.candidatoAtual || objDetected;
          const count = est.confirmacoesConsecutivas || 0;
          const required = est.confirmacoesNecessarias || 3;

          this.addLog(`[STABILIZATION] ${cand}`, 'info');
          this.addLog(`[STABILIZATION] contador: ${count}/${required}`, 'info');

          if (est.foiConfirmadoAgora) {
            this.addLog(`[CONFIRMED] ${cand}`, 'success');
            this.addLog(`[REGISTER] Tentando registrar ${cand}...`, 'info');

            if (est.gravadoNoSupabase) {
              this.addLog(`[REGISTER] Sucesso (Rodada #${est.rodadaRegistrada || 'OK'})`, 'success');
            } else {
              this.addLog(`[REGISTER] BLOQUEADO — PERSISTÊNCIA DESABILITADA (${est.motivoEstabilizacao || 'MODO_TESTE'})`, 'warning');
            }

            // Dispara callbacks de resultado confirmado registrados (incluindo App.tsx)
            this.resultCallbacks.forEach((cb) => {
              try {
                cb(res);
              } catch (err) {
                console.error('Erro em resultCallback do LivePipelineService:', err);
              }
            });
          }
        }

        this.state = {
          ...this.state,
          lastFrameSendMetadata: {
            frameId,
            timestamp: requestStarted,
            width: targetWidth,
            height: targetHeight,
            jpegSizeKB,
            quality: effectiveJpegQuality,
            requestStarted,
            requestFinished,
            httpStatus: '200 OK',
          },
        };
        this.notifyStateChange();
      } else {
        this.addLog(`[BACKEND_ERROR] Frame #${frameId} — Falha ao processar frame no backend`, 'error');
      }
    } catch (err: any) {
      const durationMs = Date.now() - requestStarted;
      this.addLog(`[BACKEND_ERROR] Frame #${frameId} — HTTP 500 / ${err?.message || 'Erro no backend'} (${durationMs}ms)`, 'error');
    } finally {
      this.isProcessingFrame = false;
      if (this.latestFramePayload) {
        this.processLatestFrame();
      }
    }
  };

  /**
   * Captura e comprime o frame do elemento <video> persistente
   */
  private captureAndSendFrame = (): void => {
    this.totalFramesCapturados++;

    const video = this.persistentVideo;
    if (!video || video.paused || video.ended || video.readyState < 2) {
      return;
    }

    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;

    let canvas = this.persistentCanvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      this.persistentCanvas = canvas;
    }

    let targetWidth = vWidth;
    let targetHeight = vHeight;

    if (targetWidth > 1920) {
      const scale = 1920 / targetWidth;
      targetWidth = 1920;
      targetHeight = Math.round(targetHeight * scale);
    }
    if (targetHeight > 1080) {
      const scale = 1080 / targetHeight;
      targetHeight = 1080;
      targetWidth = Math.round(targetWidth * scale);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    const effectiveJpegQuality = 0.85;
    const jpegBase64 = canvas.toDataURL('image/jpeg', effectiveJpegQuality);

    // Detecção e Recorte da ROI da Roda
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const roi = WheelRegionDetector.detectWheelRegion({
      width: targetWidth,
      height: targetHeight,
      imageData: imgData,
    });

    let croppedDataUrl: string | undefined;
    let croppedBase64: string | undefined;

    if (roi.found) {
      croppedDataUrl = WheelRegionDetector.cropROIFromCanvas(canvas, roi, effectiveJpegQuality) || undefined;
      if (croppedDataUrl) {
        croppedBase64 = croppedDataUrl.replace(/^data:image\/\w+;base64,/, '');
        roi.croppedDataUrl = croppedDataUrl;
      }
    }

    // Detecção da Tela de Resultado
    const resScreen = WheelResultScreenDetector.detectResultScreen({
      width: targetWidth,
      height: targetHeight,
      imageData: imgData,
    });

    let resultScreenCroppedDataUrl: string | undefined;
    let resultScreenCroppedBase64: string | undefined;

    if (resScreen.resultadoScreenDetected && resScreen.roi) {
      const cropXToUse = resScreen.roi.absCropX ?? resScreen.roi.x;
      const cropYToUse = resScreen.roi.absCropY ?? resScreen.roi.y;
      const cropWToUse = resScreen.roi.absCropWidth ?? resScreen.roi.width;
      const cropHToUse = resScreen.roi.absCropHeight ?? resScreen.roi.height;

      const resCanvas = document.createElement('canvas');
      resCanvas.width = cropWToUse;
      resCanvas.height = cropHToUse;
      const resCtx = resCanvas.getContext('2d');
      if (resCtx) {
        resCtx.drawImage(
          canvas,
          cropXToUse,
          cropYToUse,
          cropWToUse,
          cropHToUse,
          0,
          0,
          cropWToUse,
          cropHToUse
        );
        resultScreenCroppedDataUrl = resCanvas.toDataURL('image/jpeg', effectiveJpegQuality);
        resultScreenCroppedBase64 = resultScreenCroppedDataUrl.replace(/^data:image\/\w+;base64,/, '');

        liveService.preserveLocalCrop({
          resultScreenCroppedDataUrl,
          croppedDataUrl: resultScreenCroppedDataUrl,
          width: cropWToUse,
          height: cropHToUse,
        });
      }
    }

    // Verificação de frame congelado
    let frozen = false;
    if (this.previousFrameBase64) {
      if (this.previousFrameBase64 === jpegBase64) {
        frozen = true;
      } else if (
        this.previousFrameBase64.length === jpegBase64.length &&
        this.previousFrameBase64.slice(-100) === jpegBase64.slice(-100)
      ) {
        frozen = true;
      }
    }
    this.previousFrameBase64 = jpegBase64;
    const currentFrozenStatus = frozen ? 'FRAME_CONGELADO' : 'FRAME_ATUALIZANDO';

    const frameId = this.totalFramesCapturados;
    const cleanBase64 = jpegBase64.replace(/^data:image\/\w+;base64,/, '');
    const jpegSizeBytes = Math.round((cleanBase64.length * 3) / 4);
    const jpegSizeKB = (jpegSizeBytes / 1024).toFixed(1) + ' KB';

    const now = Date.now();
    if (this.state.lastFrameTime) {
      const deltaSec = (now - this.state.lastFrameTime) / 1000;
      if (deltaSec > 0) {
        this.state = { ...this.state, fpsRealtime: Number((1 / deltaSec).toFixed(1)) };
      }
    }

    this.state = {
      ...this.state,
      videoDimensions: { width: vWidth, height: vHeight },
      canvasDimensions: { width: targetWidth, height: targetHeight },
      frameFrozenStatus: currentFrozenStatus,
      lastFrameTime: now,
      lastCapturedFrameDataUrl: jpegBase64,
      totalCapturados: this.totalFramesCapturados,
      totalDescartadosBackpressure: this.totalFramesDescartadosBackpressure,
    };

    this.addLog(`[CAPTURE] Frame #${frameId} (${targetWidth}x${targetHeight}, ${jpegSizeKB}, ROI: ${roi.status}) [${currentFrozenStatus}]`, 'info');

    if (this.isProcessingFrame) {
      this.totalFramesDescartadosBackpressure++;
      this.addLog(
        `[BACKPRESSURE] Frame #${frameId} retido. Requisição anterior em andamento (O mais recente será processado em seguida).`,
        'warning'
      );
    }

    const winnerCropBase64ToUse = resultScreenCroppedBase64 || croppedBase64 || cleanBase64;
    const winnerCropW = resScreen.roi?.symbolCropWidth || resScreen.roi?.absCropWidth || resScreen.roi?.width || 153;
    const winnerCropH = resScreen.roi?.symbolCropHeight || resScreen.roi?.absCropHeight || resScreen.roi?.height || 153;

    const robustResultScreenRoi = {
      ...(resScreen.roi || {}),
      symbolCropWidth: winnerCropW,
      symbolCropHeight: winnerCropH,
      symbolCropValid: true,
    };

    this.latestFramePayload = {
      framePayload: {
        base64Data: croppedBase64 || cleanBase64,
        mimeType: 'image/jpeg',
        timestamp: now,
        width: targetWidth,
        height: targetHeight,
        source: 'SCREEN_CAPTURE',
        metadata: {
          statusCongelamento: currentFrozenStatus,
          qualidadeJpeg: effectiveJpegQuality,
          previewUrl: jpegBase64,
          croppedDataUrl,
          croppedBase64,
          roi,
          resultadoScreenDetected: resScreen.resultadoScreenDetected,
          resultScreenConfidence: resScreen.confidence,
          resultScreenRoi: robustResultScreenRoi,
          resultScreenCroppedDataUrl,
          resultScreenCroppedBase64,
          winnerCropBase64: winnerCropBase64ToUse,
          symbolCropBase64: winnerCropBase64ToUse,
          winnerCropDataUrl: resultScreenCroppedDataUrl || croppedDataUrl,
          symbolCropDataUrl: resultScreenCroppedDataUrl || croppedDataUrl,
        },
      },
      frameId,
      targetWidth,
      targetHeight,
      jpegSizeKB,
      effectiveJpegQuality,
      roi,
      currentFrozenStatus,
    };

    this.processLatestFrame();
  };
}

export const livePipelineService = new LivePipelineService();
