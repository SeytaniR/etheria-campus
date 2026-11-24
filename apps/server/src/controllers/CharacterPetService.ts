/**
 * @file apps/server/src/controllers/CharacterPetService.ts
 * @module @etheria/server
 * @description Motor Procedural e Autoritário de Pets (`character_pets`) vinculados a `monster_templates`.
 * @rules
 *   1. Todo Pet é gerado a partir de um Monstro com `isTamableAsPet = true` e `isActive = true`.
 *   2. Ao ser gerado no Nível 1:
 *      - Recebe um Elemento Aleatório (10% NEUTRAL, 22.5% cada entre FIRE, EARTH, AIR, WATER).
 *      - Atributos Base começam com 1 ponto fixo em cada (VIT:1, STR:1, INT:1, WIS:1, AGI:1, DEX:1).
 *      - Recebe 76 pontos de atributos livres para distribuir no Nível 1 (`unspentStatPoints = 76`).
 *      - A cada Level Up recebe +4 pontos livres para o jogador distribuir (`+4/nível`).
 *   3. Status Derivados de Combate do Pet:
 *      - Calculados estritamente pelos pontos reais do Pet (1 fixo + distribuídos + equipamentos do pet)
 *        convertidos pela matriz `attribute_conversions` e multiplicados pelo Bônus de Raridade do Monstro
 *        (F=1.0x, D=1.3x, C=1.5x, B=1.8x, A=2.1x, S=2.7x, SS=4.0x), sem o +20%/nível dos monstros selvagens.
 *      - Mantém Raça/Tipo, Raridade, Estilo (MELEE/RANGED), Alcance, Tipo de Dano (PHYSICAL/MAGICAL)
 *        e Atributos de Combate Não-Derivados (BATTLE_MOVE_SPEED, ATTACK_SPEED, etc.) iguais ao MonsterTemplate.
 *      - O ataque básico e habilidades `INHERIT` usam o elemento sorteado do Pet (`pet.elementCode`).
 *   4. Habilidades do Pet:
 *      - Máximo de 3 habilidades fixadas (`skillIdsJson`), livres para escolha entre todas as habilidades ativas.
 *   5. Ciclo de Vida Procedural (Vínculo com `monster_templates`):
 *      - Se o monstro for editado no `/admin`, reflete em tempo real no pet.
 *      - Se o monstro for inativado (`isActive = false` ou `isTamableAsPet = false`), o pet aparece como
 *        "Inativado Temporariamente" no inventário de pets do jogador e não entra em combate/mapa.
 *      - Se o monstro for excluído, todos os equipamentos equipados no pet são devolvidos à mochila do jogador
 *        antes de remover o pet.
 *   6. Formação (`deploySlot`: 1, 2, 3 ou null):
 *      - Solo: até 3 pets (`deploySlot` 1, 2 e 3) entram em combate.
 *      - Equipe: apenas 1 pet (`deploySlot = 1`, ou o primeiro slot ativo) entra em combate.
 *      - Exploração no Mapa: o Pet do Slot 1 acompanha o jogador caminhando junto a ele no mapa.
 */

import type * as http from 'node:http';
import { PrismaClient, SnapshotManager, I18nCache } from '@etheria/database';
import { MonsterCombatBuilder, type MonsterScalingContext } from './MonsterCombatBuilder.js';
import { MapPresenceService } from './MapPresenceService.js';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CharacterProgressionService } from './CharacterProgressionService.js';
import type { CombatUnit } from './TemporaryCombatController.js';

export interface BaseStatsMap {
  VIT: number;
  STR: number;
  INT: number;
  WIS: number;
  AGI: number;
  DEX: number;
}

export class CharacterPetService {
  public static readonly INITIAL_FREE_POINTS_LV1 = 76;
  public static readonly POINTS_PER_LEVEL_UP = 4;
  public static readonly MAX_PET_SKILLS = 3;
  public static readonly FIXED_BASE_PER_ATTR = 1;
  public static readonly BASE_ATTR_KEYS: Array<keyof BaseStatsMap> = ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'];

  /**
   * Sorteia o Elemento do Pet na mesma proporção oficial do Personagem do Jogador:
   * - 10% `NEUTRAL`
   * - 90% divididos igualmente entre `FIRE`, `EARTH`, `AIR`, `WATER` (22.5% cada)
   */
  public static rollPetElement(): string {
    const roll = Math.random();
    if (roll < 0.10) {
      return 'NEUTRAL';
    }
    const activeElements = ['FIRE', 'EARTH', 'AIR', 'WATER'];
    const idx = Math.floor(Math.random() * activeElements.length);
    return activeElements[idx] ?? 'FIRE';
  }

