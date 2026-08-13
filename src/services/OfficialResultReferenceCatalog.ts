import {
  WheelObjectName,
  ReferenceId,
  ALLOWED_WHEEL_OBJECTS,
  OFFICIAL_RESULT_REFERENCE_DEFINITIONS,
  OFFICIAL_REFERENCE_ID_MAP,
  OFFICIAL_REFERENCE_EMOJI_MAP,
  isAllowedWheelObject,
} from '../config/wheelObjectReferences';
import { WheelObjectVisualMatcher, ImageFeatures } from './WheelObjectVisualMatcher';
import sharp from 'sharp';

export interface OfficialReferenceEntry {
  referenceId: ReferenceId;
  object: WheelObjectName;
  name: string;
  emoji: string;
  imageUrl: string;
  loaded: boolean;
  valid: boolean;
  status: 'READY' | 'LOAD_FAILED' | 'FEATURES_INVALID' | 'UNINITIALIZED';
  width: number;
  height: number;
  features: ImageFeatures | null;
  loadError?: string | null;
  loadedAt?: number;
}

export interface CatalogValidationReport {
  valid: boolean;
  expectedCount: number;
  loadedCount: number;
  featuresReadyCount: number;
  entries: Array<{
    referenceId: ReferenceId;
    object: WheelObjectName;
    status: string;
    dimensions: string;
    featuresValid: boolean;
  }>;
}

/**
 * Single source of truth for the 8 official wheel references.
 */
export class OfficialResultReferenceCatalog {
  private static catalogCache: OfficialReferenceEntry[] | null = null;
  private static loadingPromise: Promise<OfficialReferenceEntry[]> | null = null;
  private static validationReport: CatalogValidationReport | null = null;

  public static readonly EXPECTED_COUNT = 8;

  /**
   * Valida a integridade do catálogo oficial de acordo com todas as regras de negócio.
   * Dispara erros com códigos estritos:
   * - CATALOG_INCOMPLETE
   * - DUPLICATE_REFERENCE_OBJECT
   * - FEATURES_INVALID
   */
  public static validateReferenceCatalog(catalog: OfficialReferenceEntry[]): CatalogValidationReport {
    if (!Array.isArray(catalog) || catalog.length !== this.EXPECTED_COUNT) {
      throw new Error(
        `CATALOG_INCOMPLETE: Catálogo inválido: ${catalog?.length ?? 0}/${this.EXPECTED_COUNT} referências carregadas.`
      );
    }

    const seenObjects = new Set<string>();
    const seenIds = new Set<string>();

    for (const entry of catalog) {
      if (!entry.object || !isAllowedWheelObject(entry.object)) {
        throw new Error(`CATALOG_INCOMPLETE: Objeto desconhecido ou inválido no catálogo: ${entry.object}`);
      }

      if (seenObjects.has(entry.object)) {
        throw new Error(`DUPLICATE_REFERENCE_OBJECT: Objeto duplicado encontrado: ${entry.object}`);
      }
      seenObjects.add(entry.object);

      if (seenIds.has(entry.referenceId)) {
        throw new Error(`DUPLICATE_REFERENCE_OBJECT: Reference ID duplicado encontrado: ${entry.referenceId}`);
      }
      seenIds.add(entry.referenceId);

      // Verificar carregamento de imagem
      if (!entry.loaded || !entry.imageUrl) {
        throw new Error(
          `CATALOG_INCOMPLETE: Imagem da referência ${entry.object} (${entry.referenceId}) não foi carregada: ${entry.loadError || 'ERRO_DESCONHECIDO'}`
        );
      }

      // Verificar dimensões
      if (entry.width <= 0 || entry.height <= 0) {
        throw new Error(
          `FEATURES_INVALID: Dimensões inválidas para referência ${entry.object} (${entry.width}x${entry.height})`
        );
      }

      // Verificar se features foram extraídas
      if (!entry.features || !entry.features.isCropValid) {
        throw new Error(
          `FEATURES_INVALID: Features nulas ou inválidas para referência ${entry.object} (${entry.referenceId})`
        );
      }

      // Validação estrita das sub-estruturas matemáticas de features
      const f = entry.features;
      const isFeaturesValid =
        Array.isArray(f.dHash) && f.dHash.length > 0 &&
        Array.isArray(f.colorHistogram) && f.colorHistogram.length > 0 &&
        Array.isArray(f.spatialGrid) && f.spatialGrid.length > 0 &&
        Array.isArray(f.edges) && f.edges.length > 0 &&
        Array.isArray(f.centerFeatures) && f.centerFeatures.length > 0;

      if (!isFeaturesValid) {
        throw new Error(
          `FEATURES_INVALID: Vetores de características incompletos para referência ${entry.object}`
        );
      }

      // Garantir que todos os números nas features são finitos (sem NaN ou Infinity)
      const hasNaN = [
        ...f.dHash,
        ...f.colorHistogram,
        ...f.spatialGrid,
        ...f.edges,
        ...f.centerFeatures,
      ].some((v) => !Number.isFinite(v));

      if (hasNaN) {
        throw new Error(
          `FEATURES_INVALID: Vetor de características contém valores numéricos não finitos para ${entry.object}`
        );
      }
    }

    // Verificar se todos os 8 objetos obrigatórios estão presentes
    for (const requiredObj of ALLOWED_WHEEL_OBJECTS) {
      if (!seenObjects.has(requiredObj)) {
        throw new Error(
          `CATALOG_INCOMPLETE: Objeto oficial obrigatório ausente: ${requiredObj}`
        );
      }
    }

    const report: CatalogValidationReport = {
      valid: true,
      expectedCount: this.EXPECTED_COUNT,
      loadedCount: catalog.filter((e) => e.loaded).length,
      featuresReadyCount: catalog.filter((e) => e.status === 'READY' && e.valid).length,
      entries: catalog.map((e) => ({
        referenceId: e.referenceId,
        object: e.object,
        status: e.status,
        dimensions: `${e.width}x${e.height}`,
        featuresValid: e.valid,
      })),
    };

    // Log estruturado obrigatório
    console.log(
      `\n[REFERENCE_CATALOG]\n` +
      `Catalog: VALID\n` +
      `Expected: ${this.EXPECTED_COUNT}\n` +
      `Loaded: ${report.loadedCount}\n` +
      `Features Ready: ${report.featuresReadyCount}\n\n` +
      catalog.map((e) => `${e.referenceId} → ${e.status}`).join('\n') +
      `\n`
    );

    return report;
  }

