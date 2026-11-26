/**
 * @file apps/server/src/controllers/TemporaryCombatController.ts
 * @module @etheria/server
 * @description Módulo Unificado de Combate & Geração de Encontros (Batalha Real In-Game `/play` e Simulacro GM `/gm`).
 *   Tanto a batalha real nos mapas (`startEncounterByMap`) quanto a batalha invocada pelo GM (`startBattle`)
 *   utilizam exatamente os mesmos processadores (`MonsterCombatBuilder` e `CombatDamageCalculator`),
 *   sem redutores artificiais, com escalonamento balanceado de nível, buff A/S/SS e vantagens elementais.
 * @rules Segue estritamente AGENTS.md (Combate 100% autoritativo server-side, Zero Hardcode, Regra #7 < 1.000 linhas).
 * @dependencies @prisma/client, @etheria/database (I18nCache), @etheria/shared (CombatDamageCalculator), node:crypto, ./MapSpawnResolver.js, ./CombatUtilityHelper.js, ./MonsterCombatBuilder.js, ./MonsterGlobalConfigService.js, ./PartyService.js, ./CharacterPetService.js, ./CharacterEquipmentService.js, ./AssetMirrorService.js, ./CharacterActivityStateService.js, ./MapPresenceService.js, ./TemporaryCombatTypes.js, ./TemporaryCombatActionResolver.js
 */

import { PrismaClient, type MonsterTemplate } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CombatDamageCalculator, type ElementMatchupEntry } from '@etheria/shared';
import { randomUUID, randomBytes } from 'node:crypto';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { CombatUtilityHelper } from './CombatUtilityHelper.js';
import { MonsterCombatBuilder, type MonsterScalingContext, type MonsterVariantTier } from './MonsterCombatBuilder.js';
import { MonsterGlobalConfigService } from './MonsterGlobalConfigService.js';
import { PartyService } from './PartyService.js';
import { CharacterPetService } from './CharacterPetService.js';
import { CharacterEquipmentService, type EquippedWeaponVisualDto, type EquippedWingsVisualDto } from './CharacterEquipmentService.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import { CharacterActivityStateService } from './CharacterActivityStateService.js';
import { MapPresenceService } from './MapPresenceService.js';
import type {
  ActiveStatusInstance,
  CombatUnit,
  FloatingCombatNumber,
  TemporaryBattleState,
} from './TemporaryCombatTypes.js';
import { TemporaryCombatActionResolver } from './TemporaryCombatActionResolver.js';