  /**
   * Normaliza o JSON de pontos distribuídos do Pet.
   */
  public static normalizeDistributedStats(raw: any): BaseStatsMap {
    const obj = raw && typeof raw === 'object' ? raw : {};
    return {
      VIT: Math.max(0, Math.floor(Number(obj.VIT) || 0)),
      STR: Math.max(0, Math.floor(Number(obj.STR) || 0)),
      INT: Math.max(0, Math.floor(Number(obj.INT) || 0)),
      WIS: Math.max(0, Math.floor(Number(obj.WIS) || 0)),
      AGI: Math.max(0, Math.floor(Number(obj.AGI) || 0)),
      DEX: Math.max(0, Math.floor(Number(obj.DEX) || 0)),
    };
  }

  /**
   * Normaliza a lista de até 3 habilidades fixadas no Pet.
   */
  public static normalizePetSkillIds(raw: any, fallbackTemplateSkills?: any): number[] {
    const source = Array.isArray(raw) && raw.length > 0
      ? raw
      : (Array.isArray(fallbackTemplateSkills) ? fallbackTemplateSkills : []);
    const unique: number[] = [];
    for (const item of source) {
      const id = Number(item);
      if (Number.isInteger(id) && id > 0 && !unique.includes(id)) {
        unique.push(id);
      }
      if (unique.length >= this.MAX_PET_SKILLS) break;
    }
    return unique;
  }

  /**
   * Verifica se o Pet está temporariamente inativado porque seu MonsterTemplate foi
   * desativado (`isActive = false`) ou desmarcado como Pet (`isTamableAsPet = false`) no `/admin`.
   */
  public static isPetTemporarilyDisabled(monsterTemplate: any): boolean {
    if (!monsterTemplate) return true;
    return monsterTemplate.isActive === false || monsterTemplate.isTamableAsPet === false;
  }

