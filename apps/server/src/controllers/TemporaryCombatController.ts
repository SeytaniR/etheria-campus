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
    monsterLevel: number = 1
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

    const monsterUnits: CombatUnit[] = [];
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
        isAlive: true,
        activeStatuses: [],
      });
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
        `⚔️ Batalha iniciada! [${charName}] (Nv.${charLevel}) entrou em combate contra ${qty}x [${mobBaseName}] (Nv.${lvl})!`,
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
   * Sorteia um encontro de monstros aleatório baseado nos biomas e nível do mapa atual.
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

    // Busca templates de monstros vinculados aos biomas primário e secundário do mapa
    const biomeIds = [map.primaryBiomeId, map.secondaryBiomeId].filter(Boolean);
    const monsterBiomes = await this.prisma.monsterBiome.findMany({
      where: { biomeId: { in: biomeIds } },
      include: { monsterTemplate: true },
    });

    let candidateTemplates = monsterBiomes
      .map((mb) => mb.monsterTemplate)
      .filter((m) => m && m.isActive);

    // Se nenhum monstro estiver especificamente associado ao bioma, busca qualquer monstro ativo
    if (candidateTemplates.length === 0) {
      candidateTemplates = await this.prisma.monsterTemplate.findMany({
        where: { isActive: true },
      });
    }

    if (candidateTemplates.length === 0) {
      throw new Error(`Nenhum monstro cadastrado no sistema para encontros.`);
    }

    // Sorteia um template aleatório
    const selectedTemplate = candidateTemplates[Math.floor(Math.random() * candidateTemplates.length)];

    // Sorteia quantidade (1 mob: 60%, 2 mobs: 30%, 3 mobs: 10%)
    const rollQty = Math.random();
    const quantity = rollQty < 0.60 ? 1 : rollQty < 0.90 ? 2 : 3;

    // Calcula nível do monstro baseado no nível do mapa e variação
    const minVar = map.levelVarianceMin ?? -2;
    const maxVar = map.levelVarianceMax ?? 5;
    const varRange = Math.max(0, maxVar - minVar);
    const variance = minVar + Math.floor(Math.random() * (varRange + 1));
    const monsterLevel = Math.max(1, Math.min(100, (map.requiredLevel || 1) + variance));

    return this.startBattle(characterId, selectedTemplate.id, quantity, monsterLevel);
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

      events.push({
        actor: 'player',
        targetType: 'player',
        type: 'HEAL',
        animAction: 4,
        vfxKey: '10004',
        statusApplied: regenBuff,
        amount: healAmount,
        hpRemaining: player.hp,
        message: `${player.name} assumiu Postura Defensiva (+50% Defesa, +${healAmount} HP, +${mpHeal} MP e Buff Bênção Regenerativa)!`,
      });

      battle.combatLog.unshift(
        `🛡️ [${player.name}] assumiu Postura Defensiva, recuperando ${healAmount} HP e ativando 🟢 [Bênção Regenerativa]!`
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
   * Finaliza ou cancela uma batalha.
   */
  public endBattle(battleId: string): boolean {
    return this.activeBattles.delete(battleId);
  }
}
