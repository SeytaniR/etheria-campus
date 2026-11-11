/**
 * @file apps/server/src/controllers/TemporaryCombatController.ts
 * @module @etheria/server
 * @description MÓDULO TEMPORÁRIO DE COMBATE E SIMULAÇÃO DE BATALHA GM.
 *   AVISO: Este módulo foi estruturado de forma 100% isolada e modular para que possa
 *   ser facilmente substituído ou excluído quando a arena tática definitiva e o sistema
 *   de combate por turnos final forem implementados.
 */

import { PrismaClient, type MonsterTemplate } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { randomUUID } from 'node:crypto';
import { MapSpawnResolver } from './MapSpawnResolver.js';

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
  index: number;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  magDef?: number;
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
  combatStyle?: 'MELEE' | 'RANGED';
  attackRange?: number;
  damageType?: 'PHYSICAL' | 'MAGICAL';
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
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
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
   * Inicia uma nova batalha temporária simulada com o monstro e quantidade escolhidos pelo GM.
   */
  public async startBattle(
    characterId: number,
    monsterTemplateId: number,
    quantity: number = 1,
    monsterLevel: number = 1,
    customMonsterUnits?: CombatUnit[]
  ): Promise<TemporaryBattleState> {
    const qty = Math.max(1, Math.min(5, Number(quantity) || 1));
    const lvl = Math.max(1, Math.min(100, Number(monsterLevel) || 1));

    // Carrega dados do monstro
    const mobTemplate = await this.prisma.monsterTemplate.findUnique({
      where: { id: Number(monsterTemplateId) },
    });

    if (!mobTemplate) {
      throw new Error(`Monstro #${monsterTemplateId} não encontrado.`);
    }

    // Busca nome traduzido
    const nameTrans = await this.prisma.i18nTranslation.findUnique({
      where: { key_locale: { key: mobTemplate.nameI18nKey, locale: 'pt-BR' } },
    });
    const mobBaseName = nameTrans?.text || mobTemplate.code;

    // Carrega dados do personagem do jogador
    let charName = 'Heroi';
    let charLevel = 1;
    let charSpriteKey = 'char1_a';
    let charGroundOffsetY = 0;
    let charElementCode = 'NEUTRAL';
    let charBaseStats = { VIT: 15, STR: 14, INT: 10, WIS: 10, AGI: 12, DEX: 12 };

    let pc: any = null;
    if (characterId) {
      pc = await this.prisma.playerCharacter.findUnique({
        where: { id: Number(characterId) },
        include: { classTemplate: true, pets: { take: 3, include: { monsterTemplate: true, petTemplate: true } } },
      });
      if (pc) {
        charName = pc.name;
        charLevel = pc.level || 1;
        charElementCode = pc.elementCode || 'NEUTRAL';
        const ct = pc.classTemplate;
        if (ct) {
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

    const charThumb = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/thumb.webp`;
    const charAtlasJson = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.json`;
    const charAtlasWebp = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.webp`;

    // Carrega matriz de conversões do banco de dados (attribute_conversions)
    const convs = await this.prisma.attributeConversion.findMany();
    const getRatio = (baseAttr: string, combatAttr: string, fallback: number) => {
      const match = convs.find((c) => c.baseAttributeCode === baseAttr && c.combatAttributeCode === combatAttr);
      return match ? Number(match.ratioPerPoint) : fallback;
    };
    const vitHpRatio = getRatio('VIT', 'MAX_HP', 25);
    const intMpRatio = getRatio('INT', 'MAX_MP', 15);
    const strAtkRatio = getRatio('STR', 'PHYS_ATK', 3.2);
    const vitDefRatio = getRatio('VIT', 'PHYS_DEF', 1.8);
    const wisMagDefRatio = getRatio('WIS', 'MAG_DEF', 1.8);
    const agiSpdRatio = getRatio('AGI', 'SPEED', 2.0);
    const agiMoveRatio = getRatio('AGI', 'BATTLE_MOVE_SPEED', 0.5);

    // Velocidade de Movimento em Batalha autoritária (lê de combat_attributes e class_templates)
    const battleMoveAttr = await this.prisma.combatAttribute.findUnique({ where: { code: 'BATTLE_MOVE_SPEED' } });
    const globalDefaultSpeed = Number(battleMoveAttr?.baseDefault) || 180;
    const classBaseSpeed = Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.BATTLE_MOVE_SPEED) || globalDefaultSpeed;
    const playerMoveSpeed = Math.round(classBaseSpeed + charBaseStats.AGI * agiMoveRatio);

    // Calcula Atributos do Personagem (100% dinâmicos do banco)
    const playerMaxHp = Math.round(charBaseStats.VIT * vitHpRatio + charLevel * 20);
    const playerMaxMp = Math.round(charBaseStats.INT * intMpRatio + charLevel * 10);
    const playerAtk = Math.round(charBaseStats.STR * strAtkRatio + charLevel * 4);
    const playerDef = Math.round(charBaseStats.VIT * vitDefRatio + charLevel * 2.5);
    const playerMagDef = Math.round(charBaseStats.WIS * wisMagDefRatio + charLevel * 2.0);
    const playerSpeed = Math.round(charBaseStats.AGI * agiSpdRatio + charLevel);

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
      def: playerDef,
      magDef: playerMagDef,
      critRate: Math.min(0.80, (Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.CRIT_RATE) || 5) / 100),
      critDmg: Math.min(3.00, (Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.CRIT_DMG) || 150) / 100),
      attackSpeed: Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.ATTACK_SPEED) || 1.0,
      speed: playerSpeed,
      battleMoveSpeed: playerMoveSpeed,
      spriteKey: charSpriteKey,
      atlasJsonUrl: charAtlasJson,
      atlasWebpUrl: charAtlasWebp,
      groundOffsetY: charGroundOffsetY,
      thumbUrl: charThumb,
      elementCode: charElementCode,
      raceCode: 'HUMAN',
      combatStyle: (pc?.classTemplate?.combatStyle as any) || 'MELEE',
      attackRange: pc?.classTemplate?.attackRange || 60,
      damageType: (pc?.classTemplate?.damageType as any) || 'PHYSICAL',
      physAccuracy: Math.min(125, Math.max(20, Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.PHYS_ACCURACY) || 95)),
      physEvasion: Math.min(75, Math.max(0, Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.PHYS_EVASION) || 5)),
      magAccuracy: Math.min(125, Math.max(20, Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.MAG_ACCURACY) || 95)),
      magEvasion: Math.min(75, Math.max(0, Number((pc?.classTemplate as any)?.baseCombatAttributesJson?.MAG_EVASION) || 5)),
      isAlive: true,
      activeStatuses: [],
    };

    // Pets que acompanham o jogador em combate (2 a 3 pets)
    const petUnits: CombatUnit[] = [];
    const rawPets = (pc && pc.pets && pc.pets.length > 0)
      ? pc.pets.slice(0, 3).map((cp: any, idx: number) => {
          const tpl = cp.petTemplate || cp.monsterTemplate;
          const k = cp.petTemplate?.mcreworkPetKey || cp.monsterTemplate?.mcreworkMonsterKey || 'creature_000001';
          const assetFolder = cp.petTemplate?.mcreworkPetKey ? 'pets' : 'monsters';
          const bStats = (tpl?.baseAttributesJson as any) || null;
          const cStats = (tpl?.baseCombatAttributesJson as any) || {};
          const pLvl = cp.level || charLevel;
          const pMaxHp = bStats ? Math.round((Number(bStats.VIT) || 12) * (vitHpRatio * 0.72) + pLvl * 16) : Math.round(playerMaxHp * 0.65);
          const pAtk = bStats ? Math.round(Math.max(Number(bStats.STR) || 10, Number(bStats.INT) || 10) * (strAtkRatio * 0.75) + pLvl * 3.0) : Math.round(playerAtk * 0.60);
          const pDef = bStats ? Math.round((Number(bStats.VIT) || 10) * (vitDefRatio * 0.72) + pLvl * 2.0) : Math.round(playerDef * 0.65);
          const pMagDef = bStats ? Math.round((Number(bStats.WIS) || 10) * (wisMagDefRatio * 0.72) + pLvl * 1.8) : Math.round(playerMagDef * 0.65);
          return {
            id: `pet_${cp.id}_${idx}`, name: cp.nickname || `Pet #${idx + 1}`, level: pLvl, assetFolder,
            spriteKey: k, groundOffsetY: tpl?.groundOffsetY || 0, elementCode: cp.elementCode || 'NEUTRAL',
            style: (tpl?.combatStyle as any) || 'MELEE', range: tpl?.attackRange || 60, dmgType: (tpl?.damageType as any) || 'PHYSICAL',
            hp: pMaxHp, atk: pAtk, def: pDef, magDef: pMagDef,
            moveSpd: Number(cStats.BATTLE_MOVE_SPEED) || Math.round(playerMoveSpeed * 0.90),
            critRate: Math.min(0.80, (Number(cStats.CRIT_RATE) || 5) / 100), critDmg: Math.min(3.00, (Number(cStats.CRIT_DMG) || 150) / 100),
            attackSpeed: Number(cStats.ATTACK_SPEED) || 1.0,
            pAcc: Number(cStats.PHYS_ACCURACY) || 95, pEva: Number(cStats.PHYS_EVASION) || 5,
            mAcc: Number(cStats.MAG_ACCURACY) || 95, mEva: Number(cStats.MAG_EVASION) || 5,
          };
        })
      : [
          { id: 'pet_comp_0', name: 'Lobo Guardião (Pet)', level: charLevel, assetFolder: 'monsters', spriteKey: 'creature_000001', groundOffsetY: 0, elementCode: 'NEUTRAL', style: 'MELEE', range: 60, dmgType: 'PHYSICAL', hp: Math.round(playerMaxHp * 0.72), atk: Math.round(playerAtk * 0.55), def: Math.round(playerDef * 0.85), magDef: Math.round(playerMagDef * 0.75), moveSpd: Math.round(playerMoveSpeed * 0.92), critRate: 0.06, critDmg: 1.5, attackSpeed: 1.0, pAcc: 95, pEva: 5, mAcc: 95, mEva: 5 },
          { id: 'pet_comp_1', name: 'Grifo Protetor (Pet)', level: charLevel, assetFolder: 'monsters', spriteKey: 'creature_000002', groundOffsetY: 0, elementCode: 'NEUTRAL', style: 'RANGED', range: 220, dmgType: 'MAGICAL', hp: Math.round(playerMaxHp * 0.52), atk: Math.round(playerAtk * 0.72), def: Math.round(playerDef * 0.50), magDef: Math.round(playerMagDef * 0.65), moveSpd: Math.round(playerMoveSpeed * 0.95), critRate: 0.12, critDmg: 1.6, attackSpeed: 1.05, pAcc: 95, pEva: 8, mAcc: 95, mEva: 8 },
        ];

    rawPets.forEach((p: any, idx: number) => {
      petUnits.push({
        id: p.id, index: idx, name: p.name, level: p.level || charLevel,
        hp: p.hp, maxHp: p.hp, mp: Math.round(playerMaxMp * 0.50), maxMp: Math.round(playerMaxMp * 0.50),
        atk: p.atk, def: p.def, magDef: p.magDef, critRate: p.critRate, critDmg: p.critDmg, attackSpeed: p.attackSpeed,
        speed: Math.round(playerSpeed * 0.95), spriteKey: p.spriteKey,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/atlas.webp`,
        groundOffsetY: p.groundOffsetY, thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/${p.assetFolder}/${p.spriteKey}/thumb.webp`,
        elementCode: p.elementCode, raceCode: 'BEAST', combatStyle: p.style, attackRange: p.range,
        damageType: p.dmgType, battleMoveSpeed: p.moveSpd,
        physAccuracy: Math.min(125, Math.max(20, p.pAcc)), physEvasion: Math.min(75, Math.max(0, p.pEva)),
        magAccuracy: Math.min(125, Math.max(20, p.mAcc)), magEvasion: Math.min(75, Math.max(0, p.mEva)),
        isAlive: true, activeStatuses: [],
      });
    });

    // Calcula Atributos do Monstro (escalonados por nível; o Rank SS..F é mantido apenas como registro por ora)
    const mobStats = (mobTemplate.baseAttributesJson as any) || { VIT: 12, STR: 12, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
    const rarityMult = 1.0;

    const mobMaxHp = Math.round((mobStats.VIT * (vitHpRatio * 0.8) + lvl * 18) * rarityMult);
    const mobMaxMp = Math.round((mobStats.INT * (intMpRatio * 0.7) + lvl * 8) * rarityMult);
    const mobAtk = Math.round((mobStats.STR * (strAtkRatio * 0.82) + lvl * 3.2) * rarityMult);
    const mobDef = Math.round((mobStats.VIT * (vitDefRatio * 0.78) + lvl * 2.0) * rarityMult);
    const mobSpeed = Math.round((mobStats.AGI * (agiSpdRatio * 0.9) + lvl) * rarityMult);
    const mobMoveSpeed = Math.round(globalDefaultSpeed * 0.70 + mobStats.AGI * 0.35);
    const mobKey = mobTemplate.mcreworkMonsterKey;
    const mobThumb = `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/thumb.webp`;
    const mobAtlasJson = `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.json`;
    const mobAtlasWebp = `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.webp`;

    const monsterUnits: CombatUnit[] = (customMonsterUnits && customMonsterUnits.length > 0)
      ? customMonsterUnits
      : [];

    if (monsterUnits.length === 0) {
      for (let i = 0; i < qty; i++) {
        monsterUnits.push({
          id: `mob_${mobTemplate.id}_${i}`, index: i, name: qty > 1 ? `${mobBaseName} #${i + 1}` : mobBaseName, level: lvl,
          hp: mobMaxHp, maxHp: mobMaxHp, mp: mobMaxMp, maxMp: mobMaxMp, atk: mobAtk, def: mobDef,
          magDef: Math.round((Number(mobStats.WIS) || 10) * (wisMagDefRatio * 0.72) + lvl * 1.8),
          critRate: Math.min(0.80, (Number((mobTemplate as any)?.baseCombatAttributesJson?.CRIT_RATE) || 5) / 100),
          critDmg: Math.min(3.00, (Number((mobTemplate as any)?.baseCombatAttributesJson?.CRIT_DMG) || 150) / 100),
          attackSpeed: Number((mobTemplate as any)?.baseCombatAttributesJson?.ATTACK_SPEED) || 1.0, speed: mobSpeed,
          battleMoveSpeed: mobMoveSpeed, spriteKey: mobKey, atlasJsonUrl: mobAtlasJson, atlasWebpUrl: mobAtlasWebp,
          groundOffsetY: mobTemplate.groundOffsetY || 0, thumbUrl: mobThumb,
          elementCode: mobTemplate.fixedElementCode || 'NEUTRAL', raceCode: mobTemplate.raceCode || 'BEAST',
          combatStyle: (mobTemplate.combatStyle as any) || 'MELEE', attackRange: mobTemplate.attackRange || 60,
          damageType: (mobTemplate.damageType as any) || 'PHYSICAL',
          physAccuracy: Math.min(125, Math.max(20, Number((mobTemplate as any)?.baseCombatAttributesJson?.PHYS_ACCURACY) || 95)),
          physEvasion: Math.min(75, Math.max(0, Number((mobTemplate as any)?.baseCombatAttributesJson?.PHYS_EVASION) || 5)),
          magAccuracy: Math.min(125, Math.max(20, Number((mobTemplate as any)?.baseCombatAttributesJson?.MAG_ACCURACY) || 95)),
          magEvasion: Math.min(75, Math.max(0, Number((mobTemplate as any)?.baseCombatAttributesJson?.MAG_EVASION) || 5)),
          isAlive: true, activeStatuses: [],
        });
      }
    }

    const battleId = randomUUID();
    const state: TemporaryBattleState = {
      battleId,
      characterId: Number(characterId) || 1,
      createdAt: Date.now(),
      monsterTemplateId: Number(mobTemplate.id),
      victoryRecorded: false,
      totalRealPlayers: 1,
      round: 1,
      player: playerUnit,
      pets: petUnits,
      monsters: monsterUnits,
      combatLog: [
        `⚔️ Batalha iniciada! [${charName}] (Nv.${charLevel}) e aliados enfrentam ${monsterUnits.length} monstro(s)!`,
      ],
      isFinished: false,
      winner: null,
      lastEvents: [],
    };

    this.activeBattles.set(battleId, state);
    return state;
  }

  /**
   * Sorteia um encontro de monstros autoritário para a Arena de Ação:
   * - Desacoplado de biomas: utiliza exclusivamente os Tipos de Monstros (raças) e Monstros Individuais configurados no mapa.
   * - Quantidade: Aleatório de 1 a 5 monstros para cada combatente aliado na equipe (jogador + pets).
   * - Probabilidade por Raridade: Sorteio ponderado onde SS é muito difícil (mítico/chefe), S é difícil, A é raro, e C/D/F são comuns.
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

    // 1. Carrega personagem e equipe de pets para contar combatentes aliados
    const pc = await this.prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      include: {
        pets: { take: 3, include: { monsterTemplate: true } },
      },
    });

    const alliesCount = 1 + (pc && pc.pets && pc.pets.length > 0 ? pc.pets.length : 2);

    // 2. Sorteia quantidade total: de 1 a 5 monstros para CADA jogador ou pet na equipe
    let totalMonstersToSpawn = 0;
    for (let i = 0; i < alliesCount; i++) {
      totalMonstersToSpawn += Math.floor(Math.random() * 5) + 1; // 1 a 5 por aliado
    }
    // Teto de segurança operacional na arena (ex: até 15 monstros simultâneos)
    totalMonstersToSpawn = Math.min(15, totalMonstersToSpawn);

    // 3. Obtém o pool estrito de monstros elegíveis do mapa (Raças + Individuais mesmo fora da raça), sem fallback global
    const candidateTemplates = await MapSpawnResolver.findEligibleMonstersForMap<MonsterTemplate>(
      this.prisma,
      map,
    );

    if (candidateTemplates.length === 0) {
      throw new Error(`Nenhum monstro permitido/ativo configurado para spawn no mapa #${map.id}.`);
    }

    // 4. Mapeamento de traduções i18n dos monstros
    const translations = await this.prisma.i18nTranslation.findMany({
      where: {
        key: { in: candidateTemplates.map((t) => t.nameI18nKey) },
        locale: 'pt-BR',
      },
    });
    const i18nMap = new Map(translations.map((t) => [t.key, t.text]));

    // 5. Pesos de spawn por Raridade: SS muito difícil, S difícil, A raro, B/C/D/F comuns
    const rarityWeights: Record<string, number> = {
      SS: 1,     // Muito Difícil (~0.5%)
      S: 4,      // Difícil (~1.5%)
      A: 15,     // Raro / Normal Alto (~6%)
      B: 35,     // Normal Médio (~15%)
      C: 70,     // Normal (~30%)
      D: 110,    // Comum
      F: 140,    // Muito Comum
      COMMON: 140,
    };

    const rarityStatMults: Record<string, { hp: number; atk: number; def: number }> = {
      SS: { hp: 2.2, atk: 1.5, def: 1.3 },
      S: { hp: 1.6, atk: 1.3, def: 1.2 },
      A: { hp: 1.25, atk: 1.15, def: 1.1 },
      B: { hp: 1.1, atk: 1.05, def: 1.0 },
      C: { hp: 1.0, atk: 1.0, def: 1.0 },
      D: { hp: 0.9, atk: 0.9, def: 0.9 },
      F: { hp: 0.85, atk: 0.85, def: 0.85 },
      COMMON: { hp: 0.85, atk: 0.85, def: 0.85 },
    };

    const pickWeightedCandidate = () => {
      let totalW = 0;
      const weights = candidateTemplates.map((c) => {
        const w = rarityWeights[c.rarityTier?.toUpperCase()] || 100;
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

    // 6. Calcula variação de nível do mapa
    const minVar = map.levelVarianceMin ?? -2;
    const maxVar = map.levelVarianceMax ?? 5;
    const varRange = Math.max(0, maxVar - minVar);

    // 7. Constrói a lista heterogênea de monstros sorteados (com conversões procedurais do banco)
    const convs = await this.prisma.attributeConversion.findMany();
    const getRatio = (baseAttr: string, combatAttr: string, fallback: number) => {
      const match = convs.find((c) => c.baseAttributeCode === baseAttr && c.combatAttributeCode === combatAttr);
      return match ? Number(match.ratioPerPoint) : fallback;
    };
    const vitHpRatio = getRatio('VIT', 'MAX_HP', 25);
    const intMpRatio = getRatio('INT', 'MAX_MP', 15);
    const strAtkRatio = getRatio('STR', 'PHYS_ATK', 3.2);
    const vitDefRatio = getRatio('VIT', 'PHYS_DEF', 1.8);
    const wisMagDefRatio = getRatio('WIS', 'MAG_DEF', 1.8);
    const agiSpdRatio = getRatio('AGI', 'SPEED', 2.0);
    const agiMoveRatio = getRatio('AGI', 'BATTLE_MOVE_SPEED', 0.5);
    const battleMoveAttr = await this.prisma.combatAttribute.findUnique({ where: { code: 'BATTLE_MOVE_SPEED' } });
    const globalDefaultSpeed = Number(battleMoveAttr?.baseDefault) || 180;

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < totalMonstersToSpawn; i++) {
      const tmpl = pickWeightedCandidate();
      const variance = minVar + Math.floor(Math.random() * (varRange + 1));
      const mobLvl = Math.max(1, Math.min(100, (map.requiredLevel || 1) + variance));

      const rTier = (tmpl.rarityTier || 'F').toUpperCase();
      const mult = rarityStatMults[rTier] || { hp: 1.0, atk: 1.0, def: 1.0 };
      const mobStats = (tmpl.baseAttributesJson as any) || { VIT: 12, STR: 12, INT: 10, WIS: 10, AGI: 10, DEX: 10 };

      const mobMaxHp = Math.round((mobStats.VIT * (vitHpRatio * 0.8) + mobLvl * 18) * mult.hp);
      const mobMaxMp = Math.round((mobStats.INT * (intMpRatio * 0.7) + mobLvl * 8) * mult.hp);
      const mobAtk = Math.round((mobStats.STR * (strAtkRatio * 0.82) + mobLvl * 3.2) * mult.atk);
      const mobDef = Math.round((mobStats.VIT * (vitDefRatio * 0.78) + mobLvl * 2.0) * mult.def);
      const mobSpeed = Math.round(mobStats.AGI * (agiSpdRatio * 0.9) + mobLvl);
      const mobMoveSpeed = Math.round(globalDefaultSpeed * 0.70 + mobStats.AGI * 0.35);

      const baseName = i18nMap.get(tmpl.nameI18nKey) || tmpl.code;
      const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';
      const mobKey = tmpl.mcreworkMonsterKey;

      monsterUnits.push({
        id: `mob_${tmpl.id}_${i}`, index: i, name: `${baseName} #${i + 1}${raritySuffix}`, level: mobLvl,
        hp: mobMaxHp, maxHp: mobMaxHp, mp: mobMaxMp, maxMp: mobMaxMp, atk: mobAtk, def: mobDef,
        magDef: Math.round((Number(mobStats.WIS) || 10) * (wisMagDefRatio * 0.72) + mobLvl * 1.8),
        critRate: Math.min(0.80, (Number((tmpl as any)?.baseCombatAttributesJson?.CRIT_RATE) || 5) / 100),
        critDmg: Math.min(3.00, (Number((tmpl as any)?.baseCombatAttributesJson?.CRIT_DMG) || 150) / 100),
        attackSpeed: Number((tmpl as any)?.baseCombatAttributesJson?.ATTACK_SPEED) || 1.0, speed: mobSpeed,
        battleMoveSpeed: mobMoveSpeed, spriteKey: mobKey,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.webp`,
        groundOffsetY: tmpl.groundOffsetY || 0, thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/thumb.webp`,
        elementCode: tmpl.fixedElementCode || 'NEUTRAL', raceCode: tmpl.raceCode || 'BEAST',
        combatStyle: (tmpl.combatStyle as any) || 'MELEE', attackRange: tmpl.attackRange || 60, damageType: (tmpl.damageType as any) || 'PHYSICAL',
        physAccuracy: Math.min(125, Math.max(20, Number((tmpl as any)?.baseCombatAttributesJson?.PHYS_ACCURACY) || 95)),
        physEvasion: Math.min(75, Math.max(0, Number((tmpl as any)?.baseCombatAttributesJson?.PHYS_EVASION) || 5)),
        magAccuracy: Math.min(125, Math.max(20, Number((tmpl as any)?.baseCombatAttributesJson?.MAG_ACCURACY) || 95)),
        magEvasion: Math.min(75, Math.max(0, Number((tmpl as any)?.baseCombatAttributesJson?.MAG_EVASION) || 5)),
        isAlive: true, activeStatuses: [],
      });
    }

    const firstTemplateId = monsterUnits[0] ? Number(candidateTemplates[0]?.id || 1) : 1;
    return this.startBattle(characterId, firstTemplateId, monsterUnits.length, map.requiredLevel, monsterUnits);
  }

  /**
   * Calcula a taxa de acerto efetiva entre atacante e defensor:
   * - Teto de Desvio: 75% (ninguém é inalvejável).
   * - Teto de Precisão em Atributos: 125%.
   * - Teto de Acerto em Combate: 95% (zero acerto perfeito; sempre há pelo menos 5% de chance de erro/desvio).
   * - Piso de Acerto em Combate: 10% (sempre há pelo menos 10% de chance de conectar; ninguém é inalvejável).
   */
  public calculateEffectiveHitRate(attackerAcc?: number, defenderEva?: number): number {
    const acc = Number(attackerAcc) <= 1.5 ? Number(attackerAcc) * 100 : Number(attackerAcc);
    const eva = Number(defenderEva) <= 1.5 ? Number(defenderEva) * 100 : Number(defenderEva);
    const clampedEva = Math.min(75, Math.max(0, eva || 0));
    const clampedAcc = Math.min(125, Math.max(20, acc || 95));
    return Math.max(10, Math.min(95, clampedAcc - clampedEva));
  }

  /**
   * Executa uma ação de combate escolhida pelo jogador no turno atual.
   */
  public executeAction(
    battleId: string,
    actionType: 'ATTACK' | 'SKILL' | 'DEFEND',
    targetMonsterIndex: number = 0
  ): TemporaryBattleState {
    const battle = this.activeBattles.get(battleId);
    if (!battle) {
      throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    }

    if (battle.isFinished) {
      return battle;
    }

    const events: FloatingCombatNumber[] = [];
    const player = battle.player;
    let targetMob = battle.monsters.find((m) => m.index === Number(targetMonsterIndex) && m.isAlive);

    // Se o alvo selecionado já estiver morto, mira no primeiro vivo
    if (!targetMob) {
      targetMob = battle.monsters.find((m) => m.isAlive);
    }

    if (!targetMob) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      return battle;
    }

    let isDefending = false;

    // 1. AÇÃO DO JOGADOR
    if (actionType === 'ATTACK') {
      const isMag = player.damageType === 'MAGICAL';
      const pAcc = isMag ? (player.magAccuracy || 95) : (player.physAccuracy || 95);
      const mEva = isMag ? (targetMob.magEvasion || 5) : (targetMob.physEvasion || 5);
      const hitChance = this.calculateEffectiveHitRate(pAcc, mEva);
      const isHit = Math.random() * 100 <= hitChance;

      if (!isHit) {
        events.push({
          actor: 'player',
          targetType: 'monster',
          targetIndex: targetMob.index,
          type: 'MISS',
          animAction: 3,
          amount: 0,
          hpRemaining: targetMob.hp,
          message: `${player.name} atacou ${targetMob.name}, mas errou o golpe (💨 DESVIO)!`,
        });
        battle.combatLog.unshift(`💨 [${player.name}] atacou [${targetMob.name}], mas o golpe errou (💨 DESVIO)!`);
      } else {
        const isCrit = Math.random() < 0.2; // 20% crit rate
        const variance = 0.9 + Math.random() * 0.2;
        let rawDmg = Math.round(player.atk * variance - targetMob.def * 0.4);
        if (isCrit) rawDmg = Math.round(rawDmg * 1.6);
        const dmg = Math.max(5, rawDmg);

        targetMob.hp = Math.max(0, targetMob.hp - dmg);
        if (targetMob.hp === 0) targetMob.isAlive = false;

        events.push({
          actor: 'player',
          targetType: 'monster',
          targetIndex: targetMob.index,
          type: isCrit ? 'CRIT' : 'DAMAGE',
          animAction: 3,
          amount: dmg,
          isCrit,
          hpRemaining: targetMob.hp,
          message: `${player.name} desferiu um Golpe ${isCrit ? 'CRÍTICO ' : ''}em ${targetMob.name} causando ${dmg} de Dano!`,
        });

        battle.combatLog.unshift(
          `🗡️ [${player.name}] atacou [${targetMob.name}] causando ${dmg} de dano${isCrit ? ' (💥 CRÍTICO!)' : ''}!`
        );

        if (!targetMob.isAlive) {
          battle.combatLog.unshift(`💀 [${targetMob.name}] foi derrotado!`);
        }
      }
    } else if (actionType === 'SKILL') {
      const mpCost = 15;
      if (player.mp >= mpCost) {
        player.mp -= mpCost;
      }
      const isMag = player.damageType === 'MAGICAL';
      const pAcc = (isMag ? (player.magAccuracy || 95) : (player.physAccuracy || 95)) + 5;
      const mEva = isMag ? (targetMob.magEvasion || 5) : (targetMob.physEvasion || 5);
      const hitChance = this.calculateEffectiveHitRate(pAcc, mEva);
      const isHit = Math.random() * 100 <= hitChance;

      if (!isHit) {
        events.push({
          actor: 'player',
          targetType: 'monster',
          targetIndex: targetMob.index,
          type: 'MISS',
          animAction: 7,
          amount: 0,
          hpRemaining: targetMob.hp,
          message: `${player.name} conjurou Chama Purgatorial, mas ${targetMob.name} esquivou (💨 DESVIO)!`,
        });
        battle.combatLog.unshift(
          `💨 [${player.name}] conjurou Chama Purgatorial em [${targetMob.name}], mas o alvo esquivou (💨 DESVIO)!`
        );
      } else {
        const isCrit = Math.random() < 0.3; // 30% crit rate na skill
        const variance = 1.0 + Math.random() * 0.3;
        let rawDmg = Math.round(player.atk * 1.8 * variance - targetMob.def * 0.2);
        if (isCrit) rawDmg = Math.round(rawDmg * 1.5);
        const dmg = Math.max(15, rawDmg);

        targetMob.hp = Math.max(0, targetMob.hp - dmg);
        if (targetMob.hp === 0) targetMob.isAlive = false;

        // Aplica o Debuff "Queimadura Solar" (com ícone na cabeça do alvo + VFX especial 10025)
        const burnDebuff: ActiveStatusInstance = {
          code: 'status_burn',
          name: 'Queimadura Solar',
          isBuff: false,
          iconUrl: `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100180.png`,
          vfxKey: '10025',
          triggerType: 'CONTINUOUS_TICK',
          durationSeconds: 6.0,
          remainingSeconds: 6.0,
          remainingTurns: 3,
        };
        if (targetMob.isAlive) {
          targetMob.activeStatuses = (targetMob.activeStatuses || []).filter((s) => s.code !== 'status_burn');
          targetMob.activeStatuses.push(burnDebuff);
        }

        events.push({
          actor: 'player',
          targetType: 'monster',
          targetIndex: targetMob.index,
          type: 'CRIT',
          animAction: 7,
          vfxKey: '10025',
          statusApplied: targetMob.isAlive ? burnDebuff : null,
          amount: dmg,
          isCrit: true,
          hpRemaining: targetMob.hp,
          message: `${player.name} conjurou Chama Purgatorial em ${targetMob.name} causando ${dmg} de Dano + Queimadura Solar!`,
        });

        battle.combatLog.unshift(
          `🔥 [${player.name}] lançou Chama Purgatorial em [${targetMob.name}] causando ${dmg} de dano e aplicando 🧪 [Queimadura Solar]!`
        );

        if (!targetMob.isAlive) {
          targetMob.activeStatuses = [];
          battle.combatLog.unshift(`💀 [${targetMob.name}] foi destruído pelo golpe especial!`);
        }
      }
    } else if (actionType === 'DEFEND') {
      isDefending = true;
      const healAmount = Math.round(player.maxHp * 0.08);
      const mpHeal = 15;
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      player.mp = Math.min(player.maxMp, player.mp + mpHeal);

      const regenBuff: ActiveStatusInstance = {
        code: 'status_regen_blessing',
        name: 'Bênção Regenerativa',
        isBuff: true,
        iconUrl: `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100150.png`,
        vfxKey: '10004',
        triggerType: 'CONTINUOUS_TICK',
        durationSeconds: 5.0,
        remainingSeconds: 5.0,
        remainingTurns: 2,
      };
      player.activeStatuses = (player.activeStatuses || []).filter((s) => s.code !== 'status_regen_blessing');
      player.activeStatuses.push(regenBuff);

      // Gatilho de Limpeza de Debuffs (ON_DEBUFF_RECEIVED / CLEANSE_DISPEL)
      const cleanseResult = this.cleanseUnitDebuffs(player, 0, 5, 100);
      const cleanseMsgSuffix =
        cleanseResult.removedCount > 0
          ? ` e limpou ${cleanseResult.removedCount} debuff(s) (${cleanseResult.removedNames.join(', ')})`
          : '';

      events.push({
        actor: 'player',
        targetType: 'player',
        type: 'HEAL',
        animAction: 4,
        vfxKey: '10004',
        statusApplied: regenBuff,
        amount: healAmount + cleanseResult.healedHp,
        hpRemaining: player.hp,
        message: `${player.name} assumiu Postura Defensiva (+50% Defesa, +${healAmount + cleanseResult.healedHp} HP, +${mpHeal} MP, Buff Bênção Regenerativa${cleanseMsgSuffix})!`,
      });

      battle.combatLog.unshift(
        `🛡️ [${player.name}] assumiu Postura Defensiva, recuperando ${healAmount + cleanseResult.healedHp} HP e ativando 🟢 [Bênção Regenerativa]${cleanseMsgSuffix}!`
      );
    }

    // 2. VERIFICA SE TODOS OS MONSTROS FORAM DERROTADOS
    let aliveMonsters = battle.monsters.filter((m) => m.isAlive);
    if (aliveMonsters.length === 0) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      const totalExp = battle.monsters.reduce((acc, m) => acc + m.level * 45, 0);
      const totalGold = battle.monsters.reduce((acc, m) => acc + m.level * 18, 0);
      battle.rewards = { exp: totalExp, gold: totalGold };
      battle.combatLog.unshift(`🏆 VITÓRIA! Todos os monstros foram derrotados! (+${totalExp} EXP, +${totalGold} Ouro simulados)`);
      battle.lastEvents = events;
      return battle;
    }

    // 2.5. GATILHOS DE BUFFS/DEBUFFS DOS MONSTROS EM TEMPO REAL / TICKS PERIÓDICOS
    for (const mob of aliveMonsters) {
      if (!mob.activeStatuses || mob.activeStatuses.length === 0) continue;
      for (const st of mob.activeStatuses) {
        if ((st.triggerType === 'CONTINUOUS_TICK' || st.triggerType === 'ON_TURN_START') && !st.isBuff) {
          const dotDmg = Math.max(6, Math.round(mob.maxHp * 0.08));
          mob.hp = Math.max(0, mob.hp - dotDmg);
          if (mob.hp === 0) {
            mob.isAlive = false;
            mob.activeStatuses = [];
          }
          events.push({
            actor: 'player',
            targetType: 'monster',
            targetIndex: mob.index,
            type: 'DAMAGE',
            animAction: 5,
            vfxKey: st.vfxKey || '10025',
            amount: dotDmg,
            hpRemaining: mob.hp,
            message: `🧪 Gatilho [${st.name}]: ${mob.name} sofreu ${dotDmg} de dano contínuo!`,
          });
          battle.combatLog.unshift(`🧪 Gatilho [${st.name}] ativado em [${mob.name}]: -${dotDmg} HP!`);
        }
        if (st.remainingSeconds !== undefined) {
          st.remainingSeconds = Math.max(0, st.remainingSeconds - 1.0);
        }
        st.remainingTurns = Math.max(0, (st.remainingTurns || 1) - 1);
      }
      mob.activeStatuses = (mob.activeStatuses || []).filter((s) => (s.remainingSeconds ?? s.remainingTurns ?? 0) > 0);
    }

    aliveMonsters = battle.monsters.filter((m) => m.isAlive);
    if (aliveMonsters.length === 0) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      const totalExp = battle.monsters.reduce((acc, m) => acc + m.level * 45, 0);
      const totalGold = battle.monsters.reduce((acc, m) => acc + m.level * 18, 0);
      battle.rewards = { exp: totalExp, gold: totalGold };
      battle.combatLog.unshift(`🏆 VITÓRIA! Todos os monstros foram derrotados! (+${totalExp} EXP, +${totalGold} Ouro simulados)`);
      battle.lastEvents = events;
      return battle;
    }

    // 3. RETALIAÇÃO DOS MONSTROS VIVOS
    const playerEffectiveDef = isDefending ? Math.round(player.def * 1.5) : player.def;

    for (const mob of aliveMonsters) {
      const isMag = mob.damageType === 'MAGICAL';
      const mobAcc = isMag ? (mob.magAccuracy || 95) : (mob.physAccuracy || 95);
      const pEva = isMag ? (player.magEvasion || 5) : (player.physEvasion || 5);
      const hitChance = this.calculateEffectiveHitRate(mobAcc, pEva);
      const isHit = Math.random() * 100 <= hitChance;

      if (!isHit) {
        events.push({
          actor: 'monster',
          actorIndex: mob.index,
          targetType: 'player',
          type: 'MISS',
          animAction: 3,
          amount: 0,
          hpRemaining: player.hp,
          message: `${mob.name} atacou ${player.name}, mas errou o golpe (💨 DESVIO)!`,
        });
        battle.combatLog.unshift(`💨 [${mob.name}] atacou [${player.name}], mas o golpe errou (💨 DESVIO)!`);
        continue;
      }

      const isCrit = Math.random() < 0.12;
      const variance = 0.85 + Math.random() * 0.3;
      let rawDmg = Math.round(mob.atk * variance - playerEffectiveDef * 0.35);
      if (isCrit) rawDmg = Math.round(rawDmg * 1.4);
      const dmg = Math.max(2, rawDmg);

      player.hp = Math.max(0, player.hp - dmg);
      if (player.hp === 0) player.isAlive = false;

      events.push({
        actor: 'monster',
        actorIndex: mob.index,
        targetType: 'player',
        type: isCrit ? 'CRIT' : 'DAMAGE',
        animAction: 3,
        amount: dmg,
        isCrit,
        hpRemaining: player.hp,
        message: `${mob.name} atacou ${player.name} causando ${dmg} de dano!`,
      });

      battle.combatLog.unshift(
        `💥 [${mob.name}] atacou [${player.name}] causando ${dmg} de dano${isCrit ? ' (💥 CRÍTICO!)' : ''}!`
      );

      if (!player.isAlive) {
        battle.isFinished = true;
        battle.winner = 'MONSTERS';
        battle.combatLog.unshift(`💀 [${player.name}] foi derrotado em combate!`);
        break;
      }
    }

    battle.round += 1;
    battle.lastEvents = events;
    return battle;
  }

  /**
   * Simula automaticamente toda a batalha até o fim (Auto-Resolve).
   */
  public autoResolve(battleId: string): TemporaryBattleState {
    const battle = this.activeBattles.get(battleId);
    if (!battle) {
      throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    }

    let iterations = 0;
    while (!battle.isFinished && iterations < 40) {
      iterations++;
      const aliveMobs = battle.monsters.filter((m) => m.isAlive);
      if (aliveMobs.length === 0) break;
      const target = aliveMobs[0];
      const useSkill = battle.player.mp >= 15 && Math.random() < 0.4;
      this.executeAction(battleId, useSkill ? 'SKILL' : 'ATTACK', target.index);
    }

    return battle;
  }

  /**
   * Processador procedural de Limpeza de Debuffs (`CLEANSE_DISPEL` / gatilhos `ON_DEBUFF_RECEIVED` e `ON_TURN_START_CLEANSE`).
   * Remove até `maxDebuffs` (0 = todos) efeitos negativos (`isBuff === false`) da unidade alvo.
   */
  public cleanseUnitDebuffs(
    unit: CombatUnit,
    maxDebuffs: number = 0,
    healPerDebuffPct: number = 0,
    cleanseChancePct: number = 100
  ): { removedCount: number; removedNames: string[]; healedHp: number } {
    if (!unit || !unit.isAlive || !Array.isArray(unit.activeStatuses) || unit.activeStatuses.length === 0) {
      return { removedCount: 0, removedNames: [], healedHp: 0 };
    }
    const chance = Math.max(0, Math.min(100, Number(cleanseChancePct) || 100));
    if (Math.random() * 100 > chance) {
      return { removedCount: 0, removedNames: [], healedHp: 0 };
    }

    const limit = Number(maxDebuffs) > 0 ? Number(maxDebuffs) : Infinity;
    const removedNames: string[] = [];
    const remaining: ActiveStatusInstance[] = [];

    for (const st of unit.activeStatuses) {
      if (!st.isBuff && removedNames.length < limit) {
        removedNames.push(st.name || st.code);
      } else {
        remaining.push(st);
      }
    }

    unit.activeStatuses = remaining;

    let healedHp = 0;
    const healPct = Math.max(0, Number(healPerDebuffPct) || 0);
    if (removedNames.length > 0 && healPct > 0) {
      healedHp = Math.round(unit.maxHp * (healPct / 100) * removedNames.length);
      unit.hp = Math.min(unit.maxHp, unit.hp + healedHp);
    }

    return {
      removedCount: removedNames.length,
      removedNames,
      healedHp,
    };
  }

  /**
   * Finaliza ou cancela uma batalha.
   */
  public endBattle(battleId: string): boolean {
    return this.activeBattles.delete(battleId);
  }
}
