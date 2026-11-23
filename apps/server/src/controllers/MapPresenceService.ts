/**
 * @file apps/server/src/controllers/MapPresenceService.ts
 * @description Serviço autoritário de presença em tempo real e respawn de personagens.
 * 
 * RECURSOS:
 * - Rastreamento otimizado de jogadores online por mapa (em memória, sem overhead de DB).
 * - Notificação de status de combate (avatar parado com espadas se batendo sobre a cabeça).
 * - Respawn inteligente: ao morrer em combate, o personagem é teletransportado para o spawn da Cidade/Vila mais próxima.
 * - Limpeza automática de conexões inativas (heartbeat timeout de 15 segundos).
 */

import type { PrismaClient } from '@prisma/client';
import { PartyService } from './PartyService.js';
import {
  CharacterEquipmentService,
  type EquippedMountVisualDto,
  type EquippedWingsVisualDto,
} from './CharacterEquipmentService.js';

export interface MapPlayerPresence {
  characterId: number;
  name: string;
  level: number;
  classTemplateId: number;
  classCode: string;
  mcreworkCharKey: string;
  atlasJsonUrl?: string;
  atlasWebpUrl?: string;
  thumbUrl?: string;
  groundOffsetY?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  equippedWings?: EquippedWingsVisualDto | null;
  equippedMount?: EquippedMountVisualDto | null;
  elementCode: string;
  posX: number;
  posY: number;
  dir: number;
  isMoving: boolean;
  isInCombat: boolean;
  isFlying?: boolean;
  flightAltitude?: number;
  partyId?: string | null;
  isPartyLeader?: boolean;
  partyLeaderId?: number | null;
  partyMemberIndex?: number;
  lastSeenAt: number;
}

export interface SyncPresenceDto {
  mapId: number;
  posX: number;
  posY: number;
  dir?: number;
  isMoving?: boolean;
  isInCombat?: boolean;
  isFlying?: boolean;
  flightAltitude?: number;
}

export class MapPresenceService {
  /** Relação de jogadores ativos em memória: mapId -> Map<characterId, MapPlayerPresence> */
  private static playersByMap = new Map<number, Map<number, MapPlayerPresence>>();

  /** Cache de metadados visuais de personagens para evitar queries desnecessárias */
  private static metadataCache = new Map<number, Partial<MapPlayerPresence>>();

  /** Timeout de inatividade para remoção automática de jogadores deslogados (15s) */
  private static readonly INACTIVE_TIMEOUT_MS = 15000;

  /**
   * Atualiza a presença do jogador no mapa e retorna a lista de outros jogadores visíveis.
   */
  public static async updatePresence(
    prisma: PrismaClient,
    characterId: number,
    dto: SyncPresenceDto
  ): Promise<MapPlayerPresence[]> {
    const now = Date.now();
    const mapId = Number(dto.mapId) || 1;

    // 1. Obtém metadados visuais do personagem (do cache ou banco)
    let meta = this.metadataCache.get(characterId);
    if (!meta) {
      const pc = await prisma.playerCharacter.findUnique({
        where: { id: characterId },
        include: { classTemplate: true },
      });
      if (pc) {
        const eqMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
          ? (pc.equippedItemsJson as Record<string, number>)
          : {}) as Record<string, number>;
        const visIds = [Number(eqMap.WINGS) || 0, Number(eqMap.FLYING_MOUNT) || 0].filter((id) => id > 0);
        const visItems = visIds.length > 0
          ? await prisma.itemTemplate.findMany({ where: { id: { in: visIds } } })
          : [];
        const visById = new Map<number, any>(visItems.map((it) => [it.id, it]));
        const mountTplId = Number((visById.get(Number(eqMap.FLYING_MOUNT) || 0)?.specialEffectJson as any)?.flyingMountTemplateId) || 0;
        const mountsById = new Map<number, any>();
        if (mountTplId > 0) {
          const mt = await prisma.flyingMountTemplate.findUnique({ where: { id: mountTplId } });
          if (mt) mountsById.set(mt.id, mt);
        }
        const visual = CharacterEquipmentService.resolveVisualAppearance(eqMap, visById, mountsById);

        meta = {
          name: pc.name,
          level: pc.level || 1,
          classTemplateId: pc.classTemplateId,
          classCode: pc.classTemplate?.code || 'WARRIOR',
          mcreworkCharKey: pc.classTemplate?.mcreworkCharKey || '100101',
          atlasJsonUrl: `/api/assets/mcrework/assets/characters/${pc.classTemplate?.mcreworkCharKey || '100101'}/atlas.json`,
          atlasWebpUrl: `/api/assets/mcrework/assets/characters/${pc.classTemplate?.mcreworkCharKey || '100101'}/atlas.webp`,
          thumbUrl: `/api/assets/mcrework/assets/characters/${pc.classTemplate?.mcreworkCharKey || '100101'}/thumb.webp`,
          groundOffsetY: pc.classTemplate?.groundOffsetY || 0,
          equippedWings: visual.equippedWings,
          equippedMount: visual.equippedMount,
          elementCode: pc.elementCode || 'NEUTRAL',
        };
        this.metadataCache.set(characterId, meta);
      }
    }