  /**
   * Calcula todos os atributos base e atributos finais de combate do Pet:
   * - 1 ponto fixo em cada atributo base + pontos distribuídos pelo jogador + bônus de equipamentos do pet.
   * - Multiplicados pelas conversões de `attribute_conversions` e pelo Bônus de Raridade (F..SS),
   *   SEM o escalonamento de +20%/nível dos monstros selvagens.
   */
  public static calculatePetCombatStats(
    pet: any,
    monsterTemplate: any,
    ctx: MonsterScalingContext,
    eqCombatBonuses: Record<string, number> = {},
    eqBaseBonuses: Partial<BaseStatsMap> = {}
  ) {
    const dist = this.normalizeDistributedStats(pet?.distributedStatsJson);
    const fixedBase: BaseStatsMap = {
      VIT: this.FIXED_BASE_PER_ATTR,
      STR: this.FIXED_BASE_PER_ATTR,
      INT: this.FIXED_BASE_PER_ATTR,
      WIS: this.FIXED_BASE_PER_ATTR,
      AGI: this.FIXED_BASE_PER_ATTR,
      DEX: this.FIXED_BASE_PER_ATTR,
    };

    const totalBaseStats: BaseStatsMap = {
      VIT: fixedBase.VIT + dist.VIT + (Number(eqBaseBonuses.VIT) || 0),
      STR: fixedBase.STR + dist.STR + (Number(eqBaseBonuses.STR) || 0),
      INT: fixedBase.INT + dist.INT + (Number(eqBaseBonuses.INT) || 0),
      WIS: fixedBase.WIS + dist.WIS + (Number(eqBaseBonuses.WIS) || 0),
      AGI: fixedBase.AGI + dist.AGI + (Number(eqBaseBonuses.AGI) || 0),
      DEX: fixedBase.DEX + dist.DEX + (Number(eqBaseBonuses.DEX) || 0),
    };

    const rTier = String(monsterTemplate?.rarityTier || 'F').trim().toUpperCase();
    const rarity = MonsterCombatBuilder.resolveRarityProfile(rTier);

    const vitHpRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'VIT', 'MAX_HP', 20);
    const intMpRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'INT', 'MAX_MP', 12);
    const strPhysAtkRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'STR', 'PHYS_ATK', 2.5);
    const agiPhysAtkRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'AGI', 'PHYS_ATK', 0.5);
    const intMagAtkRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'INT', 'MAG_ATK', 2.5);
    const wisHealPowerRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'WIS', 'HEAL_POWER', 2.0);
    const vitDefRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'VIT', 'PHYS_DEF', 1.5);
    const wisMagDefRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'WIS', 'MAG_DEF', 1.8);
    const agiSpdRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'AGI', 'SPEED', 1.5);
    const agiMoveRatio = MonsterCombatBuilder.getConversionRatio(ctx, 'AGI', 'BATTLE_MOVE_SPEED', 0.5);

    const damageType: 'PHYSICAL' | 'MAGICAL' =
      String(monsterTemplate?.damageType || 'PHYSICAL').toUpperCase() === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';
    const combatStyle: 'MELEE' | 'RANGED' =
      String(monsterTemplate?.combatStyle || 'MELEE').toUpperCase() === 'RANGED' ? 'RANGED' : 'MELEE';
    const attackRange = Math.max(
      10,
      (Number(monsterTemplate?.attackRange) || (combatStyle === 'RANGED' ? 220 : 60)) + (Number(eqCombatBonuses.ATTACK_RANGE) || 0)
    );

    const physAtk = Math.max(
      8,
      Math.round((totalBaseStats.STR * strPhysAtkRatio + totalBaseStats.AGI * agiPhysAtkRatio) * rarity.atk + (eqCombatBonuses.PHYS_ATK || 0))
    );
    const magAtk = Math.max(
      8,
      Math.round(totalBaseStats.INT * intMagAtkRatio * rarity.atk + (eqCombatBonuses.MAG_ATK || 0))
    );
    const healPower = Math.max(
      8,
      Math.round(totalBaseStats.WIS * wisHealPowerRatio * rarity.atk + (eqCombatBonuses.HEAL_POWER || 0))
    );
    const atk = damageType === 'MAGICAL' ? magAtk : physAtk;

    const maxHp = Math.max(
      50,
      Math.round(totalBaseStats.VIT * vitHpRatio * rarity.hp + (eqCombatBonuses.MAX_HP || 0))
    );
    const maxMp = Math.max(
      20,
      Math.round(totalBaseStats.INT * intMpRatio * rarity.hp + (eqCombatBonuses.MAX_MP || 0))
    );
    const def = Math.max(
      5,
      Math.round(totalBaseStats.VIT * vitDefRatio * rarity.def + (eqCombatBonuses.PHYS_DEF || 0))
    );
    const magDef = Math.max(
      5,
      Math.round(totalBaseStats.WIS * wisMagDefRatio * rarity.def + (eqCombatBonuses.MAG_DEF || 0))
    );
    const speed = Math.max(
      10,
      Math.round(totalBaseStats.AGI * agiSpdRatio + (eqCombatBonuses.SPEED || 0))
    );

    // Atributos de combate não-derivados mantidos iguais aos do MonsterTemplate
    const cb = (monsterTemplate?.baseCombatAttributesJson as any) || {};
    const baseMoveSpeed = Number(cb.BATTLE_MOVE_SPEED) || ctx.globalDefaultMoveSpeed || 160;
    const battleMoveSpeed = Math.max(
      60,
      Math.min(185, Math.round(
        baseMoveSpeed + Math.min(120, totalBaseStats.AGI * agiMoveRatio) + (eqCombatBonuses.BATTLE_MOVE_SPEED || 0)
      ))
    );
    const attackSpeed = Math.max(
      0.2,
      Math.round(((Number(cb.ATTACK_SPEED) || 1.0) + (eqCombatBonuses.ATTACK_SPEED || 0)) * 100) / 100
    );

    const dexCritBonus = Math.max(0, totalBaseStats.DEX - 10) * MonsterCombatBuilder.getConversionRatio(ctx, 'DEX', 'CRIT_RATE', 0.002);
    const strCritDmgBonus = Math.max(0, totalBaseStats.STR - 10) * MonsterCombatBuilder.getConversionRatio(ctx, 'STR', 'CRIT_DMG', 0.003);
    const agiEvaBonusPct = Math.max(0, totalBaseStats.AGI - 10) * (MonsterCombatBuilder.getConversionRatio(ctx, 'AGI', 'PHYS_EVASION', 0.002) * 100);
    const wisEvaBonusPct = Math.max(0, totalBaseStats.WIS - 10) * (MonsterCombatBuilder.getConversionRatio(ctx, 'WIS', 'MAG_EVASION', 0.0015) * 100);
    const dexPhysAccBonusPct = Math.max(0, totalBaseStats.DEX - 10) * (MonsterCombatBuilder.getConversionRatio(ctx, 'DEX', 'PHYS_ACCURACY', 0.002) * 100);
    const dexMagAccBonusPct = Math.max(0, totalBaseStats.DEX - 10) * (MonsterCombatBuilder.getConversionRatio(ctx, 'DEX', 'MAG_ACCURACY', 0.002) * 100);

    const critRate = Math.min(
      0.85,
      (Number(cb.CRIT_RATE) || 5) / 100 + dexCritBonus + rarity.critBonus + (eqCombatBonuses.CRIT_CHANCE_PCT || 0) / 100
    );
    const critDmg = Math.min(
      3.00,
      (Number(cb.CRIT_DMG) || 150) / 100 + strCritDmgBonus + (eqCombatBonuses.CRIT_DAMAGE_PCT || 0) / 100
    );

    const physAccuracy = Math.min(
      125,
      Math.max(20, Math.round((Number(cb.PHYS_ACCURACY) || 95) + dexPhysAccBonusPct + rarity.accBonus + (eqCombatBonuses.PHYS_ACCURACY || 0)))
    );
    const physEvasion = Math.min(
      75,
      Math.max(0, Math.round((Number(cb.PHYS_EVASION) || 5) + agiEvaBonusPct + (eqCombatBonuses.PHYS_EVASION || 0)))
    );
    const magAccuracy = Math.min(
      125,
      Math.max(20, Math.round((Number(cb.MAG_ACCURACY) || 95) + dexMagAccBonusPct + rarity.accBonus + (eqCombatBonuses.MAG_ACCURACY || 0)))
    );
    const magEvasion = Math.min(
      75,
      Math.max(0, Math.round((Number(cb.MAG_EVASION) || 5) + wisEvaBonusPct + (eqCombatBonuses.MAG_EVASION || 0)))
    );

    return {
      fixedBaseStats: fixedBase,
      distributedStats: dist,
      totalBaseStats,
      rarityTier: rTier,
      rarityProfile: rarity,
      combatStyle,
      attackRange,
      damageType,
      maxHp,
      maxMp,
      atk,
      physAtk,
      magAtk,
      healPower,
      def,
      magDef,
      speed,
      battleMoveSpeed,
      attackSpeed,
      critRate,
      critDmg,
      physAccuracy,
      physEvasion,
      magAccuracy,
      magEvasion,
    };
  }

  /**
   * Constrói a unidade de combate autoritária (`CombatUnit`) de um Pet para `TemporaryCombatController`.
   */
  public static buildPetCombatUnit(
    pet: any,
    index: number,
    ctx: MonsterScalingContext,
    pagesBaseUrl: string,
    i18nMap: Map<string, string>,
    eqCombatBonuses: Record<string, number> = {},
    eqBaseBonuses: Partial<BaseStatsMap> = {}
  ): CombatUnit | null {
    const tpl = pet?.monsterTemplate;
    if (!tpl || this.isPetTemporarilyDisabled(tpl)) return null;

    const calc = this.calculatePetCombatStats(pet, tpl, ctx, eqCombatBonuses, eqBaseBonuses);
    const petLvl = Math.max(1, Number(pet.level) || 1);
    const speciesName = i18nMap.get(tpl.nameI18nKey) ?? tpl.code;
    const petDisplayName = (pet.nickname && String(pet.nickname).trim()) || speciesName;
    const mobKey = tpl.mcreworkMonsterKey || 'creature_000001';
    const petElement = String(pet.elementCode || 'NEUTRAL').toUpperCase();
    const skillIds = this.normalizePetSkillIds(pet.skillIdsJson, tpl.skillIdsJson);

    return {
      id: `pet_${pet.id}`,
      monsterTemplateId: Number(tpl.id),
      index,
      name: petDisplayName,
      level: petLvl,
      variantTier: 'NORMAL',
      modelScale: 1.0,
      nameColorHex: '#bae6fd',
      hp: calc.maxHp,
      maxHp: calc.maxHp,
      mp: calc.maxMp,
      maxMp: calc.maxMp,
      atk: calc.atk,
      physAtk: calc.physAtk,
      magAtk: calc.magAtk,
      healPower: calc.healPower,
      def: calc.def,
      magDef: calc.magDef,
      skillIds,
      critRate: calc.critRate,
      critDmg: calc.critDmg,
      attackSpeed: calc.attackSpeed,
      speed: calc.speed,
      battleMoveSpeed: calc.battleMoveSpeed,
      spriteKey: mobKey,
      atlasJsonUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/atlas.json`,
      atlasWebpUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/atlas.webp`,
      groundOffsetY: tpl.groundOffsetY || 0,
      thumbUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/thumb.webp`,
      elementCode: petElement, // Usa o elemento sorteado do Pet!
      raceCode: tpl.raceCode || 'BEAST',
      rarityTier: calc.rarityTier,
      combatStyle: calc.combatStyle,
      attackRange: calc.attackRange,
      damageType: calc.damageType,
      basicAttackVfxKey: calc.combatStyle === 'RANGED' ? '10002' : '10008',
      basicAttackVfxColorHex: calc.combatStyle === 'RANGED' ? '#38bdf8' : '#fde047',
      physAccuracy: calc.physAccuracy,
      physEvasion: calc.physEvasion,
      magAccuracy: calc.magAccuracy,
      magEvasion: calc.magEvasion,
      isAlive: true,
      activeStatuses: [],
    };
  }

  /**
   * Serializa a coleção completa de Pets de um Personagem, separando os equipados nos Slots 1..3 e o Pet Principal (Slot 1).
   */
  public static serializeCharacterPets(
    rawPets: any[],
    i18nMap: Map<string, string>,
    expMap: Map<number, number> | undefined,
    scalingCtx: MonsterScalingContext,
    pagesBaseUrl: string
  ) {
    const sorted = [...(rawPets || [])].sort((a, b) => {
      const sa = a.deploySlot ? Number(a.deploySlot) : 99;
      const sb = b.deploySlot ? Number(b.deploySlot) : 99;
      if (sa !== sb) return sa - sb;
      return Number(a.id) - Number(b.id);
    });

    const allPets = sorted.map((cp) => {
      const mt = cp.monsterTemplate;
      const isTemporarilyDisabled = this.isPetTemporarilyDisabled(mt);
      const petKey = mt?.mcreworkMonsterKey || 'creature_000001';
      const speciesNamePtBr = mt ? (i18nMap.get(mt.nameI18nKey) ?? mt.code) : `Monstro #${cp.monsterTemplateId}`;
      const petName = (cp.nickname && String(cp.nickname).trim()) || speciesNamePtBr;
      const petLvl = Math.max(1, Number(cp.level) || 1);
      const petMaxXp = expMap?.get(petLvl) ?? (petLvl * 42000);
      const petExp = Number(cp.experience ?? 0);
      const elementCode = String(cp.elementCode || 'NEUTRAL').toUpperCase();
      const elementNamePtBr = i18nMap.get(`element.${elementCode.toLowerCase()}.name`) ?? elementCode;
      const raceCode = mt?.raceCode || 'BEAST';
      const raceNamePtBr = i18nMap.get(`race.${raceCode.toLowerCase()}.name`) ?? raceCode;

      const calc = this.calculatePetCombatStats(cp, mt || {}, scalingCtx);
      const skillIds = this.normalizePetSkillIds(cp.skillIdsJson, mt?.skillIdsJson);
      const deploySlot = cp.deploySlot && [1, 2, 3].includes(Number(cp.deploySlot)) ? Number(cp.deploySlot) : null;

      return {
        id: cp.id,
        characterId: cp.characterId,
        monsterTemplateId: cp.monsterTemplateId,
        nickname: petName,
        speciesNamePtBr,
        level: petLvl,
        experience: petExp,
        maxXp: petMaxXp,
        xpPct: Math.min(100, Math.max(0, Math.round((petExp / Math.max(1, petMaxXp)) * 100))),
        hp: calc.maxHp,
        maxHp: calc.maxHp,
        hpPct: 100,
        mp: calc.maxMp,
        maxMp: calc.maxMp,
        mpPct: 100,
        elementCode,
        elementNamePtBr,
        raceCode,
        raceNamePtBr,
        rarityTier: calc.rarityTier,
        rarityProfile: calc.rarityProfile,
        combatStyle: calc.combatStyle,
        attackRange: calc.attackRange,
        damageType: calc.damageType,
        unspentStatPoints: Number(cp.unspentStatPoints ?? 0),
        fixedBaseStats: calc.fixedBaseStats,
        distributedStatsJson: calc.distributedStats,
        baseAttributesJson: calc.totalBaseStats,
        baseCombatAttributesJson: mt?.baseCombatAttributesJson || {},
        computedCombatStats: {
          maxHp: calc.maxHp,
          maxMp: calc.maxMp,
          atk: calc.atk,
          physAtk: calc.physAtk,
          magAtk: calc.magAtk,
          healPower: calc.healPower,
          def: calc.def,
          magDef: calc.magDef,
          speed: calc.speed,
          battleMoveSpeed: calc.battleMoveSpeed,
          attackSpeed: calc.attackSpeed,
          critRatePct: Math.round(calc.critRate * 1000) / 10,
          critDmgPct: Math.round(calc.critDmg * 100),
          physAccuracy: calc.physAccuracy,
          physEvasion: calc.physEvasion,
          magAccuracy: calc.magAccuracy,
          magEvasion: calc.magEvasion,
        },
        skillIdsJson: skillIds,
        deploySlot,
        isTemporarilyDisabled,
        statusLabelPtBr: isTemporarilyDisabled ? 'Inativado Temporariamente' : (deploySlot ? `Equipado (Slot #${deploySlot})` : 'Na Reserva'),
        equippedItemsJson: cp.equippedItemsJson || {},
        mcreworkMonsterKey: petKey,
        groundOffsetY: mt?.groundOffsetY || 0,
        shadowOffsetX: mt?.shadowOffsetX || 0,
        shadowOffsetY: mt?.shadowOffsetY || 0,
        thumbUrl: `${pagesBaseUrl}/assets/monsters/${petKey}/thumb.webp`,
        atlasJsonUrl: `${pagesBaseUrl}/assets/monsters/${petKey}/atlas.json`,
        atlasWebpUrl: `${pagesBaseUrl}/assets/monsters/${petKey}/atlas.webp`,
      };
    });

    const equippedPets = allPets
      .filter((p) => p.deploySlot !== null && !p.isTemporarilyDisabled)
      .sort((a, b) => Number(a.deploySlot) - Number(b.deploySlot))
      .slice(0, 3);

    const primaryFollowerPet =
      equippedPets.find((p) => p.deploySlot === 1) || equippedPets[0] || null;

    return {
      allPets,
      equippedPets,
      primaryFollowerPet,
    };
  }

  /**
   * Gera um novo Pet procedural para o personagem a partir de um `MonsterTemplate` com `isTamableAsPet = true`.
   */
  public static async generatePetForCharacter(
    prisma: PrismaClient,
    characterId: number,
    monsterTemplateId: number,
    customNickname?: string
  ) {
    const mt = await prisma.monsterTemplate.findUnique({
      where: { id: Number(monsterTemplateId) },
    });
    if (!mt) {
      throw new Error(`Monstro #${monsterTemplateId} não encontrado.`);
    }
    if (!mt.isActive || !mt.isTamableAsPet) {
      throw new Error('Este monstro não está ativo ou não está marcado como Pet Capturável.');
    }

    await SnapshotManager.syncTableSequence(prisma, 'character_pets');

    const existingPets = await prisma.characterPet.findMany({
      where: { characterId: Number(characterId) },
      select: { deploySlot: true },
    });
    const usedSlots = new Set(existingPets.map((p: any) => Number(p.deploySlot)).filter((s) => [1, 2, 3].includes(s)));
    let assignedSlot: number | null = null;
    for (const candidate of [1, 2, 3]) {
      if (!usedSlots.has(candidate)) {
        assignedSlot = candidate;
        break;
      }
    }

    const i18nMap = await I18nCache.getTranslations(prisma, 'pt-BR');
    const speciesName = i18nMap.get(mt.nameI18nKey) ?? mt.code;
    const nickname = customNickname && customNickname.trim()
      ? customNickname.trim().slice(0, 24)
      : speciesName;

    const rolledElement = this.rollPetElement();
    const initialSkills = this.normalizePetSkillIds(mt.skillIdsJson);

    const created = await (prisma.characterPet as any).create({
      data: {
        characterId: Number(characterId),
        monsterTemplateId: mt.id,
        nickname,
        elementCode: rolledElement,
        level: 1,
        experience: 0n,
        unspentStatPoints: this.INITIAL_FREE_POINTS_LV1,
        distributedStatsJson: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
        skillIdsJson: initialSkills,
        deploySlot: assignedSlot,
        equippedItemsJson: {},
      },
      include: { monsterTemplate: true },
    });

    return created;
  }

  /**
   * Distribui pontos de atributo base livres (`unspentStatPoints`) do Pet em VIT, STR, INT, WIS, AGI, DEX.
   */
  public static async distributeStatPoints(
    prisma: PrismaClient,
    characterId: number,
    petId: number,
    allocations: Partial<BaseStatsMap>
  ) {
    const pet: any = await prisma.characterPet.findUnique({
      where: { id: Number(petId) },
      include: { monsterTemplate: true },
    });
    if (!pet || Number(pet.characterId) !== Number(characterId)) {
      throw new Error('Pet não encontrado ou não pertence a este personagem.');
    }

    let totalRequested = 0;
    const cleanAlloc: BaseStatsMap = { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    for (const key of this.BASE_ATTR_KEYS) {
      const val = Math.floor(Number((allocations as any)?.[key]) || 0);
      if (val < 0) {
        throw new Error('Não é permitido subtrair pontos já confirmados.');
      }
      cleanAlloc[key] = val;
      totalRequested += val;
    }

    if (totalRequested <= 0) {
      throw new Error('Selecione ao menos 1 ponto de atributo para distribuir.');
    }

    const available = Number(pet.unspentStatPoints ?? 0);
    if (totalRequested > available) {
      throw new Error(`Pontos insuficientes no Pet (disponível: ${available}, solicitado: ${totalRequested}).`);
    }

    const currentDist = this.normalizeDistributedStats(pet.distributedStatsJson);
    const updatedDist: BaseStatsMap = {
      VIT: currentDist.VIT + cleanAlloc.VIT,
      STR: currentDist.STR + cleanAlloc.STR,
      INT: currentDist.INT + cleanAlloc.INT,
      WIS: currentDist.WIS + cleanAlloc.WIS,
      AGI: currentDist.AGI + cleanAlloc.AGI,
      DEX: currentDist.DEX + cleanAlloc.DEX,
    };

    return await (prisma.characterPet as any).update({
      where: { id: pet.id },
      data: {
        unspentStatPoints: available - totalRequested,
        distributedStatsJson: updatedDist,
      },
      include: { monsterTemplate: true },
    });
  }

  /**
   * Define o slot de formação do Pet (`1`, `2`, `3` ou `null` para reserva).
   * - Slot 1: Pet Principal (caminha junto ao jogador no mapa e entra em combate solo e em equipe).
   * - Slots 2 e 3: Pets Auxiliares (entram em combate solo).
   */
  public static async setDeploySlot(
    prisma: PrismaClient,
    characterId: number,
    petId: number,
    targetSlot: number | null
  ) {
    const pet: any = await prisma.characterPet.findUnique({
      where: { id: Number(petId) },
      include: { monsterTemplate: true },
    });
    if (!pet || Number(pet.characterId) !== Number(characterId)) {
      throw new Error('Pet não encontrado ou não pertence a este personagem.');
    }

    const normalizedSlot =
      targetSlot !== null && targetSlot !== undefined && [1, 2, 3].includes(Number(targetSlot))
        ? Number(targetSlot)
        : null;

    if (normalizedSlot !== null && this.isPetTemporarilyDisabled(pet.monsterTemplate)) {
      throw new Error('Este pet está Inativado Temporariamente e não pode ser colocado em formação.');
    }

    await prisma.$transaction(async (tx: any) => {
      if (normalizedSlot !== null) {
        const occupant = await tx.characterPet.findFirst({
          where: {
            characterId: Number(characterId),
            deploySlot: normalizedSlot,
            id: { not: pet.id },
          },
        });
        if (occupant) {
          await tx.characterPet.update({
            where: { id: occupant.id },
            data: { deploySlot: pet.deploySlot ?? null },
          });
        }
      }

      await tx.characterPet.update({
        where: { id: pet.id },
        data: { deploySlot: normalizedSlot },
      });
    });

    MapPresenceService.invalidateCharacterCache(characterId);

    return await prisma.characterPet.findUnique({
      where: { id: pet.id },
      include: { monsterTemplate: true },
    });
  }

  /**
   * Fixa até 3 habilidades livres da tabela `skill_templates` no Pet.
   */
  public static async setPetSkills(
    prisma: PrismaClient,
    characterId: number,
    petId: number,
    requestedSkillIds: number[]
  ) {
    const pet: any = await prisma.characterPet.findUnique({
      where: { id: Number(petId) },
    });
    if (!pet || Number(pet.characterId) !== Number(characterId)) {
      throw new Error('Pet não encontrado ou não pertence a este personagem.');
    }

    const uniqueIds = Array.from(
      new Set((Array.isArray(requestedSkillIds) ? requestedSkillIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
    );

    if (uniqueIds.length > this.MAX_PET_SKILLS) {
      throw new Error(`Um Pet pode ter no máximo ${this.MAX_PET_SKILLS} habilidades fixadas.`);
    }

    if (uniqueIds.length > 0) {
      const validSkills = await prisma.skillTemplate.findMany({
        where: { id: { in: uniqueIds }, isActive: true },
        select: { id: true },
      });
      const validSet = new Set(validSkills.map((s) => s.id));
      const invalid = uniqueIds.filter((id) => !validSet.has(id));
      if (invalid.length > 0) {
        throw new Error(`Habilidade(s) inválida(s) ou inativa(s): #${invalid.join(', #')}.`);
      }
    }

    return await (prisma.characterPet as any).update({
      where: { id: pet.id },
      data: { skillIdsJson: uniqueIds },
      include: { monsterTemplate: true },
    });
  }

  /**
   * Renomeia um Pet do jogador.
   */
  public static async renamePet(
    prisma: PrismaClient,
    characterId: number,
    petId: number,
    nickname: string
  ) {
    const clean = String(nickname || '').trim();
    if (clean.length < 2 || clean.length > 24) {
      throw new Error('O apelido do Pet deve ter entre 2 e 24 caracteres.');
    }
    const pet = await prisma.characterPet.findUnique({ where: { id: Number(petId) } });
    if (!pet || Number(pet.characterId) !== Number(characterId)) {
      throw new Error('Pet não encontrado ou não pertence a este personagem.');
    }
    return await prisma.characterPet.update({
      where: { id: pet.id },
      data: { nickname: clean },
      include: { monsterTemplate: true },
    });
  }

  /**
   * Quando um Monstro é excluído no `/admin`, devolve todos os equipamentos equipados nos pets
   * daquela espécie para a mochila dos respectivos jogadores e exclui os registros dos pets.
   */
  public static async handleMonsterTemplateDeletion(
    prisma: PrismaClient,
    monsterTemplateId: number
  ): Promise<{ affectedPets: number; returnedEquipments: number }> {
    const pets = await prisma.characterPet.findMany({
      where: { monsterTemplateId: Number(monsterTemplateId) },
    });

    let returnedEquipments = 0;
    for (const pet of pets) {
      const eqMap = (pet.equippedItemsJson && typeof pet.equippedItemsJson === 'object'
        ? (pet.equippedItemsJson as Record<string, number>)
        : {}) as Record<string, number>;

      for (const rawItemId of Object.values(eqMap)) {
        const itemId = Number(rawItemId);
        if (Number.isInteger(itemId) && itemId > 0) {
          try {
            await CharacterInventoryService.addItem(prisma, pet.characterId, itemId, 1);
            returnedEquipments += 1;
          } catch (err: any) {
            console.warn(`[CharacterPetService] Aviso ao devolver equipamento #${itemId} do pet #${pet.id}:`, err?.message || err);
          }
        }
      }
    }

    if (pets.length > 0) {
      await prisma.characterPet.deleteMany({
        where: { monsterTemplateId: Number(monsterTemplateId) },
      });
    }

    return { affectedPets: pets.length, returnedEquipments };
  }

  /**
   * Retorna o payload completo e atualizado de Pets para um Personagem.
   */
  public static async getCharacterPetsPayload(
    prisma: PrismaClient,
    characterId: number,
    pagesBaseUrl: string = '/api/assets/mcrework'
  ) {
    const [rawPets, i18nMap, expMap, scalingCtx] = await Promise.all([
      prisma.characterPet.findMany({
        where: { characterId: Number(characterId) },
        include: { monsterTemplate: true },
        orderBy: { id: 'asc' },
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
      CharacterProgressionService.getExperienceMap(prisma, 1),
      MonsterCombatBuilder.loadScalingContext(prisma),
    ]);

    return this.serializeCharacterPets(rawPets, i18nMap, expMap, scalingCtx, pagesBaseUrl);
  }

  /**
   * Roteador HTTP modular para todos os endpoints de Pets de um Personagem (`/api/play/characters/:charId/pets*`).
   */
  public static async handlePlayPetsRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    prisma: PrismaClient,
    verifyOwnership: (charId: number) => Promise<boolean>,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void
  ): Promise<boolean> {
    const baseMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/pets(?:\/(.*))?$/);
    if (!baseMatch) return false;

    const charId = Number(baseMatch[1]);
    const subPath = (baseMatch[2] || '').trim();

    if (!(await verifyOwnership(charId))) {
      sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
      return true;
    }

    try {
      // GET /api/play/characters/:charId/pets
      if (!subPath && method === 'GET') {
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 200, payload);
        return true;
      }

      // POST /api/play/characters/:charId/pets/generate
      if (subPath === 'generate' && method === 'POST') {
        const body = await readJsonBody<{ monsterTemplateId: number; nickname?: string }>(req);
        await this.generatePetForCharacter(prisma, charId, Number(body.monsterTemplateId), body.nickname);
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 201, payload);
        return true;
      }

      // POST /api/play/characters/:charId/pets/:petId/distribute-stats
      const distMatch = subPath.match(/^(\d+)\/distribute-stats$/);
      if (distMatch && method === 'POST') {
        const petId = Number(distMatch[1]);
        const body = await readJsonBody<{ allocations: Partial<BaseStatsMap> }>(req);
        await this.distributeStatPoints(prisma, charId, petId, body.allocations || {});
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 200, payload);
        return true;
      }

      // POST /api/play/characters/:charId/pets/:petId/deploy-slot
      const slotMatch = subPath.match(/^(\d+)\/deploy-slot$/);
      if (slotMatch && method === 'POST') {
        const petId = Number(slotMatch[1]);
        const body = await readJsonBody<{ deploySlot: number | null }>(req);
        await this.setDeploySlot(prisma, charId, petId, body.deploySlot ?? null);
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 200, payload);
        return true;
      }

      // POST /api/play/characters/:charId/pets/:petId/skills
      const skillsMatch = subPath.match(/^(\d+)\/skills$/);
      if (skillsMatch && method === 'POST') {
        const petId = Number(skillsMatch[1]);
        const body = await readJsonBody<{ skillIds: number[] }>(req);
        await this.setPetSkills(prisma, charId, petId, body.skillIds || []);
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 200, payload);
        return true;
      }

      // POST /api/play/characters/:charId/pets/:petId/rename
      const renameMatch = subPath.match(/^(\d+)\/rename$/);
      if (renameMatch && method === 'POST') {
        const petId = Number(renameMatch[1]);
        const body = await readJsonBody<{ nickname: string }>(req);
        await this.renamePet(prisma, charId, petId, body.nickname);
        const payload = await this.getCharacterPetsPayload(prisma, charId);
        sendJson(res, 200, payload);
        return true;
      }
    } catch (err: any) {
      sendJson(res, 400, { error: err?.message || 'Erro ao processar operação de Pet.' });
      return true;
    }

    return false;
  }
}
