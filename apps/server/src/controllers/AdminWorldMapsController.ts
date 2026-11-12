/**
 * @file apps/server/src/controllers/AdminWorldMapsController.ts
 * @module @etheria/server
 * @description Controlador da Tabela de Mapas Gerais (Continentes / Mundo) da Rota `/admin`.
 *   - Garante a existência dos 2 mapas gerais com base limpa e logotipo transparente Etheria Campus.
 *   - Fornece bootstrap com lista de `GameMap` cadastrados no banco para vínculo nos pontos.
 *   - Persiste alterações de posição/tamanho do logo, visibilidade de camadas, vínculos de mapas
 *     e ajustes nos pontos/rotas, atualizando o PostgreSQL e o snapshot JSON em disco.
 */

import { PrismaClient, SnapshotManager, I18nCache } from '@etheria/database';
import {
  INITIAL_WORLD_MAP_SEEDS,
  type WorldMapPointSeed,
  type WorldMapRouteSeed,
} from './AdminWorldMapsSeeds.js';

export interface SaveWorldMapDto {
  id?: number;
  code: string;
  namePtBr?: string;
  logoImageUrl?: string | null;
  logoX?: number;
  logoY?: number;
  logoWidth?: number;
  logoHeight?: number;
  logoVisible?: boolean;
  showRoutesLayer?: boolean;
  showPointsLayer?: boolean;
  pointsJson?: WorldMapPointSeed[];
  routesJson?: WorldMapRouteSeed[];
}

