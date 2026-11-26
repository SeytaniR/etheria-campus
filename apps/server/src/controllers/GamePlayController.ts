/**
 * @file apps/server/src/controllers/GamePlayController.ts
 * @module @etheria/server
 * @description Controlador Orientado a Objetos para a Rota dos Jogadores (`/play`) e Painel GM (`/gm`).
 * @rules
 *   1. Sorteia o Elemento inicial do Personagem respeitando a Regra Trancada:
 *      - `NEUTRAL`: 10% de chance (0.10).
 *      - Elementos Ativos (`FIRE`, `EARTH`, `AIR`, `WATER`): 20% de peso relativo cada (dividem os 90% restantes igualmente).
 *   2. Posiciona novos personagens no Ponto de Spawn (`spawnX, spawnY`) do Mapa #1 (`Vila Izumo`).
 *   3. Valida colisão poligonal no servidor usando `MapPolygonMesh` (`@etheria/shared`), exceto quando um GM/ADMIN
 *      ativa explicitamente o modo No-Clip de inspeção.
 *   4. Processa travessia de Portais Pareados (`Entrada <-> Saída`), função "Destravar Personagem" (Unstuck para o
 *      `spawnX, spawnY` do mapa atual) e ferramentas GM (Teleporte instantâneo entre mapas, ajuste de nível/elemento para testes).
 * @dependencies @etheria/database, @etheria/shared
 */

import { PrismaClient, SnapshotManager, I18nCache } from '@etheria/database';
import { GameRulesConstants, MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CharacterProgressionService } from './CharacterProgressionService.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import { MonsterMetaQuestService } from './MonsterMetaQuestService.js';
import { CharacterPetService } from './CharacterPetService.js';
import { MonsterCombatBuilder, type MonsterScalingContext } from './MonsterCombatBuilder.js';
import { DungeonService } from './DungeonService.js';
import { CharacterEquipmentService, type CharacterVisualAppearanceDto } from './CharacterEquipmentService.js';
import { MapRuntimeCacheService } from './MapRuntimeCacheService.js';
import { PlayerMapTravelService, type GmTeleportDto } from './PlayerMapTravelService.js';
import { InputSanitizer } from '../security/InputSanitizer.js';

export type { GmTeleportDto };

export interface CreateCharacterDto {
  name: string;
  classTemplateId: number;
}

export interface SyncPositionDto {
  mapId: number;
  posX: number;
  posY: number;
  noClip?: boolean;
  isFlying?: boolean;
}

