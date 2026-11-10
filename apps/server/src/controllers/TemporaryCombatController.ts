/**
 * @file apps/server/src/controllers/TemporaryCombatController.ts
 * @module @etheria/server
 * @description MÓDULO TEMPORÁRIO DE COMBATE E SIMULAÇÃO DE BATALHA GM.
 *   AVISO: Este módulo foi estruturado de forma 100% isolada e modular para que possa
 *   ser facilmente substituído ou excluído quando a arena tática definitiva e o sistema
 *   de combate por turnos final forem implementados.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export interface ActiveStatusInstance {
  code: string;
  name: string;
  isBuff: boolean;
  iconUrl: string;
  vfxKey?: string | null;
  triggerType: string;
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
  }

  /**
   * Retorna os monstros disponíveis no banco para preencher o seletor do Painel GM.
   */
  public async getAvailableMonsters() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

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
        include: { classTemplate: true, pets: { take: 3, include: { monsterTemplate: true } } },
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
          charBaseStats = {
            VIT: b.VIT ?? 12,
            STR: b.STR ?? 12,
            INT: b.INT ?? 10,
            WIS: b.WIS ?? 10,
            AGI: b.AGI ?? 10,
            DEX: b.DEX ?? 10,
          };
        }
      }
    }

    const charThumb = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/thumb.webp`;
    const charAtlasJson = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.json`;
    const charAtlasWebp = `${this.mcreworkPagesBaseUrl}/assets/characters/${charSpriteKey}/atlas.webp`;

    // Calcula Atributos do Personagem
    const playerMaxHp = charBaseStats.VIT * 25 + charLevel * 20;
    const playerMaxMp = charBaseStats.INT * 15 + charLevel * 10;
    const playerAtk = Math.round(charBaseStats.STR * 3.2 + charLevel * 4);
    const playerDef = Math.round(charBaseStats.VIT * 1.8 + charLevel * 2.5);
    const playerSpeed = charBaseStats.AGI * 2 + charLevel;

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
      speed: playerSpeed,
      spriteKey: charSpriteKey,
      atlasJsonUrl: charAtlasJson,
      atlasWebpUrl: charAtlasWebp,
      groundOffsetY: charGroundOffsetY,
      thumbUrl: charThumb,
      elementCode: charElementCode,
      raceCode: 'HUMAN',
      combatStyle: (pc?.classTemplate?.combatStyle as any) || 'MELEE',
      attackRange: pc?.classTemplate?.attackRange || 60,
      isAlive: true,
      activeStatuses: [],
    };

    // Pets que acompanham o jogador em combate (2 a 3 pets)
    const petUnits: CombatUnit[] = [];
    if (pc && pc.pets && pc.pets.length > 0) {
      pc.pets.slice(0, 3).forEach((cp: any, idx: number) => {
        const mt = cp.monsterTemplate;
        const petKey = mt?.mcreworkMonsterKey || 'creature_000001';
        petUnits.push({
          id: `pet_${cp.id}_${idx}`,
          index: idx,
          name: cp.nickname || `Pet #${idx + 1}`,
          level: cp.level || charLevel,
          hp: Math.round(playerMaxHp * 0.65),
          maxHp: Math.round(playerMaxHp * 0.65),
          mp: Math.round(playerMaxMp * 0.50),
          maxMp: Math.round(playerMaxMp * 0.50),
          atk: Math.round(playerAtk * 0.60),
          def: Math.round(playerDef * 0.65),
          speed: Math.round(playerSpeed * 0.95),
          spriteKey: petKey,
          atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${petKey}/atlas.json`,
          atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${petKey}/atlas.webp`,
          groundOffsetY: mt?.groundOffsetY || 0,
          thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${petKey}/thumb.webp`,
          elementCode: cp.elementCode || 'NEUTRAL',
          raceCode: 'BEAST',
          combatStyle: (mt?.combatStyle as any) || 'MELEE',
          attackRange: mt?.attackRange || 60,
          isAlive: true,
          activeStatuses: [],
        });
      });
    } else {
      const defaultCompanions = [
        { key: 'creature_000001', name: 'Lobo Guardião (Pet)' },
        { key: 'creature_000002', name: 'Grifo Protetor (Pet)' }
      ];
      defaultCompanions.forEach((comp, idx) => {
        petUnits.push({
          id: `pet_comp_${idx}`,
          index: idx,
          name: comp.name,
          level: charLevel,
          hp: Math.round(playerMaxHp * 0.65),
          maxHp: Math.round(playerMaxHp * 0.65),
          mp: Math.round(playerMaxMp * 0.50),
          maxMp: Math.round(playerMaxMp * 0.50),
          atk: Math.round(playerAtk * 0.60),
          def: Math.round(playerDef * 0.65),
          speed: Math.round(playerSpeed * 0.95),
          spriteKey: comp.key,
          atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${comp.key}/atlas.json`,
          atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${comp.key}/atlas.webp`,
          groundOffsetY: 0,
          thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${comp.key}/thumb.webp`,
          elementCode: 'NEUTRAL',
          raceCode: 'BEAST',
          combatStyle: 'MELEE',
          attackRange: 60,
          isAlive: true,
          activeStatuses: [],
        });
      });
    }

    // Calcula Atributos do Monstro (escalonados por nível; o Rank SS..F é mantido apenas como registro por ora)
    const mobStats = (mobTemplate.baseAttributesJson as any) || { VIT: 12, STR: 12, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
    const rarityMult = 1.0;

    const mobMaxHp = Math.round((mobStats.VIT * 20 + lvl * 18) * rarityMult);
    const mobMaxMp = Math.round((mobStats.INT * 10 + lvl * 8) * rarityMult);
    const mobAtk = Math.round((mobStats.STR * 2.6 + lvl * 3.2) * rarityMult);
    const mobDef = Math.round((mobStats.VIT * 1.4 + lvl * 2.0) * rarityMult);
    const mobSpeed = Math.round((mobStats.AGI * 1.8 + lvl) * rarityMult);
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
          id: `mob_${mobTemplate.id}_${i}`,
          index: i,
          name: qty > 1 ? `${mobBaseName} #${i + 1}` : mobBaseName,
          level: lvl,
          hp: mobMaxHp,
          maxHp: mobMaxHp,
          mp: mobMaxMp,
          maxMp: mobMaxMp,
          atk: mobAtk,
          def: mobDef,
          speed: mobSpeed,
          spriteKey: mobKey,
          atlasJsonUrl: mobAtlasJson,
          atlasWebpUrl: mobAtlasWebp,
          groundOffsetY: mobTemplate.groundOffsetY || 0,
          thumbUrl: mobThumb,
          elementCode: mobTemplate.fixedElementCode || 'NEUTRAL',
          raceCode: mobTemplate.raceCode || 'BEAST',
          combatStyle: (mobTemplate.combatStyle as any) || 'MELEE',
          attackRange: mobTemplate.attackRange || 60,
          isAlive: true,
          activeStatuses: [],
        });
      }
    }

    const battleId = randomUUID();
    const state: TemporaryBattleState = {
      battleId,
      characterId: Number(characterId) || 1,
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

    // Limpeza de batalhas antigas após 1 hora para economizar memória
    setTimeout(() => {
      this.activeBattles.delete(battleId);
    }, 60 * 60 * 1000);

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
    });

    if (!map) {
      throw new Error(`Mapa #${mapId} não encontrado.`);
    }

    if (map.encounterRatePct <= 0) {
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

    // 3. Obtém o pool de monstros elegíveis do mapa (Tipos/Raças + Monstros Individuais)
    const allowedRaces = Array.isArray(map.allowedMonsterRacesJson)
      ? (map.allowedMonsterRacesJson as string[]).filter(Boolean)
      : [];
    const allowedIds = Array.isArray(map.allowedMonsterTemplateIdsJson)
      ? (map.allowedMonsterTemplateIdsJson as number[]).map(Number).filter(Boolean)
      : [];

    let candidateTemplates: any[] = [];
    if (allowedRaces.length > 0 || allowedIds.length > 0) {
      const orClauses: any[] = [];
      if (allowedRaces.length > 0) orClauses.push({ raceCode: { in: allowedRaces } });
      if (allowedIds.length > 0) orClauses.push({ id: { in: allowedIds } });

      candidateTemplates = await this.prisma.monsterTemplate.findMany({
        where: {
          isActive: true,
          OR: orClauses,
        },
      });
    }

    // Fallback: se o mapa não tiver tipos definidos ainda, busca todos os monstros ativos
    if (candidateTemplates.length === 0) {
      candidateTemplates = await this.prisma.monsterTemplate.findMany({
        where: { isActive: true },
      });
    }

    if (candidateTemplates.length === 0) {
      throw new Error('Nenhum monstro ativo cadastrado no sistema para encontros.');
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

    // 7. Constrói a lista heterogênea de monstros sorteados
    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < totalMonstersToSpawn; i++) {
      const tmpl = pickWeightedCandidate();
      const variance = minVar + Math.floor(Math.random() * (varRange + 1));
      const mobLvl = Math.max(1, Math.min(100, (map.requiredLevel || 1) + variance));

      const rTier = (tmpl.rarityTier || 'F').toUpperCase();
      const mult = rarityStatMults[rTier] || { hp: 1.0, atk: 1.0, def: 1.0 };
      const mobStats = (tmpl.baseAttributesJson as any) || { VIT: 12, STR: 12, INT: 10, WIS: 10, AGI: 10, DEX: 10 };

      const mobMaxHp = Math.round((mobStats.VIT * 20 + mobLvl * 18) * mult.hp);
      const mobMaxMp = Math.round((mobStats.INT * 10 + mobLvl * 8) * mult.hp);
      const mobAtk = Math.round((mobStats.STR * 2.6 + mobLvl * 3.2) * mult.atk);
      const mobDef = Math.round((mobStats.VIT * 1.4 + mobLvl * 2.0) * mult.def);
      const mobSpeed = Math.round(mobStats.AGI * 1.8 + mobLvl);

      const baseName = i18nMap.get(tmpl.nameI18nKey) || tmpl.code;
      const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';
      const mobKey = tmpl.mcreworkMonsterKey;

      monsterUnits.push({
        id: `mob_${tmpl.id}_${i}`,
        index: i,
        name: `${baseName} #${i + 1}${raritySuffix}`,
        level: mobLvl,
        hp: mobMaxHp,
        maxHp: mobMaxHp,
        mp: mobMaxMp,
        maxMp: mobMaxMp,
        atk: mobAtk,
        def: mobDef,
        speed: mobSpeed,
        spriteKey: mobKey,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/atlas.webp`,
        groundOffsetY: tmpl.groundOffsetY || 0,
        thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mobKey}/thumb.webp`,
        elementCode: tmpl.fixedElementCode || 'NEUTRAL',
        raceCode: tmpl.raceCode || 'BEAST',
        combatStyle: (tmpl.combatStyle as any) || 'MELEE',
        attackRange: tmpl.attackRange || 60,
        isAlive: true,
        activeStatuses: [],
      });
    }

    const firstTemplateId = monsterUnits[0] ? Number(candidateTemplates[0]?.id || 1) : 1;
    return this.startBattle(characterId, firstTemplateId, monsterUnits.length, map.requiredLevel, monsterUnits);
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
    } else if (actionType === 'SKILL') {
      const mpCost = 15;
      if (player.mp >= mpCost) {
        player.mp -= mpCost;
      }
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
        triggerType: 'ON_TURN_START',
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
        triggerType: 'ON_TURN_START',
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

    // 2.5. GATILHOS DE BUFFS/DEBUFFS DOS MONSTROS NO INÍCIO DO TURNO DELES (ON_TURN_START)
    for (const mob of aliveMonsters) {
      if (!mob.activeStatuses || mob.activeStatuses.length === 0) continue;
      for (const st of mob.activeStatuses) {
        if (st.triggerType === 'ON_TURN_START' && !st.isBuff) {
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
        st.remainingTurns -= 1;
      }
      mob.activeStatuses = (mob.activeStatuses || []).filter((s) => s.remainingTurns > 0);
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