export class AdminWorldMapsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient, snapshotManager?: SnapshotManager) {
    this.prisma = prisma;
    this.snapshotManager = snapshotManager ?? new SnapshotManager(prisma);
  }

  /**
   * Garante no boot que os 2 Continentes iniciais existam na tabela `world_map_templates`.
   */
  public async seedInitialWorldMapsIfEmpty(): Promise<void> {
    try {
      for (const seed of INITIAL_WORLD_MAP_SEEDS) {
        await this.prisma.worldMapTemplate.upsert({
          where: { code: seed.code },
          create: {
            code: seed.code,
            namePtBr: seed.namePtBr,
            baseImageUrl: seed.baseImageUrl,
            canvasWidth: seed.canvasWidth,
            canvasHeight: seed.canvasHeight,
            logoImageUrl: seed.logoImageUrl,
            logoX: seed.logoX,
            logoY: seed.logoY,
            logoWidth: seed.logoWidth,
            logoHeight: seed.logoHeight,
            logoVisible: seed.logoVisible,
            showRoutesLayer: seed.showRoutesLayer,
            showPointsLayer: seed.showPointsLayer,
            pointsJson: seed.pointsJson as any,
            routesJson: seed.routesJson as any,
            isActive: true,
          },
          update: {},
        });
      }
    } catch (err: any) {
      console.warn('[AdminWorldMapsController] Aviso ao inicializar world_map_templates:', err?.message || err);
    }
  }

  /**
   * Retorna os mapas gerais salvos e a lista atualizada de `GameMap` disponíveis para vínculo.
   */
  public async getWorldMapsBootstrap() {
    await this.seedInitialWorldMapsIfEmpty();
    const i18nMap = await I18nCache.getTranslations(this.prisma, 'pt-BR');

    const [worldMaps, maps, mapTypes] = await Promise.all([
      this.prisma.worldMapTemplate.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.gameMap.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.mapType.findMany({ orderBy: { id: 'asc' } }),
    ]);

    const mapTypeById = new Map(mapTypes.map((mt) => [mt.id, i18nMap.get(mt.nameI18nKey) ?? mt.code]));

    const availableMaps = maps.map((m) => ({
      id: m.id,
      code: m.code,
      namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
      requiredLevel: m.requiredLevel,
      mapTypeName: mapTypeById.get(m.mapTypeId) ?? 'Mapa',
      isActive: m.isActive,
      mcreworkMapImage: m.mcreworkMapImage,
    }));

    return {
      worldMaps,
      availableMaps,
    };
  }

  /**
   * Salva alterações do Mapa Geral (posição/tamanho do logo, camadas e vínculo de pontos -> GameMap).
   */
  public async saveWorldMap(dto: SaveWorldMapDto) {
    if (!dto?.code && !dto?.id) {
      throw new Error('Identificador (id ou code) do Mapa Geral é obrigatório.');
    }

    const existing = dto.id
      ? await this.prisma.worldMapTemplate.findUnique({ where: { id: Number(dto.id) } })
      : await this.prisma.worldMapTemplate.findUnique({ where: { code: String(dto.code) } });

    if (!existing) {
      throw new Error('Mapa Geral não encontrado no banco.');
    }

    // Valida que todos os gameMapId vinculados realmente existem na tabela maps
    const validMapIds = new Set((await this.prisma.gameMap.findMany({ select: { id: true } })).map((m) => m.id));
    const sanitizedPoints = Array.isArray(dto.pointsJson)
      ? dto.pointsJson.map((pt) => {
          const parsedGameMapId =
            pt.gameMapId !== null && pt.gameMapId !== undefined && Number(pt.gameMapId) > 0
              ? Number(pt.gameMapId)
              : null;
          if (parsedGameMapId !== null && !validMapIds.has(parsedGameMapId)) {
            throw new Error(`Mapa #${parsedGameMapId} não encontrado na Tabela de Mapas.`);
          }
          return {
            id: String(pt.id || `pt_${Date.now()}`),
            refId: Number(pt.refId) || 0,
            refLabel: String(pt.refLabel || ''),
            x: Math.max(0, Math.min(existing.canvasWidth, Number(pt.x) || 0)),
            y: Math.max(0, Math.min(existing.canvasHeight, Number(pt.y) || 0)),
            isCity: Boolean(pt.isCity),
            gameMapId: parsedGameMapId,
            customLabel: typeof pt.customLabel === 'string' ? pt.customLabel.trim().slice(0, 60) : '',
          };
        })
      : (existing.pointsJson as any);

    const pointIds = new Set((sanitizedPoints as any[]).map((p) => p.id));
    const sanitizedRoutes = Array.isArray(dto.routesJson)
      ? dto.routesJson
          .filter((r) => r && pointIds.has(String(r.from)) && pointIds.has(String(r.to)) && r.from !== r.to)
          .map((r) => ({ from: String(r.from), to: String(r.to) }))
      : (existing.routesJson as any);

    const clampW = Math.max(40, Math.min(existing.canvasWidth, Number(dto.logoWidth ?? existing.logoWidth)));
    const clampH = Math.max(28, Math.min(existing.canvasHeight, Number(dto.logoHeight ?? existing.logoHeight)));
    const clampX = Math.max(-40, Math.min(existing.canvasWidth - 20, Number(dto.logoX ?? existing.logoX)));
    const clampY = Math.max(-40, Math.min(existing.canvasHeight - 20, Number(dto.logoY ?? existing.logoY)));

    const updated = await this.prisma.worldMapTemplate.update({
      where: { id: existing.id },
      data: {
        namePtBr: dto.namePtBr?.trim() || existing.namePtBr,
        logoImageUrl: dto.logoImageUrl !== undefined ? dto.logoImageUrl : existing.logoImageUrl,
        logoX: clampX,
        logoY: clampY,
        logoWidth: clampW,
        logoHeight: clampH,
        logoVisible: dto.logoVisible !== undefined ? Boolean(dto.logoVisible) : existing.logoVisible,
        showRoutesLayer: dto.showRoutesLayer !== undefined ? Boolean(dto.showRoutesLayer) : existing.showRoutesLayer,
        showPointsLayer: dto.showPointsLayer !== undefined ? Boolean(dto.showPointsLayer) : existing.showPointsLayer,
        pointsJson: sanitizedPoints,
        routesJson: sanitizedRoutes,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }
}