export class GamePlayController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly assetMirrorService: AssetMirrorService;
  private readonly mcreworkPagesBaseUrl = '/api/assets/mcrework';

  /**
   * Velocidade de movimento base autoritária dos jogadores no mapa 2.5D (em pixels por segundo).
   * Reduzida em 20% do valor anterior de 210 px/s (210 * 0.80 = 168 px/s).
   */
  public static readonly AUTHORITATIVE_BASE_MOVE_SPEED = GameRulesConstants.AUTHORITATIVE_BASE_MOVE_SPEED;
  private readonly mapTravelService: PlayerMapTravelService;

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService ?? new AssetMirrorService();
    this.mapTravelService = new PlayerMapTravelService(prisma, this.assetMirrorService);
  }

  /**
   * Sorteia o Elemento inicial conforme a regra oficial do GDD:
   * - 10% de chance de `NEUTRAL` (penalizado).
   * - 90% distribuídos igualmente entre os 4 elementos ativos (`FIRE`, `EARTH`, `AIR`, `WATER`).
   */
  public rollInitialElement(): string {
    const roll = Math.random();
    if (roll < 0.10) {
      return 'NEUTRAL';
    }
    const activeElements = GameRulesConstants.ACTIVE_ELEMENTS;
    const idx = Math.floor(Math.random() * activeElements.length);
    return activeElements[idx] ?? 'FIRE';
  }

  /**
   * Carrega os dados de inicialização para a Rota `/play`:
   * - Classes/Personagens disponíveis (`class_templates`)
   * - Elementos (`elements`), Raças (`races`) e Matriz de Conversão de Atributos (`attribute_conversions`)
   * - Lista de Mapas ativos (para HUD e Teleporte GM)
   * - Lista de Personagens criados pelo usuário logado (`player_characters`)
   */
  public async getPlayBootstrap(userAccountId: number) {
    const i18nMap = await I18nCache.getTranslations(this.prisma);

    const classTemplates = (
      await this.prisma.classTemplate.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
        include: { race: true },
      })
    ).map((ct) => ({
      ...ct,
      namePtBr: i18nMap.get(ct.nameI18nKey) ?? ct.code,
      descriptionPtBr: ct.descriptionI18nKey ? (i18nMap.get(ct.descriptionI18nKey) ?? '') : '',
      raceNamePtBr: ct.race ? (i18nMap.get(ct.race.nameI18nKey) ?? ct.race.code) : ct.raceCode,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.mcreworkCharKey}/thumb.webp`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.mcreworkCharKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.mcreworkCharKey}/atlas.webp`,
      rebornThumbUrl: ct.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.rebornMcreworkCharKey}/thumb.webp`
        : null,
      rebornAtlasJsonUrl: ct.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.rebornMcreworkCharKey}/atlas.json`
        : null,
      rebornAtlasWebpUrl: ct.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${ct.rebornMcreworkCharKey}/atlas.webp`
        : null,
    }));

    const elements = (await this.prisma.element.findMany({ orderBy: { code: 'asc' } })).map((e) => ({
      ...e,
      namePtBr: i18nMap.get(e.nameI18nKey) ?? e.code,
    }));

    const races = (await this.prisma.race.findMany({ orderBy: { code: 'asc' } })).map((r) => ({
      ...r,
      namePtBr: i18nMap.get(r.nameI18nKey) ?? r.code,
    }));

    const combatAttributes = (await this.prisma.combatAttribute.findMany()).map((ca) => ({
      ...ca,
      namePtBr: i18nMap.get(ca.nameI18nKey) ?? ca.code,
    }));

    const attributeConversions = await this.prisma.attributeConversion.findMany();
    const elementMatchups = await this.prisma.elementMatchup.findMany();

    const maps = (
      await this.prisma.gameMap.findMany({
        where: { isActive: true },
        orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
        include: { mapType: true },
      })
    ).map((m) => ({
      id: m.id,
      code: m.code,
      namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
      requiredLevel: m.requiredLevel,
      allowMonsterSpawn: m.mapType.allowMonsterSpawn,
      encounterRatePct: MapSpawnResolver.resolveEffectiveEncounterRate(
        m.mapType.allowMonsterSpawn,
        m.encounterRatePct,
      ),
      spawnX: m.spawnX,
      spawnY: m.spawnY,
      mapTypeCode: m.mapType.code,
      mapTypeNamePtBr: i18nMap.get(m.mapType.nameI18nKey) ?? m.mapType.code,
      pvpRule: m.mapType.pvpRule,
    }));

    const mapNameById = new Map<number, string>();
    for (const m of maps) {
      mapNameById.set(m.id, m.namePtBr);
    }

    const [rawCharacters, expMap, scalingCtx] = await Promise.all([
      this.prisma.playerCharacter.findMany({
        where: { userAccountId },
        orderBy: { id: 'asc' },
        include: {
          userAccount: { select: { crystals: true } },
          classTemplate: true,
          pets: {
            include: {
              monsterTemplate: true,
            },
          },
        },
      }),
      CharacterProgressionService.getExperienceMap(this.prisma, 1),
      MonsterCombatBuilder.loadScalingContext(this.prisma),
    ]);
    const visualMap = await CharacterEquipmentService.loadVisualAppearanceByCharId(this.prisma, rawCharacters);
    const characters = rawCharacters.map((c) => this.serializeCharacter(c, i18nMap, mapNameById, expMap, scalingCtx, visualMap.get(c.id)));

    // Garante que todas as Quests Meta procedurais estejam sincronizadas e ativas para os personagens do jogador
    try {
      await MonsterMetaQuestService.syncAllMetaQuests(this.prisma);
      for (const rc of rawCharacters) {
        await MonsterMetaQuestService.ensurePlayerMetaQuests(this.prisma, rc.id);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar Quests Meta no bootstrap:', err);
    }

    const [availableMonstersAsPets, uiLayoutTemplates] = await Promise.all([
      this.prisma.monsterTemplate.findMany({
        where: { isActive: true, isTamableAsPet: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.clientUiLayoutTemplate
        ? this.prisma.clientUiLayoutTemplate.findMany({
            where: { isActive: true },
            orderBy: { id: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const availablePets = availableMonstersAsPets.map((mt) => ({
      id: mt.id,
      code: mt.code,
      namePtBr: i18nMap.get(mt.nameI18nKey) ?? mt.code,
      descriptionPtBr: mt.descriptionI18nKey ? (i18nMap.get(mt.descriptionI18nKey) ?? '') : '',
      mcreworkMonsterKey: mt.mcreworkMonsterKey,
      raceCode: mt.raceCode,
      fixedElementCode: mt.fixedElementCode,
      rarityTier: mt.rarityTier || 'F',
      combatStyle: mt.combatStyle,
      attackRange: mt.attackRange,
      damageType: mt.damageType,
      groundOffsetY: mt.groundOffsetY,
      baseAttributesJson: mt.baseAttributesJson,
      baseCombatAttributesJson: mt.baseCombatAttributesJson ?? {},
      skillIdsJson: mt.skillIdsJson ?? [],
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/thumb.webp`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/atlas.webp`,
    }));

    const skillTemplates = (await this.prisma.skillTemplate.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } })).map((sk: any) => ({
      id: sk.id,
      code: sk.code,
      namePtBr: i18nMap.get(sk.nameI18nKey) ?? sk.code,
      descriptionPtBr: sk.descriptionI18nKey ? (i18nMap.get(sk.descriptionI18nKey) ?? '') : '',
      iconUrl: sk.mcreworkIconKey
        ? AssetMirrorService.toSameOriginUrl(sk.mcreworkIconKey)
        : `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100156.png`,
      skillType: sk.skillType,
      triggerType: sk.triggerType,
      targetType: sk.targetType,
      elementCode: sk.elementCode,
      mpCost: sk.mpCost,
      apCost: sk.apCost,
      cooldownSeconds: sk.cooldownSeconds,
      castRange: sk.castRange,
      aoeRadius: sk.aoeRadius,
      damageMultiplier: sk.damageMultiplier,
      healingMultiplier: sk.healingMultiplier,
      fixedDamage: sk.fixedDamage,
      fixedHealing: sk.fixedHealing,
    }));

    return {
      baseMoveSpeed: GamePlayController.AUTHORITATIVE_BASE_MOVE_SPEED,
      classTemplates,
      elements,
      races,
      combatAttributes,
      attributeConversions,
      elementMatchups,
      maps,
      characters,
      availablePets,
      uiLayoutTemplates,
      skillTemplates,
    };
  }

  /**
   * Serializa um registro `PlayerCharacter` convertendo `BigInt` (`experience`) e enriquecendo URLs de sprite.
   */
  private serializeCharacter(
    c: any,
    i18nMap: Map<string, string>,
    mapNameById?: Map<number, string>,
    expMap?: Map<number, number>,
    scalingCtx?: MonsterScalingContext,
    visualAppearance?: CharacterVisualAppearanceDto
  ) {
    const classNamePtBr = c.classTemplate
      ? (i18nMap.get(c.classTemplate.nameI18nKey) ?? c.classTemplate.code)
      : `Classe #${c.classTemplateId}`;
    const elementNamePtBr = i18nMap.get(`element.${c.elementCode.toLowerCase()}.name`) ?? c.elementCode;
    const isReborn = Boolean(c.isReborn);
    const ct = c.classTemplate;
    const isUsingReborn = isReborn && Boolean(ct?.rebornMcreworkCharKey);
    const charKey = isUsingReborn
      ? ct.rebornMcreworkCharKey!
      : (ct?.mcreworkCharKey ?? 'PC_MALE_000002');
    const groundOffsetY = isUsingReborn
      ? (ct?.rebornGroundOffsetY ?? 0)
      : (ct?.groundOffsetY ?? 0);
    const shadowOffsetX = isUsingReborn
      ? (ct?.rebornShadowOffsetX ?? 0)
      : (ct?.shadowOffsetX ?? 0);
    const shadowOffsetY = isUsingReborn
      ? (ct?.rebornShadowOffsetY ?? 0)
      : (ct?.shadowOffsetY ?? 0);

    const charLvl = c.level || 1;
    const charMaxXp = expMap?.get(charLvl) ?? (charLvl * 42000);
    const defaultScalingCtx: MonsterScalingContext = scalingCtx || {
      conversions: [],
      globalDefaultMoveSpeed: 160,
      elementMatchups: [],
    };
    const petsPayload = CharacterPetService.serializeCharacterPets(
      c.pets || [],
      i18nMap,
      expMap,
      defaultScalingCtx,
      this.mcreworkPagesBaseUrl
    );

    return {
      id: c.id,
      userAccountId: c.userAccountId,
      name: c.name,
      classTemplateId: c.classTemplateId,
      classCode: c.classTemplate?.code ?? `class_${c.classTemplateId}`,
      classNamePtBr,
      raceCode: c.classTemplate?.raceCode ?? 'HUMAN',
      combatStyle: (c.classTemplate as any)?.combatStyle || 'MELEE',
      attackRange: (c.classTemplate as any)?.attackRange || 60,
      damageType: (c.classTemplate as any)?.damageType || 'PHYSICAL',
      isReborn,
      groundOffsetY,
      shadowOffsetX,
      shadowOffsetY,
      mcreworkCharKey: charKey,
      rebornMcreworkCharKey: ct?.rebornMcreworkCharKey ?? null,
      rebornGroundOffsetY: ct?.rebornGroundOffsetY ?? 0,
      rebornShadowOffsetX: ct?.rebornShadowOffsetX ?? 0,
      rebornShadowOffsetY: ct?.rebornShadowOffsetY ?? 0,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charKey}/thumb.webp`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${charKey}/atlas.webp`,
      elementCode: c.elementCode,
      elementNamePtBr,
      level: c.level,
      experience: Number(c.experience ?? 0),
      maxXp: charMaxXp,
      gold: Number(c.gold ?? 0),
      crystals: Math.max(0, Number(c.userAccount?.crystals ?? 0)),
      diamonds: Math.max(0, Number(c.userAccount?.crystals ?? 0)),
      unspentStatPoints: c.unspentStatPoints,
      distributedStatsJson: c.distributedStatsJson,
      equippedItemsJson: c.equippedItemsJson || {},
      visualAppearance: visualAppearance || { equippedWings: null, equippedMount: null, equippedWeapon: null },
      skillIdsJson: Array.isArray(c.classTemplate?.skillIdsJson) ? c.classTemplate.skillIdsJson : [],
      baseAttributesJson: c.classTemplate?.baseAttributesJson ?? {
        VIT: 10,
        STR: 10,
        INT: 10,
        WIS: 10,
        AGI: 10,
        DEX: 10,
      },
      baseCombatAttributesJson: (c.classTemplate as any)?.baseCombatAttributesJson ?? {},
      growthPerLevelJson: c.classTemplate?.growthPerLevelJson ?? {
        VIT: 2,
        STR: 2,
        INT: 2,
        WIS: 2,
        AGI: 2,
        DEX: 2,
      },
      currentMapId: c.currentMapId ?? 1,
      currentMapNamePtBr: mapNameById?.get(c.currentMapId ?? 1) ?? `Mapa #${c.currentMapId ?? 1}`,
      posX: c.posX,
      posY: c.posY,
      isCriminal: c.isCriminal,
      isFlying: Boolean((c as any).isFlying && visualAppearance?.equippedMount),
      pets: petsPayload.allPets,
      equippedPets: petsPayload.equippedPets,
      primaryFollowerPet: petsPayload.primaryFollowerPet,
    };
  }

  /**
   * Retorna os detalhes autoritativos completos de um Personagem para a ficha de atributos/status.
   */
  public async getCharacterById(userAccountId: number, role: string, characterId: number) {
    const [i18nMap, expMap, scalingCtx] = await Promise.all([
      I18nCache.getTranslations(this.prisma),
      CharacterProgressionService.getExperienceMap(this.prisma, 1),
      MonsterCombatBuilder.loadScalingContext(this.prisma),
    ]);
    const isElevated = ['ADMIN', 'GM', 'DEV'].includes(role);
    const c = await this.prisma.playerCharacter.findFirst({
      where: isElevated ? { id: characterId } : { id: characterId, userAccountId },
      include: {
        userAccount: { select: { crystals: true } },
        classTemplate: true,
        pets: {
          include: {
            monsterTemplate: true,
          },
        },
      },
    });
    if (!c) {
      throw new Error('Personagem não encontrado ou acesso não autorizado.');
    }
    const map = c.currentMapId ? await this.prisma.gameMap.findUnique({ where: { id: c.currentMapId } }) : null;
    const mapNameById = new Map<number, string>();
    if (map) {
      mapNameById.set(map.id, i18nMap.get(map.nameI18nKey) ?? map.code);
    }
    const visMap = await CharacterEquipmentService.loadVisualAppearanceByCharId(this.prisma, [c]);
    return this.serializeCharacter(c, i18nMap, mapNameById, expMap, scalingCtx, visMap.get(c.id));
  }

  /**
   * Cria um novo Personagem para o jogador logado:
   * - Valida a Classe/Personagem escolhida em `class_templates`
   * - Sorteia o Elemento inicial (10% NEUTRAL vs 20% cada elemento ativo)
   * - Posiciona no Ponto de Spawn oficial (`spawnX, spawnY`) do Mapa #1
   */
  public async createCharacter(userAccountId: number, dto: CreateCharacterDto) {
    const cleanName = InputSanitizer.validateCharacterName(dto.name ?? '');

    const existingName = await this.prisma.playerCharacter.findUnique({
      where: { name: cleanName },
    });
    if (existingName) {
      throw new Error(`Já existe um personagem chamado "${cleanName}". Escolha outro nome.`);
    }

    const classId = Number(dto.classTemplateId);
    const classTemplate = await this.prisma.classTemplate.findUnique({
      where: { id: classId },
    });
    if (!classTemplate) {
      throw new Error('Selecione uma Classe/Personagem válida cadastrada na tabela de Personagens.');
    }

    // Busca o Mapa Inicial (Mapa #1 - Vila Izumo ou o primeiro mapa ativo do banco)
    let startMap = await this.prisma.gameMap.findUnique({ where: { id: 1 } });
    if (!startMap) {
      startMap = await this.prisma.gameMap.findFirst({ orderBy: { id: 'asc' } });
    }

    const startMapId = startMap ? startMap.id : null;
    const spawnX = startMap ? startMap.spawnX : 500;
    const spawnY = startMap ? startMap.spawnY : 500;
    const rolledElement = this.rollInitialElement();

    const created = await this.prisma.playerCharacter.create({
      data: {
        userAccountId,
        name: cleanName,
        classTemplateId: classTemplate.id,
        elementCode: rolledElement,
        level: 1,
        experience: 0n,
        unspentStatPoints: 5,
        distributedStatsJson: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
        equippedItemsJson: {},
        currentMapId: startMapId,
        posX: spawnX,
        posY: spawnY,
      },
      include: {
        userAccount: { select: { crystals: true } },
        classTemplate: true,
      },
    });

    const i18nMap = await I18nCache.getTranslations(this.prisma);
    await MonsterMetaQuestService.ensurePlayerMetaQuests(this.prisma, created.id);

    return this.serializeCharacter(created, i18nMap);
  }

  /**
   * Exclui um personagem pertencente ao jogador logado.
   */
  public async deleteCharacter(userAccountId: number, characterId: number) {
    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char || char.userAccountId !== userAccountId) {
      throw new Error('Personagem não encontrado ou não pertence à sua conta.');
    }
    await MapRuntimeCacheService.flushAndInvalidateCharacter(this.prisma, characterId);
    await this.prisma.playerCharacter.delete({ where: { id: characterId } });
    return { deletedId: characterId };
  }

  /**
   * Carrega o estado completo de um Mapa para renderização e exploração no cliente `/play`.
   */
  public async getMapStateForPlay(requestedMapId: number) {
    return this.mapTravelService.getMapStateForPlay(requestedMapId);
  }

  /**
   * Valida e persiste a posição do personagem no servidor.
   * Verifica a malha de colisão (`MapPolygonMesh`) exceto se `noClip` estiver ativo para um GM/ADMIN.
   */
  public async syncPosition(
    userAccountId: number,
    userRole: string,
    characterId: number,
    dto: SyncPositionDto
  ) {
    return MapRuntimeCacheService.validateAndBufferPosition(
      this.prisma,
      this.assetMirrorService,
      userAccountId,
      userRole,
      characterId,
      dto,
      GamePlayController.AUTHORITATIVE_BASE_MOVE_SPEED
    );
  }

  /**
   * Executa a travessia autoritária de um Portal (`map_portals`) interligado (Entrada <-> Saída).
   */
  public async traversePortal(userAccountId: number, characterId: number, portalId: number) {
    return this.mapTravelService.traversePortal(userAccountId, characterId, portalId);
  }

  /**
   * Destrava o personagem (`🆘 Destravar Personagem`), retornando-o ao Ponto de Spawn (`spawnX, spawnY`) do mapa atual.
   */
  public async unstuckCharacter(userAccountId: number, characterId: number) {
    return this.mapTravelService.unstuckCharacter(userAccountId, characterId);
  }

  /**
   * Ferramenta exclusiva para contas `GM` ou `ADMIN`: Teleporta o personagem instantaneamente para qualquer mapa salvo.
   */
  public async gmTeleport(
    userAccountId: number,
    userRole: string,
    characterId: number,
    dto: GmTeleportDto
  ) {
    return this.mapTravelService.gmTeleport(userAccountId, userRole, characterId, dto);
  }

  /**
   * Alterna o estado de Reencarnado / Reborn do personagem, alternando entre o visual padrão e o visual reencarnado.
   */
  public async toggleReborn(userAccountId: number, role: string, characterId: number) {
    const char = await this.prisma.playerCharacter.findUnique({
      where: { id: characterId },
      include: { classTemplate: true },
    });

    if (!char) {
      throw new Error('Personagem não encontrado.');
    }

    if (!['ADMIN', 'GM', 'DEV'].includes(role)) {
      throw new Error('Apenas contas GM, ADMIN ou DEV podem alternar o estado Reborn diretamente.');
    }

    const nextReborn = !char.isReborn;
    const updated = await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: { isReborn: nextReborn },
      include: { classTemplate: true },
    });

    const i18nMap = await I18nCache.getTranslations(this.prisma);
    return this.serializeCharacter(updated, i18nMap);
  }

  /**
   * Calibra e salva a distância dos pés ao chão (`ground_offset_y`) diretamente na classe do personagem.
   * Se o personagem estiver no modo Reborn, salva em `reborn_ground_offset_y`.
   */
  public async updateClassGroundOffset(userAccountId: number, role: string, characterId: number, offset: number) {
    const char = await this.prisma.playerCharacter.findUnique({
      where: { id: characterId },
      include: { classTemplate: true },
    });

    if (!char || !char.classTemplate) {
      throw new Error('Personagem ou classe não encontrado.');
    }

    if (!['ADMIN', 'GM', 'DEV'].includes(role)) {
      throw new Error('Apenas Administradores ou GMs podem alterar o offset visual de classes.');
    }

    const clampedOffset = Math.max(-60, Math.min(60, Math.round(Number(offset) || 0)));
    const isReborn = Boolean(char.isReborn);

    if (isReborn) {
      await this.prisma.classTemplate.update({
        where: { id: char.classTemplateId },
        data: { rebornGroundOffsetY: clampedOffset },
      });
    } else {
      await this.prisma.classTemplate.update({
        where: { id: char.classTemplateId },
        data: { groundOffsetY: clampedOffset },
      });
    }

    const updatedChar = await this.prisma.playerCharacter.findUnique({
      where: { id: characterId },
      include: { classTemplate: true },
    });

    const i18nMap = await I18nCache.getTranslations(this.prisma);
    return this.serializeCharacter(updatedChar, i18nMap);
  }

  /**
   * Retorna a Carteira de Ouro e a Mochila Básica do Personagem (Base Inicial Incompleta).
   */
  public async getCharacterInventory(characterId: number) {
    return CharacterInventoryService.getWalletAndBag(this.prisma, characterId);
  }
}
