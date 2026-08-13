/**
 * CATÁLOGO OFICIAL DE REFERÊNCIAS VISUAIS DOS 8 SÍMBOLOS DA RODA DA FARM FISHING
 * Este arquivo é a ÚNICA FONTE OFICIAL de imagens, IDs estáveis e nomes dos objetos válidos da Roda.
 */

export type WheelObjectName =
  | 'sorvete'
  | 'boia'
  | 'balao'
  | 'soco'
  | 'tedy'
  | 'princesa'
  | 'camera'
  | 'coroa';

export type ReferenceId =
  | 'REF_SORVETE'
  | 'REF_BOIA'
  | 'REF_BALAO'
  | 'REF_SOCO'
  | 'REF_TEDY'
  | 'REF_PRINCESA'
  | 'REF_CAMERA'
  | 'REF_COROA';

export interface OfficialReferenceDefinition {
  referenceId: ReferenceId;
  object: WheelObjectName;
  name: string;
  emoji: string;
  imageUrl: string;
}

export const OFFICIAL_REFERENCE_ID_MAP: Record<WheelObjectName, ReferenceId> = {
  sorvete: 'REF_SORVETE',
  boia: 'REF_BOIA',
  balao: 'REF_BALAO',
  soco: 'REF_SOCO',
  tedy: 'REF_TEDY',
  princesa: 'REF_PRINCESA',
  camera: 'REF_CAMERA',
  coroa: 'REF_COROA',
} as const;

export const OFFICIAL_REFERENCE_EMOJI_MAP: Record<WheelObjectName, string> = {
  sorvete: '🍦',
  boia: '🛟',
  balao: '🎈',
  soco: '👊',
  tedy: '🧸',
  princesa: '👸',
  camera: '📷',
  coroa: '👑',
} as const;

export const OFFICIAL_RESULT_REFERENCE_DEFINITIONS: Record<WheelObjectName, OfficialReferenceDefinition> = {
  sorvete: {
    referenceId: 'REF_SORVETE',
    object: 'sorvete',
    name: 'sorvete',
    emoji: '🍦',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/e547cdbd-6b88-4319-9ec5-1d64c151bf32.jpg',
  },
  boia: {
    referenceId: 'REF_BOIA',
    object: 'boia',
    name: 'boia',
    emoji: '🛟',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/65330d28-bd8d-426a-815f-84e8b1f933ac.jpg',
  },
  balao: {
    referenceId: 'REF_BALAO',
    object: 'balao',
    name: 'balao',
    emoji: '🎈',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/53d2c57e-0cfe-43fc-95b6-69221883077c.jpg',
  },
  soco: {
    referenceId: 'REF_SOCO',
    object: 'soco',
    name: 'soco',
    emoji: '👊',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/38da51db-9f9f-47d5-8031-7ef398db5d02.jpg',
  },
  tedy: {
    referenceId: 'REF_TEDY',
    object: 'tedy',
    name: 'tedy',
    emoji: '🧸',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/780fa757-567e-4c5d-8cfc-1fd90edb6186.jpg',
  },
  princesa: {
    referenceId: 'REF_PRINCESA',
    object: 'princesa',
    name: 'princesa',
    emoji: '👸',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/b49610cb-c698-4d43-b7b4-a8f79d94e882.jpg',
  },
  camera: {
    referenceId: 'REF_CAMERA',
    object: 'camera',
    name: 'camera',
    emoji: '📷',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/d860e5bd-41f5-440c-8a9d-0b58c2ff0091.jpg',
  },
  coroa: {
    referenceId: 'REF_COROA',
    object: 'coroa',
    name: 'coroa',
    emoji: '👑',
    imageUrl: 'https://ik.imagekit.io/kqrijzbci/5ca8eb04-5d85-4217-93bf-df470eff4532.jpg',
  },
} as const;

export const ALLOWED_WHEEL_OBJECTS: readonly WheelObjectName[] = [
  'sorvete',
  'boia',
  'balao',
  'soco',
  'tedy',
  'princesa',
  'camera',
  'coroa',
] as const;

export interface WheelObjectReference {
  referenceId: ReferenceId;
  name: string;
  imageUrl: string;
  emoji: string;
}

export const WHEEL_OBJECT_REFERENCES = OFFICIAL_RESULT_REFERENCE_DEFINITIONS;
export const WINNING_OBJECT_REFERENCES = WHEEL_OBJECT_REFERENCES;
export const WIN_RESULT_TEMPLATES = WHEEL_OBJECT_REFERENCES;
export const WINNER_REFERENCE_IMAGES = WHEEL_OBJECT_REFERENCES;

export function isAllowedWheelObject(name: string | null | undefined): name is WheelObjectName {
  if (!name) return false;
  const clean = name.toLowerCase().trim();
  return ALLOWED_WHEEL_OBJECTS.includes(clean as WheelObjectName);
}

export function getWheelObjectReference(name: string | null | undefined): OfficialReferenceDefinition | null {
  if (!name || !isAllowedWheelObject(name)) return null;
  const clean = name.toLowerCase().trim() as WheelObjectName;
  return OFFICIAL_RESULT_REFERENCE_DEFINITIONS[clean];
}

export function getReferenceId(name: string | null | undefined): ReferenceId | null {
  if (!name || !isAllowedWheelObject(name)) return null;
  const clean = name.toLowerCase().trim() as WheelObjectName;
  return OFFICIAL_REFERENCE_ID_MAP[clean] || null;
}

