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
import { MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { AssetMirrorService } from './AssetMirrorService.js';

export interface CreateCharacterDto {
  name: string;
  classTemplateId: number;
}

export interface SyncPositionDto {
  mapId: number;
  posX: number;
  posY: number;
  noClip?: boolean;
}

export interface GmTeleportDto {
  targetMapId: number;
  targetX?: number;
  targetY?: number;
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
  public static readonly AUTHORITATIVE_BASE_MOVE_SPEED = 168;

  /**
   * Registro do último sync de movimento por personagem para validação autoritária de velocidade.
   */
  private readonly lastSyncTimes = new Map<number, number>();

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService ?? new AssetMirrorService();
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
    const activeElements = ['FIRE', 'EARTH', 'AIR', 'WATER'];
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
    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

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

    const characters = (
      await this.prisma.playerCharacter.findMany({
        where: { userAccountId },
        orderBy: { id: 'asc' },
        include: {
          classTemplate: true,
          pets: {
            include: {
              monsterTemplate: true,
            },
          },
        },
      })
    ).map((c) => this.serializeCharacter(c, i18nMap, mapNameById));

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
    };
  }

  /**
   * Serializa um registro `PlayerCharacter` convertendo `BigInt` (`experience`) e enriquecendo URLs de sprite.
   */
  private serializeCharacter(c: any, i18nMap: Map<string, string>, mapNameById?: Map<number, string>) {
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
      gold: Number(c.gold ?? 0),
      unspentStatPoints: c.unspentStatPoints,
      distributedStatsJson: c.distributedStatsJson,
      equippedItemsJson: c.equippedItemsJson || {},
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
      equippedPets: (c.pets || []).slice(0, 3).map((cp: any) => {
        const mt = cp.monsterTemplate;
        const petKey = mt?.mcreworkMonsterKey || 'creature_000001';
        const petName = cp.nickname || (mt ? (i18nMap.get(mt.nameI18nKey) ?? mt.code) : `Pet #${cp.id}`);
        return {
          id: cp.id,
          monsterTemplateId: cp.monsterTemplateId,
          nickname: petName,
          level: cp.level || 1,
          elementCode: mt?.fixedElementCode || cp.elementCode || 'NEUTRAL',
          raceCode: mt?.raceCode || 'BEAST',
          rarityTier: mt?.rarityTier || 'F',
          combatStyle: mt?.combatStyle || 'MELEE',
          attackRange: mt?.attackRange || 60,
          damageType: mt?.damageType || 'PHYSICAL',
          baseAttributesJson: mt?.baseAttributesJson || {},
          baseCombatAttributesJson: mt?.baseCombatAttributesJson || {},
          skillIdsJson: mt?.skillIdsJson || [],
          hpPct: 100,
          mpPct: 100,
          xpPct: 60,
          thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${petKey}/thumb.webp`,
        };
      }),
    };
  }

  /**
   * Cria um novo Personagem para o jogador logado:
   * - Valida a Classe/Personagem escolhida em `class_templates`
   * - Sorteia o Elemento inicial (10% NEUTRAL vs 20% cada elemento ativo)
   * - Posiciona no Ponto de Spawn oficial (`spawnX, spawnY`) do Mapa #1
   */
  public async createCharacter(userAccountId: number, dto: CreateCharacterDto) {
    const cleanName = (dto.name ?? '').trim();
    if (cleanName.length < 2 || cleanName.length > 24) {
      throw new Error('O nome do personagem deve ter entre 2 e 24 caracteres.');
    }

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
      include: { classTemplate: true },
    });

    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

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
    await this.prisma.playerCharacter.delete({ where: { id: characterId } });
    return { deletedId: characterId };
  }

  /**
   * Carrega o estado completo de um Mapa para renderização e exploração no cliente `/play`.
   */
  public async getMapStateForPlay(requestedMapId: number) {
    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

    let map = await this.prisma.gameMap.findUnique({
      where: { id: requestedMapId },
      include: {
        mapType: true,
        primaryBiome: true,
        secondaryBiome: true,
        outgoingPortals: {
          include: { targetMap: true },
          orderBy: { id: 'asc' },
        },
        npcs: {
          include: { npcTemplate: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!map) {
      map = await this.prisma.gameMap.findFirst({
        orderBy: { id: 'asc' },
        include: {
          mapType: true,
          primaryBiome: true,
          secondaryBiome: true,
          outgoingPortals: {
            include: { targetMap: true },
            orderBy: { id: 'asc' },
          },
          npcs: {
            include: { npcTemplate: true },
            orderBy: { id: 'asc' },
          },
        },
      });
    }

    if (!map) {
      throw new Error('Nenhum mapa cadastrado no banco de dados.');
    }

    const asset = await this.assetMirrorService.getOrFetchAsset(map.mcreworkMapImage);
    const dims = asset ? AssetMirrorService.getImageDimensions(asset.buffer) : null;
    const bgUrl = `/api/assets/map-image/${map.id}`;

    const effectiveEncounterRate = MapSpawnResolver.resolveEffectiveEncounterRate(
      map.mapType.allowMonsterSpawn,
      map.encounterRatePct,
    );
    const eligibleMonsters = effectiveEncounterRate > 0
      ? await MapSpawnResolver.findEligibleMonstersForMap(this.prisma, map)
      : [];

    return {
      id: map.id,
      code: map.code,
      namePtBr: i18nMap.get(map.nameI18nKey) ?? map.code,
      mcreworkMapImage: map.mcreworkMapImage,
      bgImageUrl: bgUrl,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      requiredLevel: map.requiredLevel,
      encounterRatePct: effectiveEncounterRate,
      canSpawnMonsters: Boolean(
        map.mapType.allowMonsterSpawn && effectiveEncounterRate > 0 && eligibleMonsters.length > 0,
      ),
      levelVarianceMin: map.levelVarianceMin,
      levelVarianceMax: map.levelVarianceMax,
      spawnX: map.spawnX,
      spawnY: map.spawnY,
      overlapOpacity: map.overlapOpacity,
      collisionMeshJson: (map.collisionMeshJson as unknown as MapPolygon[]) ?? [],
      overlapMeshJson: (map.overlapMeshJson as unknown as MapPolygon[]) ?? [],
      mapType: {
        id: map.mapType.id,
        code: map.mapType.code,
        namePtBr: i18nMap.get(map.mapType.nameI18nKey) ?? map.mapType.code,
        pvpRule: map.mapType.pvpRule,
        allowMonsterSpawn: map.mapType.allowMonsterSpawn,
        dominationTarget: map.mapType.dominationTarget,
      },
      primaryBiomeNamePtBr: i18nMap.get(map.primaryBiome.nameI18nKey) ?? map.primaryBiome.code,
      secondaryBiomeNamePtBr: i18nMap.get(map.secondaryBiome.nameI18nKey) ?? map.secondaryBiome.code,
      portals: map.outgoingPortals.map((p) => ({
        id: p.id,
        label: p.label,
        sourceX: p.sourceX,
        sourceY: p.sourceY,
        triggerRadius: p.triggerRadius,
        linkedPortalId: p.linkedPortalId,
        targetMapId: p.targetMapId,
        targetMapNamePtBr: p.targetMap
          ? (i18nMap.get(p.targetMap.nameI18nKey) ?? p.targetMap.code)
          : null,
        targetX: p.targetX,
        targetY: p.targetY,
      })),
      npcs: map.npcs.map((n) => {
        const key = n.npcTemplate.mcreworkNpcKey;
        return {
          id: n.id,
          npcTemplateId: n.npcTemplateId,
          code: n.npcTemplate.code,
          namePtBr: i18nMap.get(n.npcTemplate.nameI18nKey) ?? n.npcTemplate.code,
          mcreworkNpcKey: key,
          isDecorationOnly: n.npcTemplate.isDecorationOnly,
          triggersJson: n.npcTemplate.triggersJson,
          posX: n.posX,
          posY: n.posY,
          direction: n.direction,
          teleportDestinationsJson: n.teleportDestinationsJson,
          thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${key}/thumb.png`,
          atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${key}/atlas.json`,
          atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${key}/atlas.webp`,
        };
      }),
    };
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
    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char || char.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido.');
    }

    const mapId = Number(dto.mapId) || char.currentMapId || 1;
    const map = await this.prisma.gameMap.findUnique({ where: { id: mapId } });
    if (!map) {
      throw new Error('Mapa não encontrado.');
    }

    // Impede que requisições atrasadas do mapa anterior sobrescrevam uma travessia de portal concluída
    if (char.currentMapId && char.currentMapId !== map.id) {
      return {
        ok: false,
        staleMapIgnored: true,
        blocked: false,
        speedClamped: false,
        currentMapId: char.currentMapId,
        posX: char.posX,
        posY: char.posY,
      };
    }

    const asset = await this.assetMirrorService.getOrFetchAsset(map.mcreworkMapImage);
    const dims = asset ? AssetMirrorService.getImageDimensions(asset.buffer) : null;
    const clampBoundX = (val: number) =>
      dims ? Math.max(16, Math.min(dims.width - 16, val)) : Math.max(16, val);
    const clampBoundY = (val: number) =>
      dims ? Math.max(20, Math.min(dims.height - 16, val)) : Math.max(20, val);

    const posX = clampBoundX(Math.round(Number(dto.posX) || map.spawnX));
    const posY = clampBoundY(Math.round(Number(dto.posY) || map.spawnY));
    const isGmNoClip = Boolean(dto.noClip) && (userRole === 'ADMIN' || userRole === 'GM');

    // Validação autoritária de velocidade: impede speedhack em contas normais
    let finalPosX = posX;
    let finalPosY = posY;
    let speedClamped = false;
    const now = Date.now();
    const lastSync = this.lastSyncTimes.get(characterId);
    this.lastSyncTimes.set(characterId, now);

    if (!isGmNoClip && char.currentMapId === map.id && lastSync) {
      const elapsedSec = Math.max(0.1, (now - lastSync) / 1000);
      const dist = Math.hypot(posX - char.posX, posY - char.posY);
      // Margem tolerante (1.5x + 40px) para acomodar pequenas oscilações de latência/ping
      const maxAllowedDist = GamePlayController.AUTHORITATIVE_BASE_MOVE_SPEED * elapsedSec * 1.5 + 40;
      if (dist > maxAllowedDist) {
        const ratio = maxAllowedDist / dist;
        finalPosX = clampBoundX(Math.round(char.posX + (posX - char.posX) * ratio));
        finalPosY = clampBoundY(Math.round(char.posY + (posY - char.posY) * ratio));
        speedClamped = true;
      }
    }

    if (!isGmNoClip) {
      const collisionPolys = Array.isArray(map.collisionMeshJson)
        ? (map.collisionMeshJson as unknown as MapPolygon[])
        : [];
      const mesh = new MapPolygonMesh(collisionPolys);
      if (mesh.containsPoint(finalPosX, finalPosY)) {
        return {
          ok: false,
          blocked: true,
          speedClamped,
          currentMapId: char.currentMapId ?? map.id,
          posX: char.posX,
          posY: char.posY,
        };
      }
    }

    await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: {
        currentMapId: map.id,
        posX: finalPosX,
        posY: finalPosY,
      },
    });

    return {
      ok: true,
      blocked: false,
      speedClamped,
      currentMapId: map.id,
      posX: finalPosX,
      posY: finalPosY,
    };
  }

  /**
   * Executa a travessia autoritária de um Portal (`map_portals`) interligado (Entrada <-> Saída).
   */
  public async traversePortal(userAccountId: number, characterId: number, portalId: number) {
    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char || char.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido.');
    }

    const portal = await this.prisma.mapPortal.findUnique({
      where: { id: portalId },
    });
    if (!portal) {
      throw new Error('Portal não encontrado.');
    }

    if (char.currentMapId && portal.sourceMapId !== char.currentMapId) {
      throw new Error('Este portal pertence a outro mapa.');
    }

    let destMapId = portal.targetMapId;
    let destX = portal.targetX;
    let destY = portal.targetY;
    let partnerPortalId: number | null = portal.linkedPortalId ?? null;
    let arrivalRadius = portal.triggerRadius || 48;

    // Se possui linkedPortalId, busca a posição exata do portal par no mapa de destino
    if (portal.linkedPortalId) {
      const partner = await this.prisma.mapPortal.findUnique({
        where: { id: portal.linkedPortalId },
      });
      if (partner) {
        destMapId = partner.sourceMapId;
        destX = partner.sourceX;
        destY = partner.sourceY;
        partnerPortalId = partner.id;
        arrivalRadius = partner.triggerRadius || 48;
      }
    }

    if (!destMapId) {
      throw new Error(
        `O portal "${portal.label}" ainda não possui um Portal Par de destino vinculado no editor.`
      );
    }

    const destMap = await this.prisma.gameMap.findUnique({ where: { id: destMapId } });
    if (!destMap) {
      throw new Error(`Mapa de destino #${destMapId} não encontrado.`);
    }

    // Calcula ponto seguro de aterrissagem fora do núcleo do portal de chegada para impedir loop de volta
    const asset = await this.assetMirrorService.getOrFetchAsset(destMap.mcreworkMapImage);
    const dims = asset ? AssetMirrorService.getImageDimensions(asset.buffer) : null;
    const collisionPolys = Array.isArray(destMap.collisionMeshJson)
      ? (destMap.collisionMeshJson as unknown as MapPolygon[])
      : [];
    const mesh = new MapPolygonMesh(collisionPolys);

    const clampX = (v: number) => (dims ? Math.max(24, Math.min(dims.width - 24, v)) : Math.max(24, v));
    const clampY = (v: number) => (dims ? Math.max(28, Math.min(dims.height - 24, v)) : Math.max(28, v));

    let safeX = clampX(destX);
    let safeY = clampY(destY);

    if (partnerPortalId) {
      const stepDist = Math.max(62, arrivalRadius + 18);
      const baseAngle = Math.atan2(destMap.spawnY - destY, destMap.spawnX - destX);
      const candidateAngles = [
        baseAngle,
        baseAngle + Math.PI / 4,
        baseAngle - Math.PI / 4,
        baseAngle + Math.PI / 2,
        baseAngle - Math.PI / 2,
        0,
        Math.PI / 2,
        Math.PI,
        -Math.PI / 2,
      ];
      for (const ang of candidateAngles) {
        const cx = clampX(Math.round(destX + Math.cos(ang) * stepDist));
        const cy = clampY(Math.round(destY + Math.sin(ang) * stepDist));
        if (!mesh.containsPoint(cx, cy)) {
          safeX = cx;
          safeY = cy;
          break;
        }
      }
    }

    this.lastSyncTimes.delete(characterId);
    await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: {
        currentMapId: destMapId,
        posX: safeX,
        posY: safeY,
      },
    });

    return {
      currentMapId: destMapId,
      posX: safeX,
      posY: safeY,
      arrivedAtPortalId: partnerPortalId,
    };
  }

  /**
   * Destrava o personagem (`🆘 Destravar Personagem`), retornando-o ao Ponto de Spawn (`spawnX, spawnY`) do mapa atual.
   */
  public async unstuckCharacter(userAccountId: number, characterId: number) {
    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char || char.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido.');
    }

    const mapId = char.currentMapId ?? 1;
    const map = await this.prisma.gameMap.findUnique({ where: { id: mapId } });
    const spawnX = map ? map.spawnX : 500;
    const spawnY = map ? map.spawnY : 500;

    this.lastSyncTimes.delete(characterId);
    await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: {
        currentMapId: map ? map.id : 1,
        posX: spawnX,
        posY: spawnY,
      },
    });

    return {
      currentMapId: map ? map.id : 1,
      posX: spawnX,
      posY: spawnY,
    };
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
    if (userRole !== 'ADMIN' && userRole !== 'GM') {
      throw new Error('Apenas contas GM ou ADMIN podem utilizar o Teleporte GM.');
    }

    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char || char.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido.');
    }

    const targetMap = await this.prisma.gameMap.findUnique({
      where: { id: Number(dto.targetMapId) },
    });
    if (!targetMap) {
      throw new Error('Mapa de destino não encontrado.');
    }

    const posX = dto.targetX !== undefined ? Number(dto.targetX) : targetMap.spawnX;
    const posY = dto.targetY !== undefined ? Number(dto.targetY) : targetMap.spawnY;

    this.lastSyncTimes.delete(characterId);
    await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: {
        currentMapId: targetMap.id,
        posX,
        posY,
      },
    });

    return {
      currentMapId: targetMap.id,
      posX,
      posY,
    };
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

    if (char.userAccountId !== userAccountId && !['ADMIN', 'GM'].includes(role)) {
      throw new Error('Não autorizado a alterar este personagem.');
    }

    const nextReborn = !char.isReborn;
    const updated = await this.prisma.playerCharacter.update({
      where: { id: characterId },
      data: { isReborn: nextReborn },
      include: { classTemplate: true },
    });

    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');
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

    if (!['ADMIN', 'GM'].includes(role)) {
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

    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');
    return this.serializeCharacter(updatedChar, i18nMap);
  }

  /**
   * Retorna a Carteira de Ouro e a Mochila Básica do Personagem (Base Inicial Incompleta).
   */
  public async getCharacterInventory(characterId: number) {
    return CharacterInventoryService.getWalletAndBag(this.prisma, characterId);
  }
}
