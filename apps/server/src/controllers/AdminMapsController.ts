/**
 * @file apps/server/src/controllers/AdminMapsController.ts
 * @module @etheria/server
 * @description Controlador Orientado a Objetos para o Editor Visual de Mapas da Rota `/admin`.
 * @rules
 *   1. Importa SOMENTE a imagem limpa do mapa (`bg_image`) do repositório `mcrework`, descartando
 *      completamente malhas antigas (`collision.bin`, `masks`, `portals` originais).
 *   2. Salva no PostgreSQL os polígonos estilo Google Earth de Colisão (`collisionMeshJson`) e de
 *      Sobreposição/Opacidade (`overlapMeshJson`, `overlapOpacity`), além dos Pontos de Teleporte (`map_portals`),
 *      NPCs (`map_npcs`), Nível de Acesso, Tipo de Mapa (que fixa dominação, spawn e PvP) e os 2 Biomas.
 *   3. Dispara `SnapshotManager.exportToDisk()` a cada alteração para manter o backup JSON em sincronia no Git.
 * @dependencies @etheria/database, @etheria/shared
 */

import { PrismaClient, SnapshotManager, I18nCache } from '@etheria/database';
import type { MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';

export interface SaveMapDto {
  code?: string;
  namePtBr: string;
  mcreworkMapImage: string;
  requiredLevel: number;
  levelVarianceMin?: number;
  levelVarianceMax?: number;
  mapTypeId: number;
  primaryBiomeId: number;
  secondaryBiomeId: number;
  allowedMonsterRaces?: string[];
  allowedMonsterTemplateIds?: number[];
  encounterRatePct?: number;
  dominatedById?: string | null;
  spawnX?: number;
  spawnY?: number;
  overlapOpacity?: number;
  isActive?: boolean;
  collisionMeshJson: MapPolygon[];
  overlapMeshJson: MapPolygon[];
  portals: Array<{
    id?: number | null;
    label?: string;
    sourceX: number;
    sourceY: number;
    triggerRadius?: number;
    linkedPortalId?: number | null;
    targetMapId?: number | null;
    targetX?: number;
    targetY?: number;
    portalVfxKey?: string | null;
  }>;
  npcs: Array<{
    id?: number | null;
    npcTemplateId: number;
    posX: number;
    posY: number;
    direction?: number;
    teleportDestinationsJson?: TeleportDestinationDto[] | null;
  }>;
}

export interface TeleportDestinationDto {
  label: string;
  targetMapId: number;
  targetX?: number;
  targetY?: number;
  requiredLevel?: number;
  costGold?: number;
}

export interface SaveNpcTemplateDto {
  id?: number | null;
  code?: string;
  namePtBr: string;
  mcreworkNpcKey: string;
  isDecorationOnly: boolean;
  triggersJson: Array<{ type: 'QUEST' | 'SHOP' | 'BATTLE' | 'EVENT' | 'DIALOGUE'; label?: string; config?: Record<string, unknown> }>;
}

export interface SaveClassTemplateDto {
  id?: number | null;
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkCharKey: string;
  rebornMcreworkCharKey?: string | null;
  groundOffsetY?: number;
  rebornGroundOffsetY?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  rebornShadowOffsetX?: number;
  rebornShadowOffsetY?: number;
  raceCode?: string;
  combatStyle?: string;
  attackRange?: number;
  damageType?: string;
  skillIdsJson?: number[];
  isActive?: boolean;
  baseCombatAttributesJson?: Record<string, number>;
  baseAttributesJson?: Record<string, number>;
  growthPerLevelJson?: Record<string, number>;
}

export class AdminMapsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';

  private cachedMcreworkMaps: any[] | null = null;
  private cachedMcreworkNpcs: any[] | null = null;
  private cachedMcreworkChars: any[] | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Busca a galeria de 76 mapas do `mcrework` retornando EXCLUSIVAMENTE a imagem base limpa e dimensões,
   * ignorando colisões ou pontos antigos conforme regra estrita do projeto.
   */
  public async getMcreworkCleanMapGallery() {
    if (this.cachedMcreworkMaps) return this.cachedMcreworkMaps;

    const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/maps/catalog.json`);
    if (!res.ok) {
      throw new Error(`Falha ao ler catálogo de imagens de mapas do mcrework (${res.status})`);
    }
    const data = (await res.json()) as { maps?: any[] };
    const cleanMaps = (data.maps ?? []).map((m) => ({
      mcreworkId: m.id,
      folderCode: `map_${m.id}`,
      width: m.width ?? 2000,
      height: m.height ?? 1500,
      bgImagePath: m.bg_image,
      bgImageUrl: `${this.mcreworkPagesBaseUrl}/${m.bg_image}`,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/${m.thumb}`,
    }));

    this.cachedMcreworkMaps = cleanMaps;
    return cleanMaps;
  }

  /**
   * Busca a galeria de 365 visuais de NPCs do `mcrework`.
   */
  public async getMcreworkNpcGallery() {
    if (this.cachedMcreworkNpcs) return this.cachedMcreworkNpcs;

    const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/npcs/catalog.json`);
    if (!res.ok) {
      throw new Error(`Falha ao ler catálogo de NPCs do mcrework (${res.status})`);
    }
    const data = (await res.json()) as { npcs?: any[] };
    const cleanNpcs = (data.npcs ?? []).map((n) => ({
      mcreworkNpcKey: n.id,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/${n.thumb}`,
      atlasUrl: `${this.mcreworkPagesBaseUrl}/${n.atlas}`,
      jsonUrl: `${this.mcreworkPagesBaseUrl}/${n.json}`,
    }));

    this.cachedMcreworkNpcs = cleanNpcs;
    return cleanNpcs;
  }

  /**
   * Busca a galeria de 46 visuais de Classes/Personagens jogáveis do `mcrework` (`assets/characters/catalog.json`).
   */
  public async getMcreworkCharacterGallery() {
    if (this.cachedMcreworkChars) return this.cachedMcreworkChars;

    const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/characters/catalog.json`);
    if (!res.ok) {
      throw new Error(`Falha ao ler catálogo de Personagens do mcrework (${res.status})`);
    }
    const data = (await res.json()) as { classes?: any[] };
    const cleanChars = (data.classes ?? []).map((c) => ({
      mcreworkCharKey: c.id,
      suggestedName: c.name ?? c.id,
      gender: c.gender ?? 'MALE',
      tier: c.tier ?? 1,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/${c.thumb}`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/${c.path}`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${c.id}/atlas.webp`,
      anchor: c.anchor ?? [0.5, 0.9],
    }));

    this.cachedMcreworkChars = cleanChars;
    return cleanChars;
  }

  /**
   * Carrega todos os dados necessários para o Editor na Rota `/admin`:
   * - Os 40 Biomas (com nome e descrição traduzidos)
   * - Os 5 Tipos de Mapa (com dominação, spawn e regra de PvP fixos)
   * - As 11 Raças e 5 Elementos
   * - Os Templates de Classes/Personagens (`class_templates`)
   * - Os Templates de NPCs cadastrados no nosso banco
   * - Os Mapas cadastrados no nosso banco (com seus polígonos de colisão/sobreposição, portais e NPCs)
   */
  public async getEditorBootstrap() {
    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

    const biomes = (await this.prisma.biome.findMany({ orderBy: { id: 'asc' } })).map((b) => ({
      ...b,
      namePtBr: i18nMap.get(b.nameI18nKey) ?? b.code,
      descriptionPtBr: i18nMap.get(b.descriptionI18nKey) ?? '',
    }));

    const mapTypes = (await this.prisma.mapType.findMany({ orderBy: { id: 'asc' } })).map((mt) => ({
      ...mt,
      namePtBr: i18nMap.get(mt.nameI18nKey) ?? mt.code,
    }));

    const races = (await this.prisma.race.findMany({ orderBy: { code: 'asc' } })).map((r) => ({
      ...r,
      namePtBr: i18nMap.get(r.nameI18nKey) ?? r.code,
    }));

    const elements = (await this.prisma.element.findMany({ orderBy: { code: 'asc' } })).map((e) => ({
      ...e,
      namePtBr: i18nMap.get(e.nameI18nKey) ?? e.code,
    }));

    const monsterRarities = (await this.prisma.monsterRarity.findMany({ orderBy: { id: 'asc' } })).map((mr) => ({
      ...mr,
      namePtBr: i18nMap.get(mr.nameI18nKey) ?? mr.code,
    }));

    const classTemplates = (
      await this.prisma.classTemplate.findMany({
        orderBy: { id: 'asc' },
        include: {
          race: true,
          _count: {
            select: { characters: true },
          },
        },
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
      characterCount: ct._count?.characters ?? 0,
    }));

    const npcTemplates = (
      await this.prisma.npcTemplate.findMany({
        orderBy: { id: 'asc' },
        include: {
          placements: {
            include: {
              map: true,
            },
          },
        },
      })
    ).map((nt) => ({
      ...nt,
      namePtBr: i18nMap.get(nt.nameI18nKey) ?? nt.code,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${nt.mcreworkNpcKey}/thumb.png`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${nt.mcreworkNpcKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${nt.mcreworkNpcKey}/atlas.webp`,
      placements: (nt.placements ?? []).map((pl) => ({
        ...pl,
        mapNamePtBr: pl.map ? (i18nMap.get(pl.map.nameI18nKey) ?? pl.map.code) : `Mapa #${pl.mapId}`,
      })),
    }));

    const maps = (
      await this.prisma.gameMap.findMany({
        orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
        include: {
          mapType: true,
          primaryBiome: true,
          secondaryBiome: true,
          outgoingPortals: true,
          npcs: {
            include: {
              npcTemplate: true,
            },
          },
        },
      })
    ).map((m) => ({
      ...m,
      namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
    }));

    const monsterTemplates = (
      await this.prisma.monsterTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ rarityTier: 'asc' }, { id: 'asc' }],
      })
    ).map((mt) => ({
      id: mt.id,
      code: mt.code,
      namePtBr: i18nMap.get(mt.nameI18nKey) ?? mt.code,
      raceCode: mt.raceCode,
      rarityTier: mt.rarityTier,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/thumb.webp`,
    }));

    return {
      biomes,
      mapTypes,
      races,
      elements,
      monsterRarities,
      classTemplates,
      npcTemplates,
      monsterTemplates,
      maps,
    };
  }

  /**
   * Cria ou atualiza um Template de Classe/Personagem na tabela `class_templates`
   * com auto-incremento de `id` e chave `class_N` (`class_1`, `class_2`, `class_3`...).
   */
  public async saveClassTemplate(dto: SaveClassTemplateDto, explicitId: number | null = null) {
    if (!dto.mcreworkCharKey) {
      throw new Error('Selecione um visual de Personagem da galeria do mcrework.');
    }

    const targetId = explicitId ?? (dto.id ? Number(dto.id) : null);
    const raceCode = dto.raceCode?.trim() || 'HUMAN';
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;
    const groundOffsetY = Math.round(Number(dto.groundOffsetY) || 0);
    const rebornGroundOffsetY = Math.round(Number(dto.rebornGroundOffsetY) || 0);
    const shadowOffsetX = Math.round(Number(dto.shadowOffsetX) || 0);
    const shadowOffsetY = Math.round(Number(dto.shadowOffsetY) || 0);
    const rebornShadowOffsetX = Math.round(Number(dto.rebornShadowOffsetX) || 0);
    const rebornShadowOffsetY = Math.round(Number(dto.rebornShadowOffsetY) || 0);
    const rebornMcreworkCharKey = dto.rebornMcreworkCharKey ? dto.rebornMcreworkCharKey.trim() : null;
    const combatStyle = dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE';
    const attackRange = Math.max(10, Math.min(1000, Number(dto.attackRange) || (combatStyle === 'RANGED' ? 220 : 60)));
    const damageType = dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';
    const skillIdsJson = Array.isArray(dto.skillIdsJson) ? dto.skillIdsJson.map((n) => Number(n)).filter((n) => n > 0) : undefined;

    const b = dto.baseAttributesJson || {};
    const baseAttrs = { VIT: Number(b.VIT ?? 10), STR: Number(b.STR ?? 10), INT: Number(b.INT ?? 10), WIS: Number(b.WIS ?? 10), AGI: Number(b.AGI ?? 10), DEX: Number(b.DEX ?? 10) };
    const g = dto.growthPerLevelJson || {};
    const growthAttrs = { VIT: Number(g.VIT ?? 2), STR: Number(g.STR ?? 2), INT: Number(g.INT ?? 2), WIS: Number(g.WIS ?? 2), AGI: Number(g.AGI ?? 2), DEX: Number(g.DEX ?? 2) };

    let savedClass: any;
    let finalNamePtBr = (dto.namePtBr ?? '').trim();
    let finalDescPtBr = (dto.descriptionPtBr ?? '').trim();

    await this.prisma.$transaction(async (tx) => {
      if (targetId) {
        const autoCode = `class_${targetId}`;
        const nameKey = `class.${autoCode}.name`;
        const descKey = `class.${autoCode}.description`;
        if (!finalNamePtBr) finalNamePtBr = `Classe #${targetId}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        if (finalDescPtBr) {
          await tx.i18nTranslation.upsert({
            where: { key_locale: { key: descKey, locale: 'pt-BR' } },
            update: { text: finalDescPtBr },
            create: { key: descKey, locale: 'pt-BR', text: finalDescPtBr },
          });
        }

        savedClass = await tx.classTemplate.update({
          where: { id: targetId },
          data: {
            code: autoCode,
            mcreworkCharKey: dto.mcreworkCharKey,
            nameI18nKey: nameKey,
            descriptionI18nKey: descKey,
            rebornMcreworkCharKey,
            groundOffsetY,
            rebornGroundOffsetY,
            shadowOffsetX,
            shadowOffsetY,
            rebornShadowOffsetX,
            rebornShadowOffsetY,
            raceCode,
            combatStyle,
            attackRange,
            damageType,
            baseAttributesJson: baseAttrs as any,
            growthPerLevelJson: growthAttrs as any,
            ...(dto.baseCombatAttributesJson !== undefined ? { baseCombatAttributesJson: dto.baseCombatAttributesJson as any } : {}),
            ...(skillIdsJson !== undefined ? { skillIdsJson: skillIdsJson as any } : {}),
            isActive,
          },
        });
      } else {
        const tempCode = `class_pending_${Date.now()}`;
        const created = await tx.classTemplate.create({
          data: {
            code: tempCode,
            mcreworkCharKey: dto.mcreworkCharKey,
            nameI18nKey: `class.${tempCode}.name`,
            descriptionI18nKey: `class.${tempCode}.description`,
            rebornMcreworkCharKey,
            groundOffsetY,
            rebornGroundOffsetY,
            shadowOffsetX,
            shadowOffsetY,
            rebornShadowOffsetX,
            rebornShadowOffsetY,
            raceCode,
            combatStyle,
            attackRange,
            damageType,
            baseAttributesJson: baseAttrs as any,
            growthPerLevelJson: growthAttrs as any,
            baseCombatAttributesJson: (dto.baseCombatAttributesJson ?? {}) as any,
            skillIdsJson: (skillIdsJson ?? [1, 2, 4]) as any,
            isActive,
          },
        });

        const autoCode = `class_${created.id}`;
        const nameKey = `class.${autoCode}.name`;
        const descKey = `class.${autoCode}.description`;
        if (!finalNamePtBr) finalNamePtBr = `Classe #${created.id}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        if (finalDescPtBr) {
          await tx.i18nTranslation.upsert({
            where: { key_locale: { key: descKey, locale: 'pt-BR' } },
            update: { text: finalDescPtBr },
            create: { key: descKey, locale: 'pt-BR', text: finalDescPtBr },
          });
        }

        savedClass = await tx.classTemplate.update({
          where: { id: created.id },
          data: {
            code: autoCode,
            nameI18nKey: nameKey,
            descriptionI18nKey: descKey,
          },
        });
      }
    });

    await this.snapshotManager.exportToDisk();
    return {
      ...savedClass,
      namePtBr: finalNamePtBr,
      descriptionPtBr: finalDescPtBr,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/thumb.webp`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/atlas.webp`,
      rebornThumbUrl: savedClass.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/thumb.webp`
        : null,
      rebornAtlasJsonUrl: savedClass.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/atlas.json`
        : null,
      rebornAtlasWebpUrl: savedClass.rebornMcreworkCharKey
        ? `${this.mcreworkPagesBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/atlas.webp`
        : null,
    };
  }

  /**
   * Exclui um Template de Classe/Personagem da tabela `class_templates` (se não houver jogadores usando).
   */
  public async deleteClassTemplate(id: number) {
    const count = await this.prisma.playerCharacter.count({
      where: { classTemplateId: id },
    });
    if (count > 0) {
      throw new Error(
        `Não é possível excluir a Classe #${id} pois existem ${count} personagem(ns) de jogador utilizando ela.`
      );
    }
    await this.prisma.classTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }

  /**
   * Cria ou atualiza um Template de NPC na tabela `npc_templates` com auto-incremento de `id` e chave `npc_N`.
   */
  public async saveNpcTemplate(dto: SaveNpcTemplateDto, explicitId: number | null = null) {
    if (!dto.mcreworkNpcKey) {
      throw new Error('Selecione um visual de NPC da galeria do mcrework.');
    }

    const targetId = explicitId ?? (dto.id ? Number(dto.id) : null);
    let savedNpc: any;
    let finalNamePtBr = (dto.namePtBr ?? '').trim();

    await this.prisma.$transaction(async (tx) => {
      if (targetId) {
        const autoCode = `npc_${targetId}`;
        const nameKey = `npc.${autoCode}.name`;
        if (!finalNamePtBr) finalNamePtBr = `NPC #${targetId}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        savedNpc = await tx.npcTemplate.update({
          where: { id: targetId },
          data: {
            code: autoCode,
            mcreworkNpcKey: dto.mcreworkNpcKey,
            nameI18nKey: nameKey,
            isDecorationOnly: Boolean(dto.isDecorationOnly),
            triggersJson: (dto.triggersJson ?? []) as any,
          },
        });
      } else {
        const tempCode = `npc_pending_${Date.now()}`;
        const created = await tx.npcTemplate.create({
          data: {
            code: tempCode,
            mcreworkNpcKey: dto.mcreworkNpcKey,
            nameI18nKey: `npc.${tempCode}.name`,
            isDecorationOnly: Boolean(dto.isDecorationOnly),
            triggersJson: (dto.triggersJson ?? []) as any,
          },
        });

        const autoCode = `npc_${created.id}`;
        const nameKey = `npc.${autoCode}.name`;
        if (!finalNamePtBr) finalNamePtBr = `NPC #${created.id}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        savedNpc = await tx.npcTemplate.update({
          where: { id: created.id },
          data: {
            code: autoCode,
            nameI18nKey: nameKey,
          },
        });
      }
    });

    await this.snapshotManager.exportToDisk();
    return {
      ...savedNpc,
      namePtBr: finalNamePtBr,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/thumb.png`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/atlas.webp`,
    };
  }

  /**
   * Exclui um NPC da tabela `npc_templates` (e automaticamente remove seus posicionamentos em `map_npcs` via Cascade).
   */
  public async deleteNpcTemplate(id: number) {
    await this.prisma.npcTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }

  /**
   * Cria ou atualiza um Mapa completo no PostgreSQL (incluindo Polígonos de Colisão,
   * Polígonos de Sobreposição/Opacidade, Pontos de Teleporte e Posições de NPCs) e exporta o Snapshot JSON.
   * O `id` e a chave `code` (`map_1`, `map_2`, `map_3`...) são auto-incrementados automaticamente.
   */
  public async saveMap(id: number | null, dto: SaveMapDto) {
    if (!dto.mcreworkMapImage || !dto.namePtBr?.trim()) {
      throw new Error('O Nome do Mapa e a Imagem Base do mcrework são obrigatórios.');
    }

    const cleanName = dto.namePtBr.trim();
    const mapType = await this.prisma.mapType.findUnique({
      where: { id: Number(dto.mapTypeId) },
    });
    if (!mapType) {
      throw new Error(`Tipo de mapa inválido (#${dto.mapTypeId}).`);
    }

    const effectiveEncounterRate = MapSpawnResolver.resolveEffectiveEncounterRate(
      mapType.allowMonsterSpawn,
      dto.encounterRatePct !== undefined ? dto.encounterRatePct : 8.0,
    );

    const baseData = {
      mcreworkMapImage: dto.mcreworkMapImage,
      requiredLevel: Number(dto.requiredLevel) || 1,
      levelVarianceMin: Number(dto.levelVarianceMin ?? -2),
      levelVarianceMax: Number(dto.levelVarianceMax ?? 5),
      mapTypeId: Number(dto.mapTypeId),
      primaryBiomeId: Number(dto.primaryBiomeId) || 1,
      secondaryBiomeId: Number(dto.secondaryBiomeId) || 1,
      allowedMonsterRacesJson: MapSpawnResolver.parseAllowedRaces(dto.allowedMonsterRaces),
      allowedMonsterTemplateIdsJson: MapSpawnResolver.parseAllowedMonsterIds(dto.allowedMonsterTemplateIds),
      encounterRatePct: effectiveEncounterRate,
      dominatedById: dto.dominatedById || null,
      spawnX: Number(dto.spawnX ?? 500),
      spawnY: Number(dto.spawnY ?? 500),
      overlapOpacity: Number(dto.overlapOpacity ?? 0.45),
      isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      collisionMeshJson: Array.isArray(dto.collisionMeshJson) ? (dto.collisionMeshJson as any) : [],
      overlapMeshJson: Array.isArray(dto.overlapMeshJson) ? (dto.overlapMeshJson as any) : [],
    };

    let savedMapId = id;

    await this.prisma.$transaction(async (tx) => {
      if (savedMapId) {
        const autoCode = `map_${savedMapId}`;
        const nameKey = `map.${autoCode}.name`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: cleanName },
          create: { key: nameKey, locale: 'pt-BR', text: cleanName },
        });

        await tx.gameMap.update({
          where: { id: savedMapId },
          data: {
            ...baseData,
            code: autoCode,
            nameI18nKey: nameKey,
          },
        });
      } else {
        const tempCode = `map_pending_${Date.now()}`;
        const created = await tx.gameMap.create({
          data: {
            ...baseData,
            code: tempCode,
            nameI18nKey: `map.${tempCode}.name`,
          },
        });
        savedMapId = created.id;

        const autoCode = `map_${savedMapId}`;
        const nameKey = `map.${autoCode}.name`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: cleanName },
          create: { key: nameKey, locale: 'pt-BR', text: cleanName },
        });

        await tx.gameMap.update({
          where: { id: savedMapId },
          data: {
            code: autoCode,
            nameI18nKey: nameKey,
          },
        });
      }

      // 1. Gerencia Portais preservando IDs e sincronizando Duplas de Portais (Entrada <-> Saída)
      const existingPortals = await tx.mapPortal.findMany({
        where: { sourceMapId: savedMapId! },
      });
      const incomingPortals = Array.isArray(dto.portals) ? dto.portals : [];
      const keptPortalIds = new Set<number>(
        incomingPortals.map((p) => Number(p.id)).filter((pid) => Number.isInteger(pid) && pid > 0)
      );

      // Remove portais excluídos pelo usuário e limpa vínculos órfãos em outros mapas
      for (const oldP of existingPortals) {
        if (!keptPortalIds.has(oldP.id)) {
          await tx.mapPortal.updateMany({
            where: { linkedPortalId: oldP.id },
            data: { linkedPortalId: null, targetMapId: null },
          });
          await tx.mapPortal.delete({ where: { id: oldP.id } });
        }
      }

      // Cria ou atualiza os portais deste mapa e sincroniza o Portal Par (bidirecional)
      for (let idx = 0; idx < incomingPortals.length; idx++) {
        const p = incomingPortals[idx];
        const label = (p.label || `Portal #${idx + 1}`).trim();
        const sourceX = Number(p.sourceX) || 0;
        const sourceY = Number(p.sourceY) || 0;
        const triggerRadius = Number(p.triggerRadius) || 48;
        const requestedPartnerId = p.linkedPortalId ? Number(p.linkedPortalId) : null;

        let partnerPortal = null;
        if (requestedPartnerId) {
          partnerPortal = await tx.mapPortal.findUnique({
            where: { id: requestedPartnerId },
          });
        }

        const portalData = {
          label,
          sourceMapId: savedMapId!,
          sourceX,
          sourceY,
          triggerRadius,
          linkedPortalId: partnerPortal ? partnerPortal.id : null,
          targetMapId: partnerPortal ? partnerPortal.sourceMapId : p.targetMapId ? Number(p.targetMapId) : null,
          targetX: partnerPortal ? partnerPortal.sourceX : Number(p.targetX ?? 500),
          targetY: partnerPortal ? partnerPortal.sourceY : Number(p.targetY ?? 500),
          portalVfxKey: p.portalVfxKey || null,
        };

        let savedPortalId: number;
        const existingId = p.id ? Number(p.id) : null;
        if (existingId && keptPortalIds.has(existingId)) {
          const updatedP = await tx.mapPortal.update({
            where: { id: existingId },
            data: portalData,
          });
          savedPortalId = updatedP.id;
        } else {
          const createdP = await tx.mapPortal.create({
            data: portalData,
          });
          savedPortalId = createdP.id;
        }

        // Se está interligado a um Portal Par, sincroniza o outro lado automaticamente (Entrada <-> Saída)!
        if (partnerPortal) {
          // Desvincula qualquer outro portal antigo que apontava para este ou para o parceiro
          await tx.mapPortal.updateMany({
            where: {
              linkedPortalId: { in: [savedPortalId, partnerPortal.id] },
              id: { notIn: [savedPortalId, partnerPortal.id] },
            },
            data: { linkedPortalId: null, targetMapId: null },
          });

          await tx.mapPortal.update({
            where: { id: partnerPortal.id },
            data: {
              linkedPortalId: savedPortalId,
              targetMapId: savedMapId!,
              targetX: sourceX,
              targetY: sourceY,
            },
          });
        } else {
          // Caso tenha sido desvinculado, limpa quem apontava para este portal
          await tx.mapPortal.updateMany({
            where: { linkedPortalId: savedPortalId },
            data: { linkedPortalId: null, targetMapId: null },
          });
        }
      }

      // 2. Atualiza NPCs posicionados neste Mapa
      await tx.mapNpc.deleteMany({ where: { mapId: savedMapId } });
      if (Array.isArray(dto.npcs) && dto.npcs.length > 0) {
        for (const n of dto.npcs) {
          if (!n.npcTemplateId) continue;
          await tx.mapNpc.create({
            data: {
              mapId: savedMapId!,
              npcTemplateId: Number(n.npcTemplateId),
              posX: Number(n.posX) || 0,
              posY: Number(n.posY) || 0,
              direction: Number(n.direction) || 0,
              teleportDestinationsJson: Array.isArray(n.teleportDestinationsJson)
                ? (n.teleportDestinationsJson as any)
                : undefined,
            },
          });
        }
      }
    });

    await this.snapshotManager.exportToDisk();
    return { id: savedMapId };
  }

  /**
   * Adiciona ou atualiza um NPC de Teleporte diretamente em um mapa com seus destinos cadastrados.
   */
  public async saveMapTeleportNpc(
    mapId: number,
    dto: {
      id?: number | null;
      npcTemplateId: number;
      posX: number;
      posY: number;
      direction?: number;
      teleportDestinationsJson: TeleportDestinationDto[];
    }
  ) {
    const existingMap = await this.prisma.gameMap.findUnique({ where: { id: mapId } });
    if (!existingMap) {
      throw new Error(`Mapa #${mapId} não encontrado.`);
    }
    const npcTpl = await this.prisma.npcTemplate.findUnique({ where: { id: Number(dto.npcTemplateId) } });
    if (!npcTpl) {
      throw new Error(`Template de NPC #${dto.npcTemplateId} não encontrado.`);
    }

    const destinations = Array.isArray(dto.teleportDestinationsJson)
      ? dto.teleportDestinationsJson.map((d) => ({
          label: (d.label || '').trim(),
          targetMapId: Number(d.targetMapId),
          targetX: Number(d.targetX ?? 500),
          targetY: Number(d.targetY ?? 500),
          requiredLevel: Number(d.requiredLevel ?? 1),
          costGold: Number(d.costGold ?? 0),
        }))
      : [];

    let savedNpc: any;
    const targetPlacementId = dto.id ? Number(dto.id) : null;
    if (targetPlacementId) {
      savedNpc = await this.prisma.mapNpc.update({
        where: { id: targetPlacementId },
        data: {
          npcTemplateId: Number(dto.npcTemplateId),
          posX: Number(dto.posX) || 0,
          posY: Number(dto.posY) || 0,
          direction: Number(dto.direction) || 0,
          teleportDestinationsJson: destinations as any,
        },
        include: { npcTemplate: true },
      });
    } else {
      savedNpc = await this.prisma.mapNpc.create({
        data: {
          mapId,
          npcTemplateId: Number(dto.npcTemplateId),
          posX: Number(dto.posX) || 0,
          posY: Number(dto.posY) || 0,
          direction: Number(dto.direction) || 0,
          teleportDestinationsJson: destinations as any,
        },
        include: { npcTemplate: true },
      });
    }

    await this.snapshotManager.exportToDisk();
    return savedNpc;
  }

  /**
   * Remove um NPC posicionado de um mapa pelo seu ID de posicionamento (`map_npcs.id`).
   */
  public async deleteMapNpc(placementId: number) {
    const existing = await this.prisma.mapNpc.findUnique({ where: { id: placementId } });
    if (!existing) {
      throw new Error(`Posicionamento de NPC #${placementId} não encontrado.`);
    }
    await this.prisma.mapNpc.delete({ where: { id: placementId } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: placementId };
  }

  /**
   * Gira/espelha diretamente um NPC já posicionado e registrado na tabela `map_npcs`
   * sem precisar excluí-lo ou recriá-lo.
   */
  public async rotateMapNpcPlacement(placementId: number) {
    const existing = await this.prisma.mapNpc.findUnique({ where: { id: placementId } });
    if (!existing) {
      throw new Error(`Posicionamento de NPC #${placementId} não encontrado.`);
    }
    const nextDirection = (Number(existing.direction) || 0) === 0 ? 1 : 0;
    const updated = await this.prisma.mapNpc.update({
      where: { id: placementId },
      data: { direction: nextDirection },
    });
    await this.snapshotManager.exportToDisk();
    return updated;
  }

  /**
   * Exclui um mapa do banco de dados e sincroniza o Snapshot JSON.
   */
  public async deleteMap(id: number) {
    await this.prisma.gameMap.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }
}
