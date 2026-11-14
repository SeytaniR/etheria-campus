/**
 * @file apps/server/src/controllers/TemporaryCombatController.ts
 * @module @etheria/server
 * @description Módulo Unificado de Combate & Geração de Encontros (Batalha Real In-Game `/play` e Simulacro GM `/gm`).
 *   Tanto a batalha real nos mapas (`startEncounterByMap`) quanto a batalha invocada pelo GM (`startBattle`)
 *   utilizam exatamente os mesmos processadores (`MonsterCombatBuilder` e `CombatDamageCalculator`),
 *   sem redutores artificiais, com escalonamento balanceado de nível, buff A/S/SS e vantagens elementais.
 */

import { PrismaClient, type MonsterTemplate } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CombatDamageCalculator, type ElementMatchupEntry } from '@etheria/shared';
import { randomUUID } from 'node:crypto';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { CombatUtilityHelper } from './CombatUtilityHelper.js';
import { MonsterCombatBuilder, type MonsterScalingContext } from './MonsterCombatBuilder.js';

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
  createdAt?: number;
  characterId?: number;
  monsterTemplateId?: number;
  victoryRecorded?: boolean;
  totalRealPlayers?: number;
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

export class TemporaryCombatController {
  private readonly prisma: PrismaClient;
  private readonly mcreworkPagesBaseUrl = '/api/assets/mcrework';
  private readonly activeBattles: Map<string, TemporaryBattleState> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [id, b] of this.activeBattles.entries()) {
        if (b.isFinished || (b.createdAt && now - b.createdAt > 20 * 60 * 1000)) {
          this.activeBattles.delete(id);
        }
      }
    }, 5 * 60 * 1000);
    interval.unref();
  }

  /**
   * Retorna os monstros disponíveis no banco para preencher o seletor do Painel GM.
   */
  public async getAvailableMonsters() {
    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

    const monsters = await this.prisma.monsterTemplate.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      include: {
        race: true,
        fixedElement: true,
      },
    });

    return monsters.map((m) => ({
      id: m.id,
      code: m.code,
      mcreworkMonsterKey: m.mcreworkMonsterKey,
      namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
      raceCode: m.raceCode,
      elementCode: m.fixedElementCode,
      rarityTier: m.rarityTier || 'F',
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${m.mcreworkMonsterKey}/thumb.webp`,
    }));
  }

  /**
   * Inicia uma batalha invocada pelo Painel GM utilizando exatamente o mesmo motor de atributos e dano da batalha real.
   */
  public async startBattle(
    characterId: number,
    monsterTemplateId: number,
    quantity: number = 1,
    monsterLevel: number = 1,
    customMonsterUnits?: CombatUnit[],
    preloadedCtx?: MonsterScalingContext
  ): Promise<TemporaryBattleState> {
    const scalingCtx = preloadedCtx || (await MonsterCombatBuilder.loadScalingContext(this.prisma));

    if (customMonsterUnits && customMonsterUnits.length > 0) {
      return this.buildBattleInstance(characterId, Number(monsterTemplateId) || 1, customMonsterUnits, scalingCtx);
    }

    const qty = Math.max(1, Math.min(25, Number(quantity) || 1));
    const lvl = Math.max(1, Math.min(100, Number(monsterLevel) || 1));

    const mobTemplate = await this.prisma.monsterTemplate.findUnique({
      where: { id: Number(monsterTemplateId) },
    });
    if (!mobTemplate) {
      throw new Error(`Monstro #${monsterTemplateId} não encontrado.`);
    }

    const nameTrans = await this.prisma.i18nTranslation.findUnique({
      where: { key_locale: { key: mobTemplate.nameI18nKey, locale: 'pt-BR' } },
    });
    const mobBaseName = nameTrans?.text || mobTemplate.code;
    const rTier = String(mobTemplate.rarityTier || 'F').toUpperCase();
    const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < qty; i++) {
      const displayName = qty > 1 ? `${mobBaseName} #${i + 1}${raritySuffix}` : `${mobBaseName}${raritySuffix}`;
      monsterUnits.push(
        MonsterCombatBuilder.buildMonsterUnit(
          mobTemplate,
          lvl,
          i,
          displayName,
          scalingCtx,
          this.mcreworkPagesBaseUrl
        )
      );
    }

    return this.buildBattleInstance(characterId, Number(mobTemplate.id), monsterUnits, scalingCtx);
  }

  /**
   * Sorteia um encontro de monstros autoritário no mapa utilizando o mesmo motor da batalha GM.
   */
  public async startEncounterByMap(characterId: number, mapId: number): Promise<TemporaryBattleState> {
    const map = await this.prisma.gameMap.findUnique({
      where: { id: Number(mapId) },
      include: { mapType: true },
    });

    if (!map) {
      throw new Error(`Mapa #${mapId} não encontrado.`);
    }
    if (!map.mapType?.allowMonsterSpawn) {
      throw new Error(`Este mapa (${map.code}) é uma zona segura e não permite spawn de monstros.`);
    }
    if (MapSpawnResolver.resolveEffectiveEncounterRate(true, map.encounterRatePct) <= 0) {
      throw new Error(`Este mapa possui taxa de encontro zero (zona segura).`);
    }

    const pc = await this.prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      include: { pets: { take: 3, include: { monsterTemplate: true } } },
    });

    // Regra Proporcional de Spawn:
    // - Jogador solo sem pet (allies = 1): 1 a 7 monstros
    // - Jogador + pet (base 2 combatentes): 3 a 10 monstros
    // - Cada combatente adicional alem da base de 2 (+1 a 3 monstros / +1 min e +2 max):
    //   Ex: 3 pets e 2 jogadores (5 combatentes -> 3 adicionais): 6 a 16 monstros
    const numPets = pc && pc.pets && pc.pets.length > 0 ? pc.pets.length : 0;
    const alliesCount = 1 + numPets;
    let minMobs = 1;
    let maxMobs = 7;
    if (alliesCount === 2) {
      minMobs = 3;
      maxMobs = 10;
    } else if (alliesCount > 2) {
      const extraAllies = alliesCount - 2;
      minMobs = 3 + extraAllies * 1;
      maxMobs = 10 + extraAllies * 2;
    }
    const totalMonstersToSpawn = Math.max(
      1,
      Math.min(25, Math.floor(Math.random() * (maxMobs - minMobs + 1)) + minMobs)
    );

    const candidateTemplates = await MapSpawnResolver.findEligibleMonstersForMap<MonsterTemplate>(
      this.prisma,
      map
    );
    if (candidateTemplates.length === 0) {
      throw new Error(`Nenhum monstro permitido/ativo configurado para spawn no mapa #${map.id}.`);
    }

    const [translations, scalingCtx] = await Promise.all([
      this.prisma.i18nTranslation.findMany({
        where: { key: { in: candidateTemplates.map((t) => t.nameI18nKey) }, locale: 'pt-BR' },
      }),
      MonsterCombatBuilder.loadScalingContext(this.prisma),
    ]);
    const i18nMap = new Map(translations.map((t) => [t.key, t.text]));

    const pickWeightedCandidate = () => {
      let totalW = 0;
      const weights = candidateTemplates.map((c) => {
        const w = MonsterCombatBuilder.resolveRarityProfile(c.rarityTier).spawnWeight;
        totalW += w;
        return w;
      });
      let roll = Math.random() * totalW;
      for (let i = 0; i < candidateTemplates.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return candidateTemplates[i];
      }
      return candidateTemplates[candidateTemplates.length - 1];
    };

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < totalMonstersToSpawn; i++) {
      const tmpl = pickWeightedCandidate();
      const mobLvl = MonsterCombatBuilder.resolveBalancedMapMonsterLevel(
        map.requiredLevel || 1,
        map.levelVarianceMin,
        map.levelVarianceMax
      );
      const rTier = String(tmpl.rarityTier || 'F').toUpperCase();
      const baseName = i18nMap.get(tmpl.nameI18nKey) || tmpl.code;
      const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';

      monsterUnits.push(
        MonsterCombatBuilder.buildMonsterUnit(
          tmpl,
          mobLvl,
          i,
          `${baseName} #${i + 1}${raritySuffix}`,
          scalingCtx,
          this.mcreworkPagesBaseUrl
        )
      );
    }

    const firstTemplateId = Number(monsterUnits[0]?.monsterTemplateId || candidateTemplates[0]?.id || 1);
    return this.buildBattleInstance(characterId, firstTemplateId, monsterUnits, scalingCtx);
  }

  /**
   * Montador único da instância de batalha (usado 100% igualmente por GM e Jogo Real).
   */
  private async buildBattleInstance(
    characterId: number,
    primaryMonsterTemplateId: number,
    monsterUnits: CombatUnit[],
    scalingCtx: MonsterScalingContext
  ): Promise<TemporaryBattleState> {
    let charName = 'Heroi';
    let charLevel = 1;
    let charSpriteKey = 'char1_a';
    let charGroundOffsetY = 0;
    let charElementCode = 'NEUTRAL';
    let charRaceCode = 'HUMAN';
    let charBaseStats = { VIT: 15, STR: 14, INT: 10, WIS: 10, AGI: 12, DEX: 12 };

    let pc: any = null;
    if (characterId) {
      pc = await this.prisma.playerCharacter.findUnique({
        where: { id: Number(characterId) },
        include: {
          classTemplate: true,
          pets: { take: 3, include: { monsterTemplate: true, petTemplate: true } },
        },
      });
      if (pc) {
        charName = pc.name;
        charLevel = pc.level || 1;
        charElementCode = pc.elementCode || 'NEUTRAL';
        const ct = pc.classTemplate;
        if (ct) {
          charRaceCode = ct.raceCode || 'HUMAN';
          const isRebornActive = Boolean(pc.isReborn && ct.rebornMcreworkCharKey);
          charSpriteKey = isRebornActive ? ct.rebornMcreworkCharKey! : ct.mcreworkCharKey;
          charGroundOffsetY = isRebornActive ? (ct.rebornGroundOffsetY || 0) : (ct.groundOffsetY || 0);
          const b = (ct.baseAttributesJson as any) || {};
          const dist = (pc.distributedStatsJson as any) || {};
          const growth = (ct.growthPerLevelJson as any) || {};
          const lvUps = Math.max(0, (pc.level || 1) - 1);
          charBaseStats = {
            VIT: (Number(b.VIT) || 10) + (Number(dist.VIT) || 0) + (Number(growth.VIT) || 2) * lvUps,
            STR: (Number(b.STR) || 10) + (Number(dist.STR) || 0) + (Number(growth.STR) || 2) * lvUps,
            INT: (Number(b.INT) || 10) + (Number(dist.INT) || 0) + (Number(growth.INT) || 2) * lvUps,
            WIS: (Number(b.WIS) || 10) + (Number(dist.WIS) || 0) + (Number(growth.WIS) || 2) * lvUps,
            AGI: (Number(b.AGI) || 10) + (Number(dist.AGI) || 0) + (Number(growth.AGI) || 2) * lvUps,
            DEX: (Number(b.DEX) || 10) + (Number(dist.DEX) || 0) + (Number(growth.DEX) || 2) * lvUps,
          };
        }
      }
    }

    const getRatio = (b: string, c: string, fb: number) =>
      MonsterCombatBuilder.getConversionRatio(scalingCtx, b, c, fb);

    const vitHpRatio = getRatio('VIT', 'MAX_HP', 20);
    const intMpRatio = getRatio('INT', 'MAX_MP', 12);
    const strPhysAtkRatio = getRatio('STR', 'PHYS_ATK', 2.5);
    const agiPhysAtkRatio = getRatio('AGI', 'PHYS_ATK', 0.5);
    const intMagAtkRatio = getRatio('INT', 'MAG_ATK', 2.5);
    const vitDefRatio = getRatio('VIT', 'PHYS_DEF', 1.5);
    const wisMagDefRatio = getRatio('WIS', 'MAG_DEF', 1.8);
    const wisHealPowerRatio = getRatio('WIS', 'HEAL_POWER', 2.0);
    const agiSpdRatio = getRatio('AGI', 'SPEED', 1.5);
    const agiMoveRatio = getRatio('AGI', 'BATTLE_MOVE_SPEED', 0.5);

    const classCb = (pc?.classTemplate as any)?.baseCombatAttributesJson || {};
    const classBaseSpeed = Number(classCb.BATTLE_MOVE_SPEED) || scalingCtx.globalDefaultMoveSpeed;
    const isPlayerMagical = String(pc?.classTemplate?.damageType || '').toUpperCase() === 'MAGICAL';

    // Bônus derivados de Equipamentos Ativos no Personagem
    const equippedMap = (pc?.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
      ? (pc.equippedItemsJson as Record<string, number>)
      : {}) as Record<string, number>;
    const eqItemIds = Object.values(equippedMap).map(Number).filter((id) => Number.isInteger(id) && id > 0);
    const eqItems = eqItemIds.length > 0
      ? await this.prisma.itemTemplate.findMany({ where: { id: { in: eqItemIds } } })
      : [];

    const eqBonuses: Record<string, number> = {};
    for (const eq of eqItems) {
      const bMap = (eq.combatStatBonusesJson && typeof eq.combatStatBonusesJson === 'object'
        ? (eq.combatStatBonusesJson as Record<string, number>)
        : {}) as Record<string, number>;
      for (const [k, v] of Object.entries(bMap)) {
        eqBonuses[k] = (eqBonuses[k] || 0) + (Number(v) || 0);
      }
    }

    const playerMoveSpeed = Math.round(classBaseSpeed + charBaseStats.AGI * agiMoveRatio + (eqBonuses.BATTLE_MOVE_SPEED || 0));

    const playerMaxHp = Math.round(charBaseStats.VIT * vitHpRatio + charLevel * 20 + (eqBonuses.MAX_HP || 0));
    const playerMaxMp = Math.round(charBaseStats.INT * intMpRatio + charLevel * 10 + (eqBonuses.MAX_MP || 0));
    const playerPhysAtk = Math.round(charBaseStats.STR * strPhysAtkRatio + charBaseStats.AGI * agiPhysAtkRatio + charLevel * 4 + (eqBonuses.PHYS_ATK || 0));
    const playerMagAtk = Math.round(charBaseStats.INT * intMagAtkRatio + charLevel * 4 + (eqBonuses.MAG_ATK || 0));
    const playerHealPower = Math.round(charBaseStats.WIS * wisHealPowerRatio + charLevel * 3 + (eqBonuses.HEAL_POWER || 0));
    const playerAtk = isPlayerMagical ? playerMagAtk : playerPhysAtk;
    const playerDef = Math.round(charBaseStats.VIT * vitDefRatio + charLevel * 2.5 + (eqBonuses.PHYS_DEF || 0));
    const playerMagDef = Math.round(charBaseStats.WIS * wisMagDefRatio + charLevel * 2.0 + (eqBonuses.MAG_DEF || 0));
    const playerSpeed = Math.round(charBaseStats.AGI * agiSpdRatio + charLevel + (eqBonuses.SPEED || 0));

    const pDexCrit = Math.max(0, charBaseStats.DEX - 10) * getRatio('DEX', 'CRIT_RATE', 0.002) + (eqBonuses.CRIT_RATE || 0) / 100;
    const pStrCritDmg = Math.max(0, charBaseStats.STR - 10) * getRatio('STR', 'CRIT_DMG', 0.003) + (eqBonuses.CRIT_DMG || 0) / 100;
    const pDexAcc = Math.max(0, charBaseStats.DEX - 10) * (getRatio('DEX', 'PHYS_ACCURACY', 0.002) * 100) + (eqBonuses.PHYS_ACCURACY || 0);
    const pAgiEva = Math.max(0, charBaseStats.AGI - 10) * (getRatio('AGI', 'PHYS_EVASION', 0.002) * 100) + (eqBonuses.PHYS_EVASION || 0);
    const pWisEva = Math.max(0, charBaseStats.WIS - 10) * (getRatio('WIS', 'MAG_EVASION', 0.0015) * 100) + (eqBonuses.MAG_EVASION || 0);
    const pMagAcc = (eqBonuses.MAG_ACCURACY || 0);

    const playerUnit: CombatUnit = {
      id: `player_${characterId || 1}`,
      index: 0,
      name: charName,
      level: charLevel,
      hp: playerMaxHp,
      maxHp: playerMaxHp,
      mp: playerMaxMp,
      maxMp: playerMaxMp,
      atk: playerAtk,
      physAtk: playerPhysAtk,
      magAtk: playerMagAtk,
      healPower: playerHealPower,
      def: playerDef,
      magDef: playerMagDef,
      skillIds: Array.isArray(pc?.classTemplate?.skillIdsJson) ? pc.classTemplate.skillIdsJson.map(Number).filter(Number.isFinite) : [],
      critRate: Math.min(0.80, (Number(classCb.CRIT_RATE) || 5) / 100 + pDexCrit),
      critDmg: Math.min(3.00, (Number(classCb.CRIT_DMG) || 150) / 100 + pStrCritDmg),
      attackSpeed: Math.round(((Number(classCb.ATTACK_SPEED) || 1.0) + (eqBonuses.ATTACK_SPEED || 0)) * 100) / 100,
      speed: playerSpeed,
      battleMoveSpeed: playerMoveSpeed,
      spriteKey: charSpriteKey,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.webp`,
      groundOffsetY: charGroundOffsetY,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/thumb.webp`,
      elementCode: charElementCode,
      raceCode: charRaceCode,
      combatStyle: (pc?.classTemplate?.combatStyle as any) || 'MELEE',
      attackRange: (pc?.classTemplate?.attackRange || 60) + (eqBonuses.ATTACK_RANGE || 0),
      damageType: isPlayerMagical ? 'MAGICAL' : 'PHYSICAL',
      basicAttackVfxKey: (pc?.classTemplate as any)?.basicAttackVfxKey || (classCb as any)?.basicAttackVfxKey || (((pc?.classTemplate?.combatStyle as any) || 'MELEE') === 'RANGED' ? '10002' : '10008'),
      basicAttackVfxColorHex: (pc?.classTemplate as any)?.basicAttackVfxColorHex || (classCb as any)?.basicAttackVfxColorHex || (((pc?.classTemplate?.combatStyle as any) || 'MELEE') === 'RANGED' ? '#38bdf8' : '#fde047'),
      physAccuracy: Math.min(125, Math.max(20, Math.round((Number(classCb.PHYS_ACCURACY) || 95) + pDexAcc))),
      physEvasion: Math.min(75, Math.max(0, Math.round((Number(classCb.PHYS_EVASION) || 5) + pAgiEva))),
      magAccuracy: Math.min(125, Math.max(20, Math.round((Number(classCb.MAG_ACCURACY) || 95) + pMagAcc))),
      magEvasion: Math.min(75, Math.max(0, Math.round((Number(classCb.MAG_EVASION) || 5) + pWisEva))),
      isAlive: true,
      activeStatuses: [],
    };

    const petUnits: CombatUnit[] = [];
    const rawPets =
      pc && pc.pets && pc.pets.length > 0
        ? pc.pets.slice(0, 3).map((cp: any, idx: number) => {
            const tpl = cp.petTemplate || cp.monsterTemplate;
            const folder = cp.petTemplate ? 'pets' : 'monsters';
            const k = cp.petTemplate ? tpl.mcreworkPetKey : tpl?.mcreworkMonsterKey || 'creature_000001';
            const b = (tpl?.baseAttributesJson as any) || { VIT: 12, STR: 11, INT: 10, WIS: 10, AGI: 11, DEX: 10 };
            const pLv = cp.level || charLevel;
            const cStats = (tpl?.baseCombatAttributesJson as any) || {};
            const isPetMag = String(tpl?.damageType || '').toUpperCase() === 'MAGICAL';
            const petLvlScale = 1 + Math.max(0, pLv - 1) * 0.12;
            const pMaxHp = Math.round((Number(b.VIT) || 12) * petLvlScale * vitHpRatio * 0.85);
            const pAtk = Math.round(
              (isPetMag
                ? (Number(b.INT) || 10) * petLvlScale * intMagAtkRatio
                : ((Number(b.STR) || 11) * strPhysAtkRatio + (Number(b.AGI) || 10) * agiPhysAtkRatio) * petLvlScale) * 0.90
            );
            const pDef = Math.round((Number(b.VIT) || 12) * petLvlScale * vitDefRatio * 0.85);
            const pMagDef = Math.round((Number(b.WIS) || 10) * petLvlScale * wisMagDefRatio * 0.85);
            return {
              id: `pet_${cp.id}`,
              name: cp.nickname || tpl?.code || `Pet #${idx + 1}`,
              level: pLv,
              assetFolder: folder,
              spriteKey: k,
              groundOffsetY: tpl?.groundOffsetY || 0,
              elementCode: cp.elementCode || 'NEUTRAL',
              raceCode: tpl?.raceCode || 'BEAST',
              style: (tpl?.combatStyle as any) || 'MELEE',
              range: tpl?.attackRange || 60,
              dmgType: isPetMag ? 'MAGICAL' : 'PHYSICAL',
              hp: pMaxHp,
              atk: pAtk,
              def: pDef,
              magDef: pMagDef,
              moveSpd: Number(cStats.BATTLE_MOVE_SPEED) || Math.round(playerMoveSpeed * 0.92),
              critRate: Math.min(0.80, (Number(cStats.CRIT_RATE) || 6) / 100),
              critDmg: Math.min(3.00, (Number(cStats.CRIT_DMG) || 150) / 100),
              attackSpeed: Number(cStats.ATTACK_SPEED) || 1.0,
              pAcc: Number(cStats.PHYS_ACCURACY) || 95,
              pEva: Number(cStats.PHYS_EVASION) || 5,
              mAcc: Number(cStats.MAG_ACCURACY) || 95,
              mEva: Number(cStats.MAG_EVASION) || 5,
            };
          })
        : [];

    rawPets.forEach((p: any, idx: number) => {
      petUnits.push({
        id: p.id,
        index: idx,
        name: p.name,
        level: p.level || charLevel,
        hp: p.hp,
        maxHp: p.hp,
        mp: Math.round(playerMaxMp * 0.50),
        maxMp: Math.round(playerMaxMp * 0.50),
        atk: p.atk,
        def: p.def,
        magDef: p.magDef,
        critRate: p.critRate,
        critDmg: p.critDmg,
        attackSpeed: p.attackSpeed,
        speed: Math.round(playerSpeed * 0.95),
        spriteKey: p.spriteKey,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/atlas.webp`,
        groundOffsetY: p.groundOffsetY,
        thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/thumb.webp`,
        elementCode: p.elementCode,
        raceCode: p.raceCode,
        combatStyle: p.style,
        attackRange: p.range,
        damageType: p.dmgType,
        basicAttackVfxKey: p.style === 'RANGED' ? '10002' : '10008',
        basicAttackVfxColorHex: p.style === 'RANGED' ? '#4ade80' : '#fde047',
        battleMoveSpeed: p.moveSpd,
        physAccuracy: Math.min(125, Math.max(20, p.pAcc)),
        physEvasion: Math.min(75, Math.max(0, p.pEva)),
        magAccuracy: Math.min(125, Math.max(20, p.mAcc)),
        magEvasion: Math.min(75, Math.max(0, p.mEva)),
        isAlive: true,
        activeStatuses: [],
      });
    });

    const [allSkills, allStatuses, allI18n] = await Promise.all([
      this.prisma.skillTemplate ? this.prisma.skillTemplate.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
      this.prisma.statusEffectTemplate ? this.prisma.statusEffectTemplate.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
    ]);

    const resolveIcon = (key?: string | null) =>
      key ? (key.startsWith('http') ? key : `${this.mcreworkPagesBaseUrl}/${key.replace(/^\/+/, '')}`) : `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100156.png`;

    const skillCatalog = (allSkills || []).map((sk: any) => ({
      ...sk,
      namePtBr: allI18n.get(sk.nameI18nKey) ?? sk.code,
      descriptionPtBr: sk.descriptionI18nKey ? (allI18n.get(sk.descriptionI18nKey) ?? '') : '',
      iconUrl: resolveIcon(sk.mcreworkIconKey),
      vfxThumbUrl: sk.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${sk.mcreworkVfxKey}/thumb.png` : '',
      vfxAtlasJsonUrl: sk.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${sk.mcreworkVfxKey}/atlas.json` : '',
      vfxAtlasWebpUrl: sk.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${sk.mcreworkVfxKey}/atlas.webp` : '',
    }));

    const statusCatalog = (allStatuses || []).map((st: any) => ({
      ...st,
      namePtBr: allI18n.get(st.nameI18nKey) ?? st.code,
      descriptionPtBr: st.descriptionI18nKey ? (allI18n.get(st.descriptionI18nKey) ?? '') : '',
      iconUrl: resolveIcon(st.iconKey),
      vfxThumbUrl: st.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${st.mcreworkVfxKey}/thumb.png` : '',
      vfxAtlasJsonUrl: st.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${st.mcreworkVfxKey}/atlas.json` : '',
      vfxAtlasWebpUrl: st.mcreworkVfxKey ? `${this.mcreworkPagesBaseUrl}/assets/effects/${st.mcreworkVfxKey}/atlas.webp` : '',
    }));

    const skillMap = new Map<number, any>(skillCatalog.map((s: any) => [Number(s.id), s]));
    const playerSkillIds: number[] = Array.isArray(playerUnit.skillIds) ? playerUnit.skillIds : [];
    const classSkills = playerSkillIds.map((sid) => skillMap.get(Number(sid))).filter(Boolean).slice(0, 4);

    const battleId = randomUUID();
    const state: TemporaryBattleState = {
      battleId,
      characterId: Number(characterId) || 1,
      createdAt: Date.now(),
      monsterTemplateId: primaryMonsterTemplateId,
      victoryRecorded: false,
      totalRealPlayers: 1,
      round: 1,
      player: playerUnit,
      pets: petUnits,
      monsters: monsterUnits,
      elementMatchups: scalingCtx.elementMatchups,
      classSkills,
      skillCatalog,
      statusCatalog,
      combatLog: [
        `⚔️ Batalha iniciada! [${charName}] (Nv.${charLevel} • ${charElementCode}) e aliados enfrentam ${monsterUnits.length} monstro(s)!`,
      ],
      isFinished: false,
      winner: null,
      lastEvents: [],
    };

    this.activeBattles.set(battleId, state);
    return state;
  }

  /**
   * Calcula a taxa de acerto efetiva delegando para a calculadora global compartilhada (@etheria/shared).
   */
  public calculateEffectiveHitRate(attackerAcc?: number, defenderEva?: number): number {
    return CombatDamageCalculator.calculateEffectiveHitRate(attackerAcc, defenderEva);
  }

  /**
   * Executa uma ação de combate no servidor utilizando exatamente a mesma fórmula global de dano + vantagens elementais.
   */
  public executeAction(
    battleId: string,
    actionType: 'ATTACK' | 'SKILL' | 'DEFEND',
    targetMonsterIndex: number = 0
  ): TemporaryBattleState {
    const battle = this.activeBattles.get(battleId);
    if (!battle) throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    if (battle.isFinished) return battle;

    const events: FloatingCombatNumber[] = [];
    const player = battle.player;
    let targetMob =
      battle.monsters.find((m) => m.index === Number(targetMonsterIndex) && m.isAlive) ||
      battle.monsters.find((m) => m.isAlive);

    if (!targetMob) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      return battle;
    }

    let isDefending = false;
    const elemTag = (rel: string) =>
      rel === 'ADVANTAGE' ? ' [Vantagem +25%]' : rel === 'DISADVANTAGE' || rel === 'NEUTRAL_PENALTY' ? ' [-25%]' : '';

    if (actionType === 'ATTACK' || actionType === 'SKILL') {
      const isSkill = actionType === 'SKILL';
      if (isSkill && player.mp >= 15) player.mp -= 15;

      const isMag = player.damageType === 'MAGICAL' || isSkill;
      const pAcc = (isMag ? (player.magAccuracy || 95) : (player.physAccuracy || 95)) + (isSkill ? 5 : 0);
      const mEva = isMag ? (targetMob.magEvasion || 5) : (targetMob.physEvasion || 5);
      const defStat = isMag ? (targetMob.magDef ?? targetMob.def) : targetMob.def;

      const dmgRes = CombatDamageCalculator.calculateHitDamage({
        attackerAtk: player.atk,
        attackerLevel: player.level,
        attackerElementCode: player.elementCode,
        attackerCritRate: (player.critRate || 0.1) + (isSkill ? 0.15 : 0),
        attackerCritDmg: player.critDmg || 1.6,
        attackerAccuracy: pAcc,
        defenderDef: defStat,
        defenderElementCode: targetMob.elementCode,
        defenderEvasion: mEva,
        skillMultiplier: isSkill ? 1.8 : 1.0,
        elementMatchups: battle.elementMatchups,
      });

      if (!dmgRes.isHit) {
        events.push({
          actor: 'player', targetType: 'monster', targetIndex: targetMob.index, type: 'MISS',
          animAction: isSkill ? 7 : 3, amount: 0, hpRemaining: targetMob.hp,
          message: `${player.name} errou o golpe contra ${targetMob.name} (DESVIO)!`,
        });
        battle.combatLog.unshift(`[${player.name}] errou [${targetMob.name}] (DESVIO)!`);
      } else {
        targetMob.hp = Math.max(0, targetMob.hp - dmgRes.finalDamage);
        if (targetMob.hp === 0) targetMob.isAlive = false;

        let burnDebuff: ActiveStatusInstance | null = null;
        if (isSkill && targetMob.isAlive) {
          burnDebuff = {
            code: 'status_burn', name: 'Queimadura Solar', isBuff: false,
            iconUrl: `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100180.png`,
            vfxKey: '10025', triggerType: 'CONTINUOUS_TICK',
            durationSeconds: 6.0, remainingSeconds: 6.0, remainingTurns: 3,
          };
          targetMob.activeStatuses = (targetMob.activeStatuses || []).filter((s) => s.code !== 'status_burn');
          targetMob.activeStatuses.push(burnDebuff);
        } else if (!targetMob.isAlive) {
          targetMob.activeStatuses = [];
        }

        const relTxt = elemTag(dmgRes.elementRelation);
        events.push({
          actor: 'player', targetType: 'monster', targetIndex: targetMob.index,
          type: dmgRes.isCrit ? 'CRIT' : 'DAMAGE', animAction: isSkill ? 7 : 3,
          vfxKey: isSkill ? '10025' : undefined, statusApplied: burnDebuff,
          amount: dmgRes.finalDamage, isCrit: dmgRes.isCrit, elementRelation: dmgRes.elementRelation,
          hpRemaining: targetMob.hp,
          message: `${player.name} causou ${dmgRes.finalDamage} de dano${dmgRes.isCrit ? ' CRÍTICO' : ''} em ${targetMob.name}${relTxt}!`,
        });
        battle.combatLog.unshift(
          `⚔️ [${player.name}] atingiu [${targetMob.name}]: -${dmgRes.finalDamage} HP${dmgRes.isCrit ? ' (💥 CRÍTICO!)' : ''}${relTxt}`
        );
        if (!targetMob.isAlive) battle.combatLog.unshift(`💀 [${targetMob.name}] foi derrotado!`);
      }
    } else if (actionType === 'DEFEND') {
      isDefending = true;
      const healAmount = Math.round(player.maxHp * 0.08);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      player.mp = Math.min(player.maxMp, player.mp + 15);
      const regenBuff: ActiveStatusInstance = {
        code: 'status_regen_blessing', name: 'Bênção Regenerativa', isBuff: true,
        iconUrl: `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100150.png`,
        vfxKey: '10004', triggerType: 'CONTINUOUS_TICK',
        durationSeconds: 5.0, remainingSeconds: 5.0, remainingTurns: 2,
      };
      player.activeStatuses = (player.activeStatuses || []).filter((s) => s.code !== 'status_regen_blessing');
      player.activeStatuses.push(regenBuff);
      const cleanseResult = this.cleanseUnitDebuffs(player, 0, 5, 100);
      events.push({
        actor: 'player', targetType: 'player', type: 'HEAL', animAction: 4, vfxKey: '10004',
        statusApplied: regenBuff, amount: healAmount + cleanseResult.healedHp, hpRemaining: player.hp,
        message: `${player.name} defendeu (+${healAmount + cleanseResult.healedHp} HP).`,
      });
    }

    let aliveMonsters = battle.monsters.filter((m) => m.isAlive);
    if (aliveMonsters.length === 0) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      const totalExp = battle.monsters.reduce((acc, m) => acc + m.level * 45, 0);
      const totalGold = battle.monsters.reduce((acc, m) => acc + Math.max(10, m.level * 18), 0);
      battle.rewards = { exp: totalExp, gold: totalGold };
      battle.combatLog.unshift(`VITÓRIA! Todos os monstros foram derrotados! (+${totalExp} EXP, +${totalGold} Ouro)`);
      battle.lastEvents = events;
      return battle;
    }

    const defMult = isDefending ? 1.5 : 1.0;
    for (const mob of aliveMonsters) {
      const isMag = mob.damageType === 'MAGICAL';
      const mobAcc = isMag ? (mob.magAccuracy || 95) : (mob.physAccuracy || 95);
      const pEva = isMag ? (player.magEvasion || 5) : (player.physEvasion || 5);
      const pDef = Math.round((isMag ? (player.magDef ?? player.def) : player.def) * defMult);

      const retRes = CombatDamageCalculator.calculateHitDamage({
        attackerAtk: mob.atk,
        attackerLevel: mob.level,
        attackerElementCode: mob.elementCode,
        attackerCritRate: mob.critRate || 0.08,
        attackerCritDmg: mob.critDmg || 1.5,
        attackerAccuracy: mobAcc,
        defenderDef: pDef,
        defenderElementCode: player.elementCode,
        defenderEvasion: pEva,
        elementMatchups: battle.elementMatchups,
      });

      if (!retRes.isHit) {
        events.push({
          actor: 'monster', actorIndex: mob.index, targetType: 'player', type: 'MISS',
          animAction: 3, amount: 0, hpRemaining: player.hp,
          message: `${mob.name} errou ${player.name} (💨 DESVIO)!`,
        });
        continue;
      }

      player.hp = Math.max(0, player.hp - retRes.finalDamage);
      if (player.hp === 0) player.isAlive = false;
      const relTxt = elemTag(retRes.elementRelation);
      events.push({
        actor: 'monster', actorIndex: mob.index, targetType: 'player',
        type: retRes.isCrit ? 'CRIT' : 'DAMAGE', animAction: 3,
        amount: retRes.finalDamage, isCrit: retRes.isCrit, elementRelation: retRes.elementRelation,
        hpRemaining: player.hp,
        message: `${mob.name} atacou ${player.name} causando ${retRes.finalDamage} de dano${relTxt}!`,
      });
      if (!player.isAlive) {
        battle.isFinished = true;
        battle.winner = 'MONSTERS';
        battle.combatLog.unshift(`[${player.name}] foi derrotado em combate!`);
        break;
      }
    }

    battle.round += 1;
    battle.lastEvents = events;
    return battle;
  }

  public autoResolve(battleId: string): TemporaryBattleState {
    const battle = this.activeBattles.get(battleId);
    if (!battle) throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    let iterations = 0;
    while (!battle.isFinished && iterations < 40) {
      iterations++;
      const aliveMobs = battle.monsters.filter((m) => m.isAlive);
      if (aliveMobs.length === 0) break;
      const useSkill = battle.player.mp >= 15 && Math.random() < 0.4;
      this.executeAction(battleId, useSkill ? 'SKILL' : 'ATTACK', aliveMobs[0].index);
    }
    return battle;
  }

  public cleanseUnitDebuffs(
    unit: CombatUnit,
    maxDebuffs: number = 0,
    healPerDebuffPct: number = 0,
    cleanseChancePct: number = 100
  ) {
    return CombatUtilityHelper.cleanseUnitDebuffs(unit, maxDebuffs, healPerDebuffPct, cleanseChancePct);
  }

  public buildDefeatedBatch(battle: TemporaryBattleState) {
    return CombatUtilityHelper.buildDefeatedBatch(battle);
  }

  public finalizeRealTimeVictory(battleId: string) {
    const battle = this.activeBattles.get(battleId);
    if (!battle || battle.victoryRecorded) return null;
    battle.victoryRecorded = true;
    battle.isFinished = true;
    battle.winner = 'PLAYER';
    for (const mob of battle.monsters) {
      mob.hp = 0;
      mob.isAlive = false;
    }
    const goldReward = battle.monsters.reduce((acc, m) => acc + Math.max(10, (m.level || 1) * 18), 0);
    return {
      characterId: Number(battle.characterId) || 1,
      defeatedMonsters: this.buildDefeatedBatch(battle),
      goldReward,
    };
  }

  public endBattle(battleId: string): boolean {
    return this.activeBattles.delete(battleId);
  }
}
