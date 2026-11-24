/**
 * @file apps/server/src/controllers/MapRuntimeCacheService.ts
 * @module @etheria/server
 * @description Serviço de cache em memória para física de mapas (`MapPolygonMesh` e dimensões),
 *   validação autoritária de velocidade/voo e buffer de posição de jogadores com flush periódico em PostgreSQL.
 * @rules
 *   1. Evita re-alocar `MapPolygonMesh` e consultar imagem do mapa no disco a cada tick de `/play/position`.
 *   2. Mantém TTL de 5 minutos para cache de mapas, invalidado imediatamente por `AdminMapsController.saveMap/deleteMap`.
 *   3. Valida permissão autoritária de montaria voadora e velocidade sem bloquear o servidor em I/O a cada passo,
 *      revalidando em banco a cada 15s ou mediante invalidação em equipar/desequipar.
 *   4. Agrega gravações de posição no PostgreSQL a cada 3s (ou imediatamente quando o estado `isFlying` alterna),
 *      garantindo flush seguro em `traversePortal`, `unstuckCharacter`, `gmTeleport`, `respawnCharacter` e shutdown.
 * @dependencies @etheria/database, @etheria/shared, ./AssetMirrorService.js, ./CharacterEquipmentService.js
 */

import { PrismaClient } from '@etheria/database';
import { MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { AssetMirrorService } from './AssetMirrorService.js';
import { CharacterEquipmentService } from './CharacterEquipmentService.js';

export interface SyncPositionInputDto {
  mapId: number;
  posX: number;
  posY: number;
  noClip?: boolean;
  isFlying?: boolean;
}

export interface CachedMapPhysics {
  id: number;
  spawnX: number;
  spawnY: number;
  dims: { width: number; height: number } | null;
  collisionMesh: MapPolygonMesh;
  cachedAt: number;
}

export interface CachedCharacterRuntimeState {
  characterId: number;
  userAccountId: number;
  currentMapId: number;
  posX: number;
  posY: number;
  isFlying: boolean;
  hasMount: boolean;
  mountSpeedMultiplier: number;
  flightCheckedAt: number;
  lastSyncAt: number;
  lastDbFlushAt: number;
  lastAccessAt: number;
  dirty: boolean;
  flushingPromise: Promise<void> | null;
}

export class MapRuntimeCacheService {
  public static readonly MAP_PHYSICS_TTL_MS = 5 * 60 * 1000;
  public static readonly FLIGHT_PERM_TTL_MS = 15 * 1000;
  public static readonly POSITION_FLUSH_MS = 3000;
  private static readonly BACKGROUND_SWEEP_MS = 5000;
  private static readonly MAX_MAP_ENTRIES = 250;
  private static readonly MAX_CHAR_ENTRIES = 2000;

  private static readonly mapCache = new Map<number, CachedMapPhysics>();
  private static readonly charCache = new Map<number, CachedCharacterRuntimeState>();
  private static flushTimer: ReturnType<typeof setInterval> | null = null;
  private static activePrisma: PrismaClient | null = null;

  /**
   * Invalida imediatamente a física em cache de um mapa (chamado após editar ou excluir mapa no `/admin`).
   */
  public static invalidateMap(mapId: number): void {
    const id = Number(mapId);
    if (Number.isInteger(id) && id > 0) {
      this.mapCache.delete(id);
    }
  }

  /**
   * Invalida o estado em cache de um personagem (ex.: após equipar/desequipar ou excluir).
   */
  public static invalidateCharacter(characterId: number): void {
    const id = Number(characterId);
    if (Number.isInteger(id) && id > 0) {
      this.charCache.delete(id);
    }
  }

  /**
   * Limpa todos os caches e para o timer em memória (uso exclusivo em testes automatizados).
   */
  public static resetForTests(): void {
    this.mapCache.clear();
    this.charCache.clear();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.activePrisma = null;
  }

  /**
   * Garante timer de varredura periódica (`unref()`) para gravar posições dirty no banco mesmo quando o jogador para.
   */
  private static ensureFlushTimer(prisma: PrismaClient): void {
    this.activePrisma = prisma;
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (this.activePrisma) {
        void this.flushDirtyCharacters(this.activePrisma, false);
      }
    }, this.BACKGROUND_SWEEP_MS);
    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  /**
   * Carrega ou retorna do cache (TTL 5 min) a malha de colisão e dimensões de imagem de um mapa.
   */
  public static async getMapPhysics(
    prisma: PrismaClient,
    assetMirrorService: AssetMirrorService,
    mapId: number
  ): Promise<CachedMapPhysics | null> {
    const id = Number(mapId);
    if (!Number.isInteger(id) || id <= 0) return null;

    const now = Date.now();
    const cached = this.mapCache.get(id);
    if (cached && now - cached.cachedAt < this.MAP_PHYSICS_TTL_MS) {
      return cached;
    }

    const map = await prisma.gameMap.findUnique({
      where: { id },
      select: {
        id: true,
        spawnX: true,
        spawnY: true,
        mcreworkMapImage: true,
        collisionMeshJson: true,
      },
    });
    if (!map) {
      this.mapCache.delete(id);
      return null;
    }

    const asset = await assetMirrorService.getOrFetchAsset(map.mcreworkMapImage);
    const dims = asset ? AssetMirrorService.getImageDimensions(asset.buffer) : null;
    const collisionPolys = Array.isArray(map.collisionMeshJson)
      ? (map.collisionMeshJson as unknown as MapPolygon[])
      : [];

    const entry: CachedMapPhysics = {
      id: map.id,
      spawnX: map.spawnX,
      spawnY: map.spawnY,
      dims,
      collisionMesh: new MapPolygonMesh(collisionPolys),
      cachedAt: now,
    };

    if (this.mapCache.size >= this.MAX_MAP_ENTRIES) {
      const oldestKey = this.mapCache.keys().next().value;
      if (oldestKey !== undefined) this.mapCache.delete(oldestKey);
    }
    this.mapCache.set(id, entry);
    return entry;
  }

  /**
   * Carrega e atualiza a permissão autoritária de montaria voadora de um personagem em cache.
   */
  private static async resolveCachedFlightCapability(
    prisma: PrismaClient,
    state: CachedCharacterRuntimeState,
    wantsToFly: boolean,
    now: number
  ): Promise<{ isFlyingAllowed: boolean; speedMultiplier: number }> {
    const shouldRefresh = state.flightCheckedAt === 0 || now - state.flightCheckedAt >= this.FLIGHT_PERM_TTL_MS;
    if (shouldRefresh) {
      const pc = await prisma.playerCharacter.findUnique({
        where: { id: state.characterId },
        select: { id: true, equippedItemsJson: true },
      });
      if (pc) {
        const perm = await CharacterEquipmentService.resolveAuthoritativeFlightPermission(prisma, pc, true);
        state.hasMount = perm.isFlyingAllowed;
        state.mountSpeedMultiplier = perm.isFlyingAllowed ? perm.speedMultiplier : 1;
      } else {
        state.hasMount = false;
        state.mountSpeedMultiplier = 1;
      }
      state.flightCheckedAt = now;
    }

    const isFlyingAllowed = Boolean(wantsToFly) && state.hasMount;
    return {
      isFlyingAllowed,
      speedMultiplier: isFlyingAllowed ? state.mountSpeedMultiplier : 1,
    };
  }

  /**
   * Executa validação autoritária de posição, velocidade e colisão usando cache em RAM
   * e reduz escritas em banco agrupando updates em janela de `POSITION_FLUSH_MS` (3s).
   */
  public static async validateAndBufferPosition(
    prisma: PrismaClient,
    assetMirrorService: AssetMirrorService,
    userAccountId: number,
    userRole: string,
    characterId: number,
    dto: SyncPositionInputDto,
    authoritativeBaseMoveSpeed: number
  ) {
    this.ensureFlushTimer(prisma);
    const charId = Number(characterId);
    const now = Date.now();

    let cached = this.charCache.get(charId);
    if (!cached) {
      const char = await prisma.playerCharacter.findUnique({
        where: { id: charId },
        select: {
          id: true,
          userAccountId: true,
          currentMapId: true,
          posX: true,
          posY: true,
          isFlying: true,
          equippedItemsJson: true,
        },
      });
      if (!char || char.userAccountId !== userAccountId) {
        throw new Error('Personagem inválido.');
      }
      const perm = await CharacterEquipmentService.resolveAuthoritativeFlightPermission(prisma, char, true);
      cached = {
        characterId: char.id,
        userAccountId: char.userAccountId,
        currentMapId: char.currentMapId ?? 1,
        posX: char.posX,
        posY: char.posY,
        isFlying: Boolean((char as any).isFlying),
        hasMount: perm.isFlyingAllowed,
        mountSpeedMultiplier: perm.isFlyingAllowed ? perm.speedMultiplier : 1,
        flightCheckedAt: now,
        lastSyncAt: 0,
        lastDbFlushAt: now,
        lastAccessAt: now,
        dirty: false,
        flushingPromise: null,
      };
      if (this.charCache.size >= this.MAX_CHAR_ENTRIES) {
        this.evictStaleCharEntries(now);
      }
      this.charCache.set(charId, cached);
    } else if (cached.userAccountId !== userAccountId) {
      throw new Error('Personagem inválido.');
    }

    const mapId = Number(dto.mapId) || cached.currentMapId || 1;
    const mapPhysics = await this.getMapPhysics(prisma, assetMirrorService, mapId);
    if (!mapPhysics) {
      throw new Error('Mapa não encontrado.');
    }

    if (cached.currentMapId && cached.currentMapId !== mapPhysics.id) {
      return {
        ok: false,
        staleMapIgnored: true,
        blocked: false,
        speedClamped: false,
        currentMapId: cached.currentMapId,
        posX: cached.posX,
        posY: cached.posY,
      };
    }

    const clampBoundX = (val: number) =>
      mapPhysics.dims ? Math.max(16, Math.min(mapPhysics.dims.width - 16, val)) : Math.max(16, val);
    const clampBoundY = (val: number) =>
      mapPhysics.dims ? Math.max(20, Math.min(mapPhysics.dims.height - 16, val)) : Math.max(20, val);

    const posX = clampBoundX(Math.round(Number(dto.posX) || mapPhysics.spawnX));
    const posY = clampBoundY(Math.round(Number(dto.posY) || mapPhysics.spawnY));
    const isGmNoClip = Boolean(dto.noClip) && ['ADMIN', 'GM', 'DEV'].includes(userRole);
    const flightPerm = await this.resolveCachedFlightCapability(prisma, cached, Boolean(dto.isFlying), now);
    const ignoreCollision = isGmNoClip || flightPerm.isFlyingAllowed;

    let finalPosX = posX;
    let finalPosY = posY;
    let speedClamped = false;
    const lastSync = cached.lastSyncAt;
    cached.lastSyncAt = now;
    cached.lastAccessAt = now;

    if (!isGmNoClip && cached.currentMapId === mapPhysics.id && lastSync > 0) {
      const elapsedSec = Math.max(0.1, (now - lastSync) / 1000);
      const dist = Math.hypot(posX - cached.posX, posY - cached.posY);
      const maxAllowedDist = authoritativeBaseMoveSpeed * flightPerm.speedMultiplier * elapsedSec * 1.5 + 40;
      if (dist > maxAllowedDist) {
        const ratio = maxAllowedDist / dist;
        finalPosX = clampBoundX(Math.round(cached.posX + (posX - cached.posX) * ratio));
        finalPosY = clampBoundY(Math.round(cached.posY + (posY - cached.posY) * ratio));
        speedClamped = true;
      }
    }

    if (!ignoreCollision && mapPhysics.collisionMesh.containsPoint(finalPosX, finalPosY)) {
      return {
        ok: false,
        blocked: true,
        speedClamped,
        currentMapId: cached.currentMapId ?? mapPhysics.id,
        posX: cached.posX,
        posY: cached.posY,
      };
    }

    const flightChanged = cached.isFlying !== flightPerm.isFlyingAllowed;
    cached.currentMapId = mapPhysics.id;
    cached.posX = finalPosX;
    cached.posY = finalPosY;
    cached.isFlying = flightPerm.isFlyingAllowed;
    cached.dirty = true;

    if (flightChanged || now - cached.lastDbFlushAt >= this.POSITION_FLUSH_MS) {
      await this.flushCharacterEntry(prisma, charId, cached);
    }

    return {
      ok: true,
      blocked: false,
      speedClamped,
      isFlying: flightPerm.isFlyingAllowed,
      currentMapId: mapPhysics.id,
      posX: finalPosX,
      posY: finalPosY,
    };
  }

  private static evictStaleCharEntries(now: number): void {
    const idleCutoff = now - 60_000;
    for (const [id, entry] of this.charCache.entries()) {
      if (!entry.dirty && entry.lastAccessAt < idleCutoff) {
        this.charCache.delete(id);
      }
    }
    if (this.charCache.size >= this.MAX_CHAR_ENTRIES) {
      const oldestKey = this.charCache.keys().next().value;
      if (oldestKey !== undefined) this.charCache.delete(oldestKey);
    }
  }

  private static async flushCharacterEntry(
    prisma: PrismaClient,
    characterId: number,
    entry: CachedCharacterRuntimeState
  ): Promise<void> {
    if (!entry.dirty) return;
    if (entry.flushingPromise) {
      await entry.flushingPromise;
      return;
    }

    const snapMapId = entry.currentMapId;
    const snapX = entry.posX;
    const snapY = entry.posY;
    const snapFlying = entry.isFlying;
    entry.dirty = false;

    const promise = (async () => {
      try {
        await prisma.playerCharacter.update({
          where: { id: characterId },
          data: {
            currentMapId: snapMapId,
            posX: snapX,
            posY: snapY,
            isFlying: snapFlying,
          } as any,
        });
        entry.lastDbFlushAt = Date.now();
      } catch (err: any) {
        // Caso o personagem tenha sido deletado enquanto estava em cache, descarta do buffer com segurança.
        if (err?.code === 'P2025') {
          this.charCache.delete(characterId);
          return;
        }
        entry.dirty = true;
      } finally {
        entry.flushingPromise = null;
      }
    })();

    entry.flushingPromise = promise;
    await promise;
  }

  /**
   * Descarrega o buffer de um personagem no banco (se houver alteração pendente) e remove-o do cache.
   */
  public static async flushAndInvalidateCharacter(prisma: PrismaClient, characterId: number): Promise<void> {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return;
    const entry = this.charCache.get(id);
    if (entry) {
      if (entry.flushingPromise) {
        await entry.flushingPromise;
      }
      if (entry.dirty) {
        await this.flushCharacterEntry(prisma, id, entry);
      }
      this.charCache.delete(id);
    }
  }

  private static async flushDirtyCharacters(prisma: PrismaClient, forceAll: boolean): Promise<void> {
    const now = Date.now();
    const tasks: Promise<void>[] = [];
    for (const [id, entry] of this.charCache.entries()) {
      if (entry.dirty && (forceAll || now - entry.lastDbFlushAt >= this.POSITION_FLUSH_MS)) {
        tasks.push(this.flushCharacterEntry(prisma, id, entry));
      } else if (!entry.dirty && now - entry.lastAccessAt > 5 * 60_000) {
        this.charCache.delete(id);
      }
    }
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  /**
   * Grava todas as posições pendentes em cache no PostgreSQL e encerra o timer periódico (graceful shutdown).
   */
  public static async flushAll(prisma: PrismaClient): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushDirtyCharacters(prisma, true);
  }
}
