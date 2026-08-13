import { logger } from '../utils/logger';

export interface UserViewZoneConfig {
  enabled: boolean;
  xPct: number; // 0.0 - 100.0 (% da posição horizontal inicial)
  yPct: number; // 0.0 - 100.0 (% da posição vertical inicial)
  wPct: number; // 0.0 - 100.0 (% da largura total visível)
  hPct: number; // 0.0 - 100.0 (% da altura total visível)
  updatedAt: number;
}

export interface UserCropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY = 'FARM_FISHING_USER_VIEW_ZONE_CONFIG';

const DEFAULT_USER_VIEW_ZONE: UserViewZoneConfig = {
  enabled: true,
  xPct: 10.0,
  yPct: 10.0,
  wPct: 80.0,
  hPct: 80.0,
  updatedAt: Date.now(),
};

/**
 * UserViewZoneService
 * 
 * Serviço isolado e independente responsável pelo CORTE DOS USUÁRIOS (USER_VIEW_ZONE).
 * Representa exclusivamente a área da Roda Gigante que o administrador autoriza os usuários a visualizar.
 * 
 * REGRA DE OURO: Este serviço é 100% INDEPENDENTE da RESULT_ZONE (utilizada para análise técnica/visão).
 * Alterações no corte de usuário NUNCA afetam o reconhecimento, detecção de objetos ou algoritmos de IA.
 */
export class UserViewZoneService {
  private static memoryConfig: UserViewZoneConfig | null = null;

  public static getUserViewZoneConfig(): UserViewZoneConfig {
    if (!this.memoryConfig && typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed === 'object' && parsed !== null) {
            this.memoryConfig = {
              enabled: parsed.enabled !== false,
              xPct: this.clamp(Number(parsed.xPct) || 10.0, 0, 90),
              yPct: this.clamp(Number(parsed.yPct) || 10.0, 0, 90),
              wPct: this.clamp(Number(parsed.wPct) || 80.0, 10, 100),
              hPct: this.clamp(Number(parsed.hPct) || 80.0, 10, 100),
              updatedAt: Number(parsed.updatedAt) || Date.now(),
            };
          }
        }
      } catch (err) {
        logger.warn('[USER_VIEW_ZONE] Erro ao ler configuração do localStorage:', err);
      }
    }

    if (!this.memoryConfig) {
      this.memoryConfig = { ...DEFAULT_USER_VIEW_ZONE, updatedAt: Date.now() };
    }

    return { ...this.memoryConfig };
  }

  public static setUserViewZoneConfig(config: Partial<UserViewZoneConfig>): UserViewZoneConfig {
    const current = this.getUserViewZoneConfig();
    
    const xPct = this.clamp(config.xPct !== undefined ? Number(config.xPct) : current.xPct, 0, 95);
    const yPct = this.clamp(config.yPct !== undefined ? Number(config.yPct) : current.yPct, 0, 95);
    const maxW = 100 - xPct;
    const maxH = 100 - yPct;
    
    const wPct = this.clamp(config.wPct !== undefined ? Number(config.wPct) : current.wPct, 5, maxW);
    const hPct = this.clamp(config.hPct !== undefined ? Number(config.hPct) : current.hPct, 5, maxH);

    const updated: UserViewZoneConfig = {
      enabled: config.enabled !== undefined ? Boolean(config.enabled) : current.enabled,
      xPct,
      yPct,
      wPct,
      hPct,
      updatedAt: Date.now(),
    };

    this.memoryConfig = updated;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        logger.warn('[USER_VIEW_ZONE] Erro ao salvar no localStorage:', err);
      }
    }

    logger.info(`[USER_VIEW_ZONE] Configuração atualizada: X=${xPct.toFixed(1)}%, Y=${yPct.toFixed(1)}%, W=${wPct.toFixed(1)}%, H=${hPct.toFixed(1)}% (enabled=${updated.enabled})`);
    return updated;
  }

  public static resetUserViewZoneConfig(): UserViewZoneConfig {
    this.memoryConfig = { ...DEFAULT_USER_VIEW_ZONE, updatedAt: Date.now() };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    return { ...this.memoryConfig };
  }

  /**
   * Converte porcentagens em coordenadas de pixels absolutos mantendo os limites da imagem.
   */
  public static calculateUserCrop(
    fullWidth: number,
    fullHeight: number,
    configOverride?: UserViewZoneConfig
  ): UserCropCoordinates {
    const cfg = configOverride || this.getUserViewZoneConfig();

    if (!cfg.enabled) {
      return { x: 0, y: 0, width: fullWidth, height: fullHeight };
    }

    const x = Math.max(0, Math.min(fullWidth - 10, Math.round((cfg.xPct / 100) * fullWidth)));
    const y = Math.max(0, Math.min(fullHeight - 10, Math.round((cfg.yPct / 100) * fullHeight)));
    
    const maxW = fullWidth - x;
    const maxH = fullHeight - y;

    const width = Math.max(10, Math.min(maxW, Math.round((cfg.wPct / 100) * fullWidth)));
    const height = Math.max(10, Math.min(maxH, Math.round((cfg.hPct / 100) * fullHeight)));

    return { x, y, width, height };
  }

  private static clamp(value: number, min: number, max: number): number {
    if (isNaN(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}
