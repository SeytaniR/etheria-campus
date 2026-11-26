/**
 * @file apps/server/src/controllers/TemporaryCombatTypes.ts
 * @module @etheria/server
 * @description Contratos de dados e DTOs compartilhados pelo controlador de combate em memória e seu resolvedor de ações.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas).
 * @dependencies @etheria/shared, ./MonsterCombatBuilder.js, ./CharacterEquipmentService.js
 */

import type { ElementMatchupEntry } from '@etheria/shared';
import type { MonsterVariantTier } from './MonsterCombatBuilder.js';
import type { EquippedWeaponVisualDto, EquippedWingsVisualDto } from './CharacterEquipmentService.js';

export interface ActiveStatusInstance {
  code: string;
  name: string;
  isBuff: boolean;
  iconUrl: string;
  vfxKey?: string | null;
  triggerType: string;
  durationSeconds?: number;
  remainingSeconds?: number;
  remainingTurns: number;
}

export interface CombatUnit {
  id: string;
  monsterTemplateId?: number;
  index: number;
  name: string;
  level: number;
  variantTier?: MonsterVariantTier;
  modelScale?: number;
  nameColorHex?: string;
  rewardMultiplier?: number;
  expReward?: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  physAtk?: number;
  magAtk?: number;
  healPower?: number;
  def: number;
  magDef?: number;
  skillIds?: number[];
  critRate?: number;
  critDmg?: number;
  attackSpeed?: number;
  speed: number;
  spriteKey: string;
  atlasJsonUrl: string;
  atlasWebpUrl: string;
  groundOffsetY: number;
  thumbUrl: string;
  elementCode?: string;
  raceCode?: string;
  rarityTier?: string;
  combatStyle?: 'MELEE' | 'RANGED';
  attackRange?: number;
  damageType?: 'PHYSICAL' | 'MAGICAL';
  basicAttackVfxKey?: string;
  basicAttackVfxColorHex?: string;
  battleMoveSpeed?: number;
  physAccuracy?: number;
  physEvasion?: number;
  magAccuracy?: number;
  magEvasion?: number;
  spawnX?: number;
  spawnY?: number;
  aggroRadius?: number;
  damageDealtMultiplier?: number;
  isDungeonBoss?: boolean;
  equippedWings?: EquippedWingsVisualDto | null;
  equippedWeapon?: EquippedWeaponVisualDto | null;
  isAlive: boolean;
  activeStatuses?: ActiveStatusInstance[];
}

export interface FloatingCombatNumber {
  actor: 'player' | 'monster';
  actorIndex?: number;
  targetType: 'player' | 'monster';
  targetIndex?: number;
  type: 'DAMAGE' | 'HEAL' | 'CRIT' | 'MISS' | 'DEFEND';
  animAction?: number;
  vfxKey?: string | null;
  statusApplied?: ActiveStatusInstance | null;
  amount: number;
  isCrit?: boolean;
  elementRelation?: 'ADVANTAGE' | 'DISADVANTAGE' | 'NEUTRAL_PENALTY' | 'NORMAL';
  hpRemaining: number;
  message: string;
}

export interface TemporaryBattleState {
  battleId: string;
  battleNonce?: string;
  mapId?: number;
  createdAt?: number;
  characterId?: number;
  monsterTemplateId?: number;
  victoryRecorded?: boolean;
  totalRealPlayers?: number;
  isDungeon?: boolean;
  dungeonRunId?: number;
  dungeonMapId?: number;
  dungeonChest?: any;
  mapWidth?: number;
  mapHeight?: number;
  playerStartX?: number;
  playerStartY?: number;
  round: number;
  player: CombatUnit;
  monsters: CombatUnit[];
  pets?: CombatUnit[];
  elementMatchups?: ElementMatchupEntry[];
  classSkills?: any[];
  skillCatalog?: any[];
  statusCatalog?: any[];
  combatLog: string[];
  isFinished: boolean;
  winner: 'PLAYER' | 'MONSTERS' | null;
  rewards?: {
    exp: number;
    gold: number;
  };
  lastEvents?: FloatingCombatNumber[];
}
