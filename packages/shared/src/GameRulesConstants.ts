/**
 * @file packages/shared/src/GameRulesConstants.ts
 * @module @etheria/shared
 * @description Constantes autoritárias de regras de jogo e utilitários puros compartilhados
 *   entre Backend (@etheria/server), Database (@etheria/database) e Clientes (/play e /admin).
 * @rules
 *   1. Velocidade máxima em batalha travada em 185 px/s (piso 60 px/s).
 *   2. Velocidade base autoritária de deslocamento no mapa 2.5D fixa em 168 px/s.
 *   3. Os 16 slots oficiais de equipamento de personagem e os 4 elementos ativos permanecem centralizados aqui.
 * @dependencies Nenhuma (zero imports externos para compatibilidade nativa ES Module em navegadores).
 */

export const MAX_BATTLE_MOVE_SPEED = 185;
export const MIN_BATTLE_MOVE_SPEED = 60;
export const AUTHORITATIVE_BASE_MOVE_SPEED = 168;
export const ELEVATED_ROLES = ['ADMIN', 'GM', 'DEV'] as const;
export const ACTIVE_ELEMENTS = ['FIRE', 'EARTH', 'AIR', 'WATER'] as const;
export const VALID_CHARACTER_EQUIPMENT_SLOTS = [
  'HEAD',
  'SHOULDER',
  'CHEST',
  'BELT',
  'LEGS',
  'FEET',
  'ORNAMENT_1',
  'ORNAMENT_2',
  'RING',
  'NECKLACE',
  'WEAPON_1',
  'WEAPON_2',
  'FISHING_ROD',
  'FLYING_MOUNT',
  'WINGS',
  'FASHION',
] as const;

export type CharacterEquipmentSlotCode = (typeof VALID_CHARACTER_EQUIPMENT_SLOTS)[number];

export class GameRulesConstants {
  public static readonly MAX_BATTLE_MOVE_SPEED = MAX_BATTLE_MOVE_SPEED;
  public static readonly MIN_BATTLE_MOVE_SPEED = MIN_BATTLE_MOVE_SPEED;
  public static readonly AUTHORITATIVE_BASE_MOVE_SPEED = AUTHORITATIVE_BASE_MOVE_SPEED;
  public static readonly ELEVATED_ROLES = ELEVATED_ROLES;
  public static readonly ACTIVE_ELEMENTS = ACTIVE_ELEMENTS;
  public static readonly VALID_CHARACTER_EQUIPMENT_SLOTS = VALID_CHARACTER_EQUIPMENT_SLOTS;

  public static isElevatedRole(role?: string | null): boolean {
    return typeof role === 'string' && (ELEVATED_ROLES as readonly string[]).includes(role.toUpperCase());
  }

  public static clampBattleMoveSpeed(val: number, fallback: number = 180): number {
    const num = Number(val);
    const safe = Number.isFinite(num) && num > 0 ? num : fallback;
    return Math.min(MAX_BATTLE_MOVE_SPEED, Math.max(MIN_BATTLE_MOVE_SPEED, safe));
  }
}
