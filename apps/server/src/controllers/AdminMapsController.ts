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

import { PrismaClient, SnapshotManager } from '@etheria/database';
import type { MapPolygon } from '@etheria/shared';

export interface SaveMapDto {
  code: string;
  namePtBr: string;
  mcreworkMapImage: string;
  requiredLevel: number;
  levelVarianceMin?: number;
  levelVarianceMax?: number;
  mapTypeId: number;
  primaryBiomeId: number;
  secondaryBiomeId: number;
  dominatedById?: string | null;
  overlapOpacity?: number;
  isActive?: boolean;
  collisionMeshJson: MapPolygon[];
  overlapMeshJson: MapPolygon[];
  portals: Array<{
    sourceX: number;
    sourceY: number;
    triggerRadius?: number;
    targetMapId: number;
    targetX: number;
    targetY: number;
    portalVfxKey?: string | null;
  }>;
  npcs: Array<{
    npcTemplateId: number;
    posX: number;
    posY: number;
    direction?: number;
  }>;
}

export interface SaveNpcTemplateDto {
  code: string;
  namePtBr: string;
  mcreworkNpcKey: string;
  isDecorationOnly: boolean;
  triggersJson: Array<{
    type: 'QUEST' | 'SHOP' | 'BATTLE' | 'EVENT' | 'DIALOGUE';
    label?: string;
    config?: Record<string, unknown>;
  }>;
}

export class AdminMapsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';

  private cachedMcreworkMaps: any[] | null = null;
  private cachedMcreworkNpcs: any[] | null = null;

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
   * Carrega todos os dados necessários para o Editor de Mapas na Rota `/admin`:
   * - Os 40 Biomas (com nome e descrição traduzidos)
   * - Os 5 Tipos de Mapa (com dominação, spawn e regra de PvP fixos)
   * - Os Templates de NPCs cadastrados no nosso banco
   * - Os Mapas cadastrados no nosso banco (com seus polígonos de colisão/sobreposição, portais e NPCs)
   */
  public async getEditorBootstrap() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const biomes = (await this.prisma.biome.findMany({ orderBy: { id: 'asc' } })).map((b) => ({
      ...b,
      namePtBr: i18nMap.get(b.nameI18nKey) ?? b.code,
      descriptionPtBr: i18nMap.get(b.descriptionI18nKey) ?? '',
    }));

    const mapTypes = (await this.prisma.mapType.findMany({ orderBy: { id: 'asc' } })).map((mt) => ({
      ...mt,
      namePtBr: i18nMap.get(mt.nameI18nKey) ?? mt.code,
    }));

    const npcTemplates = (await this.prisma.npcTemplate.findMany({ orderBy: { id: 'asc' } })).map((nt) => ({
      ...nt,
      namePtBr: i18nMap.get(nt.nameI18nKey) ?? nt.code,
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

    return {
      biomes,
      mapTypes,
      npcTemplates,
      maps,
    };
  }

  /**
   * Cria um novo Template de NPC no banco para ser posicionado nos mapas.
   */
  public async saveNpcTemplate(dto: SaveNpcTemplateDto) {
    const code = dto.code.trim();
    const nameKey = `npc.${code.toLowerCase()}.name`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      update: { text: dto.namePtBr.trim() },
      create: { key: nameKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
    });

    const saved = await this.prisma.npcTemplate.upsert({
      where: { code },
      update: {
        mcreworkNpcKey: dto.mcreworkNpcKey,
        nameI18nKey: nameKey,
        isDecorationOnly: Boolean(dto.isDecorationOnly),
        triggersJson: (dto.triggersJson ?? []) as any,
      },
      create: {
        code,
        mcreworkNpcKey: dto.mcreworkNpcKey,
        nameI18nKey: nameKey,
        isDecorationOnly: Boolean(dto.isDecorationOnly),
        triggersJson: (dto.triggersJson ?? []) as any,
      },
    });

    await this.snapshotManager.exportToDisk();
    return {
      ...saved,
      namePtBr: dto.namePtBr.trim(),
    };
  }

  /**
   * Cria ou atualiza um Mapa completo no PostgreSQL (incluindo Polígonos de Colisão,
   * Polígonos de Sobreposição/Opacidade, Pontos de Teleporte e Posições de NPCs) e exporta o Snapshot JSON.
   */
  public async saveMap(id: number | null, dto: SaveMapDto) {
    const code = dto.code.trim();
    if (!code || !dto.mcreworkMapImage || !dto.namePtBr) {
      throw new Error('Código, Nome do Mapa e Imagem Base do mcrework são obrigatórios.');
    }

    const nameKey = `map.${code.toLowerCase()}.name`;
    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      update: { text: dto.namePtBr.trim() },
      create: { key: nameKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
    });

    const mapData = {
      code,
      mcreworkMapImage: dto.mcreworkMapImage,
      nameI18nKey: nameKey,
      requiredLevel: Number(dto.requiredLevel) || 1,
      levelVarianceMin: Number(dto.levelVarianceMin ?? -2),
      levelVarianceMax: Number(dto.levelVarianceMax ?? 5),
      mapTypeId: Number(dto.mapTypeId),
      primaryBiomeId: Number(dto.primaryBiomeId),
      secondaryBiomeId: Number(dto.secondaryBiomeId),
      dominatedById: dto.dominatedById || null,
      overlapOpacity: Number(dto.overlapOpacity ?? 0.45),
      isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      collisionMeshJson: Array.isArray(dto.collisionMeshJson) ? (dto.collisionMeshJson as any) : [],
      overlapMeshJson: Array.isArray(dto.overlapMeshJson) ? (dto.overlapMeshJson as any) : [],
    };

    let savedMapId = id;

    await this.prisma.$transaction(async (tx) => {
      if (savedMapId) {
        await tx.gameMap.update({
          where: { id: savedMapId },
          data: mapData,
        });
      } else {
        const created = await tx.gameMap.create({
          data: mapData,
        });
        savedMapId = created.id;
      }

      // Atualiza Teleportes (Portais de Saída deste Mapa)
      await tx.mapPortal.deleteMany({ where: { sourceMapId: savedMapId } });
      if (Array.isArray(dto.portals) && dto.portals.length > 0) {
        for (const p of dto.portals) {
          if (!p.targetMapId) continue;
          await tx.mapPortal.create({
            data: {
              sourceMapId: savedMapId!,
              sourceX: Number(p.sourceX) || 0,
              sourceY: Number(p.sourceY) || 0,
              triggerRadius: Number(p.triggerRadius) || 48,
              targetMapId: Number(p.targetMapId),
              targetX: Number(p.targetX) || 0,
              targetY: Number(p.targetY) || 0,
              portalVfxKey: p.portalVfxKey || null,
            },
          });
        }
      }

      // Atualiza NPCs posicionados neste Mapa
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
            },
          });
        }
      }
    });

    await this.snapshotManager.exportToDisk();
    return { id: savedMapId };
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
