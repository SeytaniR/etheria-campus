/**
 * @file apps/server/src/controllers/PlayerMapTravelService.ts
 * @module @etheria/server
 * @description Serviço modular autoritário de carregamento de estado de mapa para `/play`,
 *   travessia segura de portais pareados, destravamento (Unstuck) e Teleporte GM.
 * @rules
 *   1. Valida posse de personagem (`userAccountId`) e uso estrito de roles elevadas no `gmTeleport`.
 *   2. Garante aterrissagem segura fora de polígonos de colisão (`MapPolygonMesh`) e loop de portais.
 *   3. Descarrega buffers de posição e voo (`MapRuntimeCacheService.flushAndInvalidateCharacter`) antes de alterar mapa/posição no banco.
 * @dependencies @etheria/database, @etheria/shared, ./MapSpawnResolver.js, ./AssetMirrorService.js, ./DungeonService.js, ./MapRuntimeCacheService.js
 */

import { PrismaClient, I18nCache } from '@etheria/database';
import { GameRulesConstants, MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import { DungeonService } from './DungeonService.js';
import { MapRuntimeCacheService } from './MapRuntimeCacheService.js';

export interface GmTeleportDto {
  targetMapId: number;
  targetX?: number;
  targetY?: number;
}

export class PlayerMapTravelService {
  private readonly prisma: PrismaClient;
  private readonly assetMirrorService: AssetMirrorService;
  private readonly localAssetBaseUrl = '/api/assets/mcrework';

  constructor(prisma: PrismaClient, assetMirrorService: AssetMirrorService) {
    this.prisma = prisma;
    this.assetMirrorService = assetMirrorService;
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
      isDungeon: map.mapType.code === 'DUNGEON',
      dungeonMonsterCount: (map as any).dungeonMonsterCount ?? 10,
      dungeonBossTemplateId: (map as any).dungeonBossTemplateId ?? null,
      encounterRatePct: effectiveEncounterRate,
      canSpawnMonsters: Boolean(
        map.mapType.code !== 'DUNGEON' && map.mapType.allowMonsterSpawn && effectiveEncounterRate > 0 && eligibleMonsters.length > 0,
      ),
      levelVarianceMin: map.levelVarianceMin,
      levelVarianceMax: map.levelVarianceMax,
      spawnX: map.spawnX,
      spawnY: map.spawnY,
      overlapOpacity: map.overlapOpacity,
      collisionMeshJson: (map.collisionMeshJson as unknown as MapPolygon[]) ?? [],
      overlapMeshJson: (map.overlapMeshJson as unknown as MapPolygon[]) ?? [],
      buildingMeshJson: ((map as any).buildingMeshJson as unknown as MapPolygon[]) ?? [],
      plantationMeshJson: ((map as any).plantationMeshJson as unknown as MapPolygon[]) ?? [],
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
          rolesJson: Array.isArray((n.npcTemplate as any).rolesJson) ? ((n.npcTemplate as any).rolesJson as string[]) : [],
          shopTemplateId: n.npcTemplate.shopTemplateId || null,
          triggersJson: n.npcTemplate.triggersJson,
          posX: n.posX,
          posY: n.posY,
          direction: n.direction,
          teleportDestinationsJson: n.teleportDestinationsJson,
          thumbUrl: `${this.localAssetBaseUrl}/assets/npcs/${key}/thumb.png`,
          atlasJsonUrl: `${this.localAssetBaseUrl}/assets/npcs/${key}/atlas.json`,
          atlasWebpUrl: `${this.localAssetBaseUrl}/assets/npcs/${key}/atlas.webp`,
        };
      }),
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

    const destMap = await this.prisma.gameMap.findUnique({
      where: { id: destMapId },
      include: { mapType: true },
    });
    if (!destMap) {
      throw new Error(`Mapa de destino #${destMapId} não encontrado.`);
    }

    if (destMap.mapType?.code === 'DUNGEON') {
      await DungeonService.validateAndEnterDungeonRun(
        this.prisma,
        characterId,
        destMap.id,
        char.currentMapId,
        char.posX,
        char.posY
      );
    }

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

    await MapRuntimeCacheService.flushAndInvalidateCharacter(this.prisma, characterId);
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

    await MapRuntimeCacheService.flushAndInvalidateCharacter(this.prisma, characterId);
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
    if (!GameRulesConstants.isElevatedRole(userRole)) {
      throw new Error('Apenas contas GM, ADMIN ou DEV podem utilizar o Teleporte GM.');
    }

    const char = await this.prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char) {
      throw new Error('Personagem inválido.');
    }

    const targetMap = await this.prisma.gameMap.findUnique({
      where: { id: Number(dto.targetMapId) },
      include: { mapType: true },
    });
    if (!targetMap) {
      throw new Error('Mapa de destino não encontrado.');
    }
    if (targetMap.mapType?.code === 'DUNGEON') {
      await DungeonService.validateAndEnterDungeonRun(this.prisma, characterId, targetMap.id, char.currentMapId, char.posX, char.posY);
    }

    const posX = dto.targetX !== undefined ? Number(dto.targetX) : targetMap.spawnX;
    const posY = dto.targetY !== undefined ? Number(dto.targetY) : targetMap.spawnY;

    await MapRuntimeCacheService.flushAndInvalidateCharacter(this.prisma, characterId);
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
}