    // 2. Remove o personagem de mapas anteriores se tiver trocado de mapa
    this.removePlayerFromOtherMaps(characterId, mapId);

    // 3. Atualiza ou insere o registro no mapa atual
    let mapPlayers = this.playersByMap.get(mapId);
    if (!mapPlayers) {
      mapPlayers = new Map<number, MapPlayerPresence>();
      this.playersByMap.set(mapId, mapPlayers);
    }

    const party = PartyService.getPartyByCharacterId(characterId);
    let partyMemberIndex = 0;
    if (party) {
      const mIdx = party.members.findIndex((m) => m.characterId === characterId);
      partyMemberIndex = mIdx >= 0 ? mIdx : 0;
      PartyService.syncMemberVitals(characterId, {
        mapId,
        posX: Number(dto.posX) || 500,
        posY: Number(dto.posY) || 500,
      });
    }

    const presenceData: MapPlayerPresence = {
      characterId,
      name: meta?.name || 'Aventureiro',
      level: meta?.level || 1,
      classTemplateId: meta?.classTemplateId || 1,
      classCode: meta?.classCode || 'WARRIOR',
      mcreworkCharKey: meta?.mcreworkCharKey || '100101',
      atlasJsonUrl: meta?.atlasJsonUrl,
      atlasWebpUrl: meta?.atlasWebpUrl,
      thumbUrl: meta?.thumbUrl,
      groundOffsetY: meta?.groundOffsetY || 0,
      shadowOffsetX: meta?.shadowOffsetX || 0,
      shadowOffsetY: meta?.shadowOffsetY || 0,
      equippedWings: meta?.equippedWings || null,
      equippedMount: meta?.equippedMount || null,
      elementCode: meta?.elementCode || 'NEUTRAL',
      posX: Number(dto.posX) || 500,
      posY: Number(dto.posY) || 500,
      dir: dto.dir !== undefined ? Number(dto.dir) : 0,
      isMoving: Boolean(dto.isMoving),
      isInCombat: Boolean(dto.isInCombat),
      isFlying: Boolean(dto.isFlying && meta?.equippedMount && !dto.isInCombat),
      flightAltitude: Number(dto.flightAltitude) || 0,
      partyId: party?.id ?? null,
      isPartyLeader: party ? party.leaderCharacterId === characterId : false,
      partyLeaderId: party?.leaderCharacterId ?? null,
      partyMemberIndex,
      lastSeenAt: now,
    };

    mapPlayers.set(characterId, presenceData);

    // 4. Executa limpeza de conexões inativas no mapa
    this.pruneInactiveInMap(mapPlayers, now);

    // 5. Retorna todos os outros jogadores presentes neste mapa
    const others: MapPlayerPresence[] = [];
    for (const [id, p] of mapPlayers.entries()) {
      if (id !== characterId) {
        others.push(p);
      }
    }