export type {
  ActiveStatusInstance,
  CombatUnit,
  FloatingCombatNumber,
  TemporaryBattleState,
} from './TemporaryCombatTypes.js';

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
    const i18nMap = await I18nCache.getTranslations(this.prisma);

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
    preloadedCtx?: MonsterScalingContext,
    variantTier: MonsterVariantTier = 'NORMAL'
  ): Promise<TemporaryBattleState> {
    if (characterId > 0) {
      const charFlight = await this.prisma.playerCharacter.findUnique({ where: { id: Number(characterId) }, select: { isFlying: true } });
      if ((charFlight as any)?.isFlying) {
        throw new Error('Você precisa estar no chão para iniciar uma luta! Pouse sua montaria primeiro.');
      }
      if (CharacterActivityStateService.isFishing(characterId)) {
        throw new Error('Pare de pescar antes de entrar em combate.');
      }
    }
    const scalingCtx = preloadedCtx || (await MonsterCombatBuilder.loadScalingContext(this.prisma));

    if (customMonsterUnits && customMonsterUnits.length > 0) {
      return this.buildBattleInstance(characterId, Number(monsterTemplateId) || 1, customMonsterUnits, scalingCtx);
    }

    const qty = Math.max(1, Math.min(25, Number(quantity) || 1));
    const lvl = Math.max(1, Number(monsterLevel) || 1);

    const mobTemplate = await this.prisma.monsterTemplate.findUnique({
      where: { id: Number(monsterTemplateId) },
    });
    if (!mobTemplate) {
      throw new Error(`Monstro #${monsterTemplateId} não encontrado.`);
    }

    const i18nMap = await I18nCache.getTranslations(this.prisma);
    const mobBaseName = i18nMap.get(mobTemplate.nameI18nKey) || mobTemplate.code;
    const rTier = String(mobTemplate.rarityTier || 'F').toUpperCase();
    const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';
    const tagPrefix =
      variantTier === 'BOSS' ? '💀 [BOSS] ' : variantTier === 'LEADER' ? '👑 [LÍDER] ' : '';

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < qty; i++) {
      const displayName =
        qty > 1 ? `${tagPrefix}${mobBaseName} #${i + 1}${raritySuffix}` : `${tagPrefix}${mobBaseName}${raritySuffix}`;
      monsterUnits.push(
        MonsterCombatBuilder.buildMonsterUnit(
          mobTemplate,
          lvl,
          i,
          displayName,
          scalingCtx,
          this.mcreworkPagesBaseUrl,
          variantTier
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

    const party = PartyService.getPartyByCharacterId(characterId);
    const inParty = Boolean(party && party.members.length > 1);
    const maxAllowedPets = inParty ? 1 : 3;

    const pc = await this.prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      include: { pets: { include: { monsterTemplate: true } } },
    });
    if ((pc as any)?.isFlying) {
      throw new Error('Você precisa estar no chão antes de entrar em combate.');
    }
    if (CharacterActivityStateService.isFishing(characterId)) {
      throw new Error('Pare de pescar antes de entrar em combate.');
    }

    // Filtra apenas pets em formação (deploySlot 1..3 solo; deploySlot 1 em equipe) que não estejam inativados
    const activeDeployedPets = (pc?.pets || [])
      .filter((cp: any) => cp.deploySlot && (inParty ? Number(cp.deploySlot) === 1 : [1, 2, 3].includes(Number(cp.deploySlot))) && !CharacterPetService.isPetTemporarilyDisabled(cp.monsterTemplate))
      .slice(0, maxAllowedPets);
    const monsterCfg = await MonsterGlobalConfigService.ensureLoaded(this.prisma);
    const numPets = activeDeployedPets.length;
    const extraPartyMembers = inParty && party ? Math.max(0, party.members.length - 1) : 0;
    const extraAllies = numPets + extraPartyMembers;
    const baseSpan = Math.max(0, monsterCfg.encounterMaxMonsters - monsterCfg.encounterMinMonsters);
    let totalMonstersToSpawn = monsterCfg.encounterMinMonsters + Math.floor(Math.random() * (baseSpan + 1));
    const allySpan = Math.max(0, monsterCfg.encounterExtraPerAllyMax - monsterCfg.encounterExtraPerAllyMin);
    for (let i = 0; i < extraAllies; i++) {
      totalMonstersToSpawn += monsterCfg.encounterExtraPerAllyMin + Math.floor(Math.random() * (allySpan + 1));
    }
    totalMonstersToSpawn = Math.max(monsterCfg.encounterMinMonsters, Math.min(monsterCfg.encounterMaxTotalCap, totalMonstersToSpawn));

    const candidateTemplates = await MapSpawnResolver.findEligibleMonstersForMap<MonsterTemplate>(
      this.prisma,
      map
    );
    if (candidateTemplates.length === 0) {
      throw new Error(`Nenhum monstro permitido/ativo configurado para spawn no mapa #${map.id}.`);
    }

    const [i18nMap, scalingCtx] = await Promise.all([
      I18nCache.getTranslations(this.prisma),
      MonsterCombatBuilder.loadScalingContext(this.prisma),
    ]);

    // Regra de Hierarquia de Monstros no Encontro (BÁSICO / LÍDER / BOSS) e Sorteio Rank-First:
    const bossCfg = monsterCfg.variantConfigsJson.BOSS;
    const leaderCfg = monsterCfg.variantConfigsJson.LEADER;
    const hasBossInEncounter = Math.random() < (Number(bossCfg.spawnChancePct ?? 5) / 100);
    const bossSpawnIndex = hasBossInEncounter ? Math.floor(Math.random() * totalMonstersToSpawn) : -1;
    const canRollLeaderWithBoss = bossCfg.blocksLeaders === false;
    const leaderChance = Number(leaderCfg.spawnChancePct ?? 30) / 100;
    const maxLeaders = Number(leaderCfg.maxPerEncounter ?? 2);
    let leadersSpawnedCount = 0;

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < totalMonstersToSpawn; i++) {
      const tmpl = MonsterCombatBuilder.pickWeightedMonsterTemplate(candidateTemplates);
      const mobLvl = MonsterCombatBuilder.resolveBalancedMapMonsterLevel(
        map.requiredLevel || 1,
        map.levelVarianceMin,
        map.levelVarianceMax
      );
      const rTier = String(tmpl.rarityTier || 'F').toUpperCase();
      const baseName = i18nMap.get(tmpl.nameI18nKey) || tmpl.code;
      const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';

      let variantTier: MonsterVariantTier = 'NORMAL';
      if (hasBossInEncounter && i === bossSpawnIndex) {
        variantTier = 'BOSS';
      } else if ((!hasBossInEncounter || canRollLeaderWithBoss) && leadersSpawnedCount < maxLeaders && Math.random() < leaderChance) {
        variantTier = 'LEADER';
        leadersSpawnedCount += 1;
      }

      const tagPrefix =
        variantTier === 'BOSS' ? '💀 [BOSS] ' : variantTier === 'LEADER' ? '👑 [LÍDER] ' : '';
      const displayName = `${tagPrefix}${baseName} #${i + 1}${raritySuffix}`;

      monsterUnits.push(
        MonsterCombatBuilder.buildMonsterUnit(
          tmpl,
          mobLvl,
          i,
          displayName,
          scalingCtx,
          this.mcreworkPagesBaseUrl,
          variantTier
        )
      );
    }

    const firstTemplateId = Number(monsterUnits[0]?.monsterTemplateId || candidateTemplates[0]?.id || 1);
    return this.buildBattleInstance(characterId, firstTemplateId, monsterUnits, scalingCtx, Number(mapId));
  }

  /**
   * Montador único da instância de batalha (usado 100% igualmente por GM e Jogo Real).
   */
  private async buildBattleInstance(
    characterId: number,
    primaryMonsterTemplateId: number,
    monsterUnits: CombatUnit[],
    scalingCtx: MonsterScalingContext,
    mapId?: number
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
          pets: { include: { monsterTemplate: true } },
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
      ? await this.prisma.itemTemplate.findMany({
          where: { id: { in: eqItemIds } },
          include: { equipmentSet: true },
        })
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

    // Bônus de Conjuntos de Equipamentos (100% full = 100%, 50% half = 40%)
    const setPiecesCount = new Map<number, { set: any; count: number }>();
    for (const eq of eqItems) {
      if (eq.equipmentSet) {
        const setId = eq.equipmentSet.id;
        const entry = setPiecesCount.get(setId) || { set: eq.equipmentSet, count: 0 };
        entry.count += 1;
        setPiecesCount.set(setId, entry);
      }
    }
    for (const [, { set, count }] of setPiecesCount.entries()) {
      const minFull = set.minPiecesFull || 12;
      const minHalf = set.minPiecesHalf || 6;
      let ratio = 0;
      if (count >= minFull) {
        ratio = (set.fullBonusRatioPct ?? 100.0) / 100.0;
      } else if (count >= minHalf) {
        ratio = (set.halfBonusRatioPct ?? 40.0) / 100.0;
      }
      if (ratio > 0) {
        const stats = (set.bonusCombatStatsJson && typeof set.bonusCombatStatsJson === 'object'
          ? (set.bonusCombatStatsJson as Record<string, number>)
          : {}) as Record<string, number>;
        const ALLOWED_SET_STATS = new Set(['MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF']);
        for (const [k, v] of Object.entries(stats)) {
          const numVal = Number(v) || 0;
          if (ALLOWED_SET_STATS.has(k) && numVal !== 0) {
            eqBonuses[k] = (eqBonuses[k] || 0) + Math.round(numVal * ratio);
          }
        }
      }
    }

    const MAX_BATTLE_MOVE_SPEED = 185;
    const playerMoveSpeed = Math.max(
      60,
      Math.min(MAX_BATTLE_MOVE_SPEED, Math.round(classBaseSpeed + charBaseStats.AGI * agiMoveRatio + (eqBonuses.BATTLE_MOVE_SPEED || 0)))
    );

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

    const eqItemsById = new Map<number, any>(eqItems.map((eq) => [eq.id, eq]));
    const playerVisual = CharacterEquipmentService.resolveVisualAppearance(equippedMap, eqItemsById, charSpriteKey);

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
      equippedWings: playerVisual.equippedWings,
      equippedWeapon: playerVisual.equippedWeapon,
      isAlive: true,
      activeStatuses: [],
    };

    const [allSkills, allStatuses, allI18n] = await Promise.all([
      this.prisma.skillTemplate ? this.prisma.skillTemplate.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
      this.prisma.statusEffectTemplate ? this.prisma.statusEffectTemplate.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
      I18nCache.getTranslations(this.prisma),
    ]);

    const party = PartyService.getPartyByCharacterId(characterId);
    const inParty = Boolean(party && party.members.length > 1);
    const maxPets = inParty ? 1 : 3;

    const petUnits: CombatUnit[] = [];
    if (pc && pc.pets && pc.pets.length > 0) {
      const deployedPets = [...pc.pets]
        .filter((cp: any) => cp.deploySlot && (inParty ? Number(cp.deploySlot) === 1 : [1, 2, 3].includes(Number(cp.deploySlot))) && !CharacterPetService.isPetTemporarilyDisabled(cp.monsterTemplate))
        .sort((a: any, b: any) => Number(a.deploySlot) - Number(b.deploySlot))
        .slice(0, maxPets);

      deployedPets.forEach((cp: any, idx: number) => {
        const unit = CharacterPetService.buildPetCombatUnit(
          cp,
          idx,
          scalingCtx,
          this.mcreworkPagesBaseUrl,
          allI18n
        );
        if (unit) {
          petUnits.push(unit);
        }
      });
    }

    const resolveIcon = (key?: string | null) =>
      key ? AssetMirrorService.toSameOriginUrl(key) : `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100156.png`;

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
      battleNonce: randomBytes(16).toString('hex'),
      mapId: mapId || pc?.currentMapId || 1,
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
    const activeCharId = Number(state.characterId) || 0;
    if (activeCharId > 0) {
      CharacterActivityStateService.forceEnterCombat(activeCharId, battleId);
      MapPresenceService.setCombatStatus(activeCharId, true);
    }
    return state;
  }

  /**
   * Calcula a taxa de acerto efetiva delegando para a calculadora global compartilhada (@etheria/shared).
   */
  public calculateEffectiveHitRate(attackerAcc?: number, defenderEva?: number): number {
    return TemporaryCombatActionResolver.calculateEffectiveHitRate(attackerAcc, defenderEva);
  }

  /**
   * Executa uma ação de combate no servidor utilizando exatamente a mesma fórmula global de dano + vantagens elementais.
   */
  public executeAction(
    battleId: string,
    actionType: 'ATTACK' | 'SKILL' | 'DEFEND',
    targetMonsterIndex: number = 0
  ): TemporaryBattleState {
    return TemporaryCombatActionResolver.executeAction(
      this.activeBattles,
      this.mcreworkPagesBaseUrl,
      battleId,
      actionType,
      targetMonsterIndex
    );
  }

  public autoResolve(battleId: string): TemporaryBattleState {
    return TemporaryCombatActionResolver.autoResolve(this.activeBattles, this.mcreworkPagesBaseUrl, battleId);
  }

  public cleanseUnitDebuffs(
    unit: CombatUnit,
    maxDebuffs: number = 0,
    healPerDebuffPct: number = 0,
    cleanseChancePct: number = 100
  ) {
    return TemporaryCombatActionResolver.cleanseUnitDebuffs(unit, maxDebuffs, healPerDebuffPct, cleanseChancePct);
  }

  public buildDefeatedBatch(battle: TemporaryBattleState) {
    return TemporaryCombatActionResolver.buildDefeatedBatch(battle);
  }

  public finalizeRealTimeVictory(battleId: string) {
    return TemporaryCombatActionResolver.finalizeRealTimeVictory(this.activeBattles, battleId);
  }

  public getBattleState(battleId: string): TemporaryBattleState | null {
    return this.activeBattles.get(battleId) ?? null;
  }

  public async createDungeonBattleInstance(opts: {
    characterId: number;
    dungeonMapId: number;
    dungeonRunId: number;
    monsterUnits: CombatUnit[];
    scalingCtx: MonsterScalingContext;
    mapWidth: number;
    mapHeight: number;
    playerStartX: number;
    playerStartY: number;
  }): Promise<TemporaryBattleState> {
    const firstMobId = Number(opts.monsterUnits[0]?.monsterTemplateId || 1);
    const state = await this.buildBattleInstance(
      opts.characterId,
      firstMobId,
      opts.monsterUnits,
      opts.scalingCtx,
      opts.dungeonMapId
    );
    state.isDungeon = true;
    state.dungeonRunId = opts.dungeonRunId;
    state.dungeonMapId = opts.dungeonMapId;
    state.mapWidth = opts.mapWidth;
    state.mapHeight = opts.mapHeight;
    state.playerStartX = opts.playerStartX;
    state.playerStartY = opts.playerStartY;
    return state;
  }

  public endBattle(battleId: string): boolean {
    const b = this.activeBattles.get(battleId);
    const deleted = this.activeBattles.delete(battleId);
    if (b) {
      CharacterActivityStateService.exitCombat(Number(b.characterId), battleId);
      MapPresenceService.setCombatStatus(Number(b.characterId), false);
    }
    return deleted;
  }

  public endActiveBattlesForCharacter(characterId: number): number {
    const cid = Number(characterId);
    let removed = 0;
    for (const [id, b] of this.activeBattles.entries()) {
      if (Number(b.characterId) === cid && (!b.isDungeon || b.isFinished)) {
        this.activeBattles.delete(id);
        removed++;
      }
    }
    CharacterActivityStateService.exitCombat(cid);
    MapPresenceService.setCombatStatus(cid, false);
    return removed;
  }
}