  /**
   * Carrega, extrai features e valida o catálogo completo das 8 referências oficiais.
   */
  public static async loadAndValidateCatalog(forceReload = false): Promise<OfficialReferenceEntry[]> {
    if (!forceReload && this.catalogCache && this.catalogCache.length === this.EXPECTED_COUNT) {
      return this.catalogCache;
    }

    if (this.loadingPromise && !forceReload) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.buildCatalog();
    try {
      const catalog = await this.loadingPromise;
      this.validationReport = this.validateReferenceCatalog(catalog);
      this.catalogCache = catalog;
      return this.catalogCache;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Constrói as entradas do catálogo extraindo features diretamente de cada imagem oficial.
   */
  private static async buildCatalog(): Promise<OfficialReferenceEntry[]> {
    const entries: OfficialReferenceEntry[] = [];

    for (const objectName of ALLOWED_WHEEL_OBJECTS) {
      const def = OFFICIAL_RESULT_REFERENCE_DEFINITIONS[objectName];
      const entry: OfficialReferenceEntry = {
        referenceId: def.referenceId,
        object: objectName,
        name: def.name,
        emoji: def.emoji,
        imageUrl: def.imageUrl,
        loaded: false,
        valid: false,
        status: 'UNINITIALIZED',
        width: 0,
        height: 0,
        features: null,
        loadError: null,
      };

      try {
        const response = await fetch(def.imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}_FETCH_FAILED`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const metadata = await sharp(buffer).metadata();

        entry.width = metadata.width || 0;
        entry.height = metadata.height || 0;
        entry.loaded = true;

        // Extrai características visuais usando o mesmo pipeline visual
        const features = await WheelObjectVisualMatcher.extractFeatures(def.imageUrl);

        if (!features || !features.isCropValid) {
          entry.status = 'FEATURES_INVALID';
          entry.loadError = features?.cropInvalidReason || 'FEATURES_EXTRACTION_FAILED';
          entry.valid = false;
        } else {
          entry.features = features;
          entry.valid = true;
          entry.status = 'READY';
          entry.loadedAt = Date.now();
        }
      } catch (error: any) {
        entry.loaded = false;
        entry.valid = false;
        entry.status = 'LOAD_FAILED';
        entry.loadError = error?.message || String(error);
        console.error(`[OfficialResultReferenceCatalog] Erro ao carregar ${objectName}:`, error);
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Retorna o catálogo síncrono em cache (se já carregado) ou vazio.
   */
  public static getCatalog(): OfficialReferenceEntry[] {
    if (this.catalogCache && this.catalogCache.length === this.EXPECTED_COUNT) {
      return this.catalogCache;
    }
    return [];
  }

  /**
   * Retorna uma referência específica pelo nome do objeto.
   */
  public static getReference(objectName: WheelObjectName): OfficialReferenceEntry | null {
    if (!this.catalogCache) return null;
    return this.catalogCache.find((e) => e.object === objectName) || null;
  }

  /**
   * Retorna uma referência específica pelo ID estável (ex: REF_SORVETE).
   */
  public static getReferenceById(referenceId: ReferenceId): OfficialReferenceEntry | null {
    if (!this.catalogCache) return null;
    return this.catalogCache.find((e) => e.referenceId === referenceId) || null;
  }

  /**
   * Retorna o relatório público de diagnóstico para ser consumido pelo painel e API.
   */
  public static getDiagnosticSummary() {
    const rawCatalog = this.catalogCache || [];
    return {
      status: this.validationReport?.valid ? 'VALID' : 'UNINITIALIZED_OR_INVALID',
      expectedCount: this.EXPECTED_COUNT,
      loadedCount: rawCatalog.filter((e) => e.loaded).length,
      featuresReadyCount: rawCatalog.filter((e) => e.status === 'READY' && e.valid).length,
      references: ALLOWED_WHEEL_OBJECTS.map((obj) => {
        const def = OFFICIAL_RESULT_REFERENCE_DEFINITIONS[obj];
        const entry = rawCatalog.find((e) => e.object === obj);
        return {
          referenceId: def.referenceId,
          object: obj,
          name: def.name,
          emoji: def.emoji,
          imageUrl: def.imageUrl,
          loaded: entry?.loaded ?? false,
          valid: entry?.valid ?? false,
          status: entry?.status ?? 'UNINITIALIZED',
          width: entry?.width ?? 0,
          height: entry?.height ?? 0,
          featuresReady: entry?.valid ?? false,
          loadError: entry?.loadError ?? null,
        };
      }),
    };
  }
}