    return others;
  }

  /**
   * Retorna jogadores no mesmo mapa próximos ao personagem para formação de equipe.
   */
  public static getNearbyPlayers(characterId: number, mapId: number, maxDistance: number = 400): MapPlayerPresence[] {
    const mapPlayers = this.playersByMap.get(mapId);
    if (!mapPlayers) return [];

    const me = mapPlayers.get(characterId);
    const myX = me ? me.posX : 500;
    const myY = me ? me.posY : 500;

    const nearby: MapPlayerPresence[] = [];
    for (const [id, p] of mapPlayers.entries()) {
      if (id === characterId) continue;
      const dist = Math.hypot(p.posX - myX, p.posY - myY);
      if (dist <= maxDistance) {
        nearby.push(p);
      }
    }
    return nearby;
  }

  /**
   * Invalida o cache visual do personagem quando ele equipa/desequipa itens visuais (asas, montaria).
   */
  public static invalidateCharacterCache(characterId: number): void {
    this.metadataCache.delete(Number(characterId));
  }

  /**
   * Atualiza expressamente o status de combate de um jogador.
   */
  public static setCombatStatus(characterId: number, isInCombat: boolean): void {
    for (const mapPlayers of this.playersByMap.values()) {
      const p = mapPlayers.get(characterId);
      if (p) {
        p.isInCombat = isInCombat;
        if (isInCombat) {
          p.isMoving = false;
        }
        break;
      }
    }
  }

  /**
   * Remove o jogador de todos os mapas em memória (desconexão ou teleporte).
   */
  public static removePlayer(characterId: number): void {
    for (const mapPlayers of this.playersByMap.values()) {
      mapPlayers.delete(characterId);
    }
  }

  /**
   * Garante que o jogador não esteja duplicado em outro mapa.
   */
  private static removePlayerFromOtherMaps(characterId: number, currentMapId: number): void {
    for (const [mid, mapPlayers] of this.playersByMap.entries()) {
      if (mid !== currentMapId) {
        mapPlayers.delete(characterId);
      }
    }
  }

  /**
   * Limpa registros de jogadores sem atualização de heartbeat há mais de 15 segundos.
   */
  private static pruneInactiveInMap(mapPlayers: Map<number, MapPlayerPresence>, now: number): void {
    for (const [id, p] of mapPlayers.entries()) {
      if (now - p.lastSeenAt > this.INACTIVE_TIMEOUT_MS) {
        mapPlayers.delete(id);
      }
    }
  }

  /**
   * Teletransporta o personagem após a morte para o Spawn da Cidade ou Vila mais próxima.
   */
  public static async respawnCharacter(
    prisma: PrismaClient,
    userAccountId: number,
    characterId: number
  ): Promise<{ success: boolean; mapId: number; spawnX: number; spawnY: number }> {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: characterId },
    });
    if (!pc || pc.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido para respawn.');
    }

    const currentMapId = pc.currentMapId || 1;
    const currentMap = await prisma.gameMap.findUnique({
      where: { id: currentMapId },
      include: { mapType: true },
    });

    // Se morreu dentro de uma Dungeon, finaliza a entrada diária como DEFEATED (ingresso do dia consumido)
    if (currentMap && currentMap.mapType?.code === 'DUNGEON') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      await (prisma as any).dungeonRun.updateMany({
        where: { characterId: Number(characterId), dungeonMapId: currentMap.id, entryDate: today, status: 'IN_PROGRESS' },
        data: { status: 'DEFEATED', finishedAt: new Date() },
      }).catch(() => {});
    }

    // Se o mapa atual já for zona segura de Cidade ou Vila, respawna no spawn do mapa
    if (currentMap && (currentMap.mapType.code === 'CITY' || currentMap.mapType.code === 'VILLAGE')) {
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: {
          posX: currentMap.spawnX,
          posY: currentMap.spawnY,
        },
      });

      this.setCombatStatus(characterId, false);
      return {
        success: true,
        mapId: currentMap.id,
        spawnX: currentMap.spawnX,
        spawnY: currentMap.spawnY,
      };
    }

    // Caso contrário, busca a Cidade ou Vila segura mais próxima (padrão: Vila Izumo / Mapa 1)
    const safeTownMap = await prisma.gameMap.findFirst({
      where: {
        isActive: true,
        mapType: {
          code: { in: ['CITY', 'VILLAGE'] },
        },
      },
      orderBy: { id: 'asc' },
    });

    const targetMap = safeTownMap || currentMap;
    const targetMapId = targetMap ? targetMap.id : 1;
    const targetSpawnX = targetMap ? targetMap.spawnX : 500;
    const targetSpawnY = targetMap ? targetMap.spawnY : 500;

    await prisma.playerCharacter.update({
      where: { id: characterId },
      data: {
        currentMapId: targetMapId,
        posX: targetSpawnX,
        posY: targetSpawnY,
      },
    });

    this.removePlayer(characterId);
    this.setCombatStatus(characterId, false);

    return {
      success: true,
      mapId: targetMapId,
      spawnX: targetSpawnX,
      spawnY: targetSpawnY,
    };
  }
}
