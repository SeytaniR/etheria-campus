/**
 * @file apps/server/src/controllers/DungeonService.ts
 * @module @etheria/server
 * @description Serviço Autoritário das Dungeons Instanciadas (1x ao dia por personagem):
 *   - Garante MapType DUNGEON (não dominável, dentro do Véu, área de combate livre).
 *   - Controla entrada diária única (`dungeon_runs` por YYYY-MM-DD em America/Sao_Paulo).
 *   - Gera monstros normais (HP x2) + 1 Boss específico (status normais de Boss + HP x3),
 *     ambos com debuff de -30% no dano final aplicado e lógica de aggro curto.
 *   - Gerencia conclusão (vitória total), derrota (morte -> santuário) e fuga (gasta ingresso do dia).
 * @rules Segue estritamente AGENTS.md (Instância diária autoritativa, Regra #7 < 1.000 linhas, Zero Hardcode).
 * @dependencies node:http, @prisma/client, @etheria/database (I18nCache), @etheria/shared (MapPolygonMesh), ./MapSpawnResolver.js, ./MonsterCombatBuilder.js, ./MonsterGlobalConfigService.js, ./AssetMirrorService.js, ./MapPresenceService.js, ./DungeonChestService.js, ./CharacterActivityStateService.js
 */

import type * as http from 'node:http';
import type { PrismaClient, MonsterTemplate } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { MonsterCombatBuilder } from './MonsterCombatBuilder.js';
import { MonsterGlobalConfigService } from './MonsterGlobalConfigService.js';
import type { TemporaryCombatController, CombatUnit } from './TemporaryCombatController.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import { MapPresenceService } from './MapPresenceService.js';
import { DungeonChestService } from './DungeonChestService.js';
import { CharacterActivityStateService } from './CharacterActivityStateService.js';

export class DungeonService {
  private static readonly mcreworkPagesBaseUrl = '/api/assets/mcrework';

  /**
   * Data civil atual no fuso de Brasília (`YYYY-MM-DD`).
   */
  public static getTodayDateStr(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }

  /**
   * Garante a existência do tipo de mapa DUNGEON no PostgreSQL e da tradução i18n correspondente.
   */
  public static async ensureDungeonMapType(prisma: PrismaClient): Promise<void> {
    try {
      const i18nKey = 'map_type.dungeon.name';
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: i18nKey, locale: 'pt-BR' } },
        update: { text: 'Dungeon' },
        create: { key: i18nKey, locale: 'pt-BR', text: 'Dungeon' },
      });

      await prisma.mapType.upsert({
        where: { code: 'DUNGEON' },
        update: {
          nameI18nKey: i18nKey,
          dominationTarget: 'NONE',
          allowMonsterSpawn: true,
          pvpRule: 'DUEL_ONLY',
          forcesCriminalStatus: false,
        },
        create: {
          code: 'DUNGEON',
          nameI18nKey: i18nKey,
          dominationTarget: 'NONE',
          allowMonsterSpawn: true,
          pvpRule: 'DUEL_ONLY',
          forcesCriminalStatus: false,
        },
      });

      const islandKey = 'map_type.personal_island.name';
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: islandKey, locale: 'pt-BR' } },
        update: { text: 'Ilha Pessoal' },
        create: { key: islandKey, locale: 'pt-BR', text: 'Ilha Pessoal' },
      });
      await prisma.mapType.upsert({
        where: { code: 'PERSONAL_ISLAND' },
        update: {
          nameI18nKey: islandKey,
          dominationTarget: 'NONE',
          allowMonsterSpawn: false,
          pvpRule: 'DUEL_ONLY',
          forcesCriminalStatus: false,
        },
        create: {
          code: 'PERSONAL_ISLAND',
          nameI18nKey: islandKey,
          dominationTarget: 'NONE',
          allowMonsterSpawn: false,
          pvpRule: 'DUEL_ONLY',
          forcesCriminalStatus: false,
        },
      });
    } catch (err) {
      console.warn('[DungeonService] Aviso ao sincronizar MapTypes especiais:', err);
    }
  }

  /**
   * Encontra um mapa seguro (Cidade ou Vila) como destino de retorno caso não haja mapa de origem salvo.
   */
  public static async findFallbackSafeTown(prisma: PrismaClient): Promise<{ mapId: number; x: number; y: number }> {
    const safeMap = await prisma.gameMap.findFirst({
      where: {
        isActive: true,
        mapType: { code: { in: ['CITY', 'VILLAGE'] } },
      },
      orderBy: { id: 'asc' },
    });
    if (safeMap) {
      return { mapId: safeMap.id, x: Number(safeMap.spawnX) || 500, y: Number(safeMap.spawnY) || 500 };
    }
    const firstNonDungeon = await prisma.gameMap.findFirst({
      where: { mapType: { code: { not: 'DUNGEON' } } },
      orderBy: { id: 'asc' },
    });
    if (firstNonDungeon) {
      return {
        mapId: firstNonDungeon.id,
        x: Number(firstNonDungeon.spawnX) || 500,
        y: Number(firstNonDungeon.spawnY) || 500,
      };
    }
    return { mapId: 1, x: 500, y: 500 };
  }

  public static async resolveExitDestination(
    prisma: PrismaClient,
    run: any
  ): Promise<{ mapId: number; x: number; y: number }> {
    if (run?.returnMapId) {
      const origin = await prisma.gameMap.findUnique({
        where: { id: Number(run.returnMapId) },
        include: { mapType: true },
      });
      if (origin && origin.mapType?.code !== 'DUNGEON') {
        return {
          mapId: origin.id,
          x: Number(run.returnX ?? origin.spawnX) || 500,
          y: Number(run.returnY ?? origin.spawnY) || 500,
        };
      }
    }
    return this.findFallbackSafeTown(prisma);
  }

  /**
   * Valida e registra (ou retoma) a entrada diária do personagem na Dungeon.
   */
  public static async validateAndEnterDungeonRun(
    prisma: PrismaClient,
    characterId: number,
    dungeonMapId: number,
    returnMapId?: number | null,
    returnX?: number | null,
    returnY?: number | null
  ) {
    const charFlight = await prisma.playerCharacter.findUnique({ where: { id: Number(characterId) }, select: { isFlying: true } });
    if ((charFlight as any)?.isFlying) {
      throw new Error('Você precisa estar no chão para iniciar uma luta na Masmorra! Pouse sua montaria primeiro.');
    }
    if (CharacterActivityStateService.isFishing(Number(characterId))) {
      throw new Error('Pare de pescar antes de entrar em combate na Masmorra.');
    }
    const today = this.getTodayDateStr();
    const existing = await (prisma as any).dungeonRun.findUnique({
      where: {
        characterId_dungeonMapId_entryDate: {
          characterId: Number(characterId),
          dungeonMapId: Number(dungeonMapId),
          entryDate: today,
        },
      },
    });

    if (existing) {
      if (existing.status !== 'IN_PROGRESS') {
        throw new Error(
          '⏳ Você já utilizou sua entrada diária nesta Dungeon hoje! Só é possível entrar 1x por dia.'
        );
      }
      return existing;
    }

    let validReturnMapId = returnMapId ? Number(returnMapId) : null;
    let validReturnX = returnX !== undefined && returnX !== null ? Number(returnX) : null;
    let validReturnY = returnY !== undefined && returnY !== null ? Number(returnY) : null;

    if (validReturnMapId) {
      const originMap = await prisma.gameMap.findUnique({
        where: { id: validReturnMapId },
        include: { mapType: true },
      });
      if (!originMap || originMap.mapType?.code === 'DUNGEON') {
        validReturnMapId = null;
      }
    }

    if (!validReturnMapId) {
      const fallback = await this.findFallbackSafeTown(prisma);
      validReturnMapId = fallback.mapId;
      validReturnX = fallback.x;
      validReturnY = fallback.y;
    }

    return await (prisma as any).dungeonRun.create({
      data: {
        characterId: Number(characterId),
        dungeonMapId: Number(dungeonMapId),
        entryDate: today,
        status: 'IN_PROGRESS',
        returnMapId: validReturnMapId,
        returnX: validReturnX,
        returnY: validReturnY,
      },
    });
  }

  /**
   * Sorteia coordenadas válidas, livres de colisão e 100% alcançáveis por caminhada (BFS) a partir do jogador.
   * O Boss SEMPRE nasce no ponto acessível mais distante do jogador, respeitando malhas de colisão e acesso.
   */
  private static generateDungeonSpawnCoords(
    width: number,
    height: number,
    collisionPolys: MapPolygon[],
    playerX: number,
    playerY: number,
    totalCount: number
  ): { mobPoints: Array<{ x: number; y: number }>; bossPoint: { x: number; y: number } } {
    const mesh = new MapPolygonMesh(collisionPolys);
    const padX = Math.min(72, Math.round(width * 0.05));
    const padY = Math.min(72, Math.round(height * 0.05));
    const cellSize = 32;
    const cols = Math.max(4, Math.floor(width / cellSize));
    const rows = Math.max(4, Math.floor(height / cellSize));
    const m = 16;

    const isWalkable = (x: number, y: number): boolean => {
      if (x < padX || y < padY || x > width - padX || y > height - padY) return false;
      if (mesh.containsPoint(x, y)) return false;
      if (mesh.containsPoint(x + m, y) || mesh.containsPoint(x - m, y) || mesh.containsPoint(x, y + m) || mesh.containsPoint(x, y - m)) {
        return false;
      }
      return true;
    };

    const grid: Uint8Array = new Uint8Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const cy = Math.round(r * cellSize + cellSize * 0.5);
      for (let c = 0; c < cols; c++) {
        const cx = Math.round(c * cellSize + cellSize * 0.5);
        if (isWalkable(cx, cy)) grid[r * cols + c] = 1;
      }
    }

    // Localiza a célula caminhável mais próxima do ponto de entrada do jogador
    let startR = Math.max(0, Math.min(rows - 1, Math.floor(playerY / cellSize)));
    let startC = Math.max(0, Math.min(cols - 1, Math.floor(playerX / cellSize)));
    if (!grid[startR * cols + startC]) {
      let bestD = Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!grid[r * cols + c]) continue;
          const d = Math.hypot((c + 0.5) * cellSize - playerX, (r + 0.5) * cellSize - playerY);
          if (d < bestD) { bestD = d; startR = r; startC = c; }
        }
      }
    }

    // BFS 8-direções a partir do jogador para mapear 100% da área acessível e a distância real de caminhada
    const distArr = new Int32Array(rows * cols).fill(-1);
    const queue = new Int32Array(rows * cols);
    let qHead = 0;
    let qTail = 0;
    const startIdx = startR * cols + startC;
    if (grid[startIdx]) {
      distArr[startIdx] = 0;
      queue[qTail++] = startIdx;
    }
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    const reachable: Array<{ x: number; y: number; bfsDist: number; euclid: number }> = [];
    while (qHead < qTail) {
      const idx = queue[qHead++];
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const d = distArr[idx];
      const cx = Math.round(c * cellSize + cellSize * 0.5);
      const cy = Math.round(r * cellSize + cellSize * 0.5);
      reachable.push({ x: cx, y: cy, bfsDist: d, euclid: Math.hypot(cx - playerX, cy - playerY) });

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        // Impede corte diagonal através de quina bloqueada
        if (dr !== 0 && dc !== 0 && (!grid[r * cols + nc] || !grid[nr * cols + c])) continue;
        const nIdx = nr * cols + nc;
        if (grid[nIdx] && distArr[nIdx] === -1) {
          distArr[nIdx] = d + 1;
          queue[qTail++] = nIdx;
        }
      }
    }

    // 1. Boss nasce SEMPRE no ponto acessível mais distante (maior distância BFS real, desempate por euclidiana)
    let bossPoint = { x: Math.max(padX, Math.min(width - padX, Math.round(playerX + 260))), y: Math.max(padY, Math.min(height - padY, Math.round(playerY))) };
    if (reachable.length > 0) {
      reachable.sort((a, b) => (b.bfsDist !== a.bfsDist ? b.bfsDist - a.bfsDist : b.euclid - a.euclid));
      bossPoint = { x: reachable[0].x, y: reachable[0].y };
    }

    // 2. Monstros comuns distribuídos apenas em células acessíveis (longe do spawn do jogador e espaçados)
    const mobPoints: Array<{ x: number; y: number }> = [];
    const shuffled = reachable.slice(1);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    const passes = [
      { safeR: 250, minSep: 115, bossSep: 95 },
      { safeR: 185, minSep: 72, bossSep: 65 },
      { safeR: 120, minSep: 40, bossSep: 35 },
      { safeR: 60, minSep: 18, bossSep: 18 },
    ];
    for (const p of passes) {
      for (const cand of shuffled) {
        if (mobPoints.length >= totalCount) break;
        if (cand.euclid < p.safeR) continue;
        if (Math.hypot(cand.x - bossPoint.x, cand.y - bossPoint.y) < p.bossSep) continue;
        let tooClose = false;
        for (const existing of mobPoints) {
          if (Math.hypot(cand.x - existing.x, cand.y - existing.y) < p.minSep) { tooClose = true; break; }
        }
        if (!tooClose) mobPoints.push({ x: cand.x, y: cand.y });
      }
      if (mobPoints.length >= totalCount) break;
    }

    // Fallback garantido reutilizando pontos acessíveis caso o mapa seja muito pequeno
    let fbIdx = 0;
    while (mobPoints.length < totalCount) {
      if (reachable.length > 0) {
        const pick = reachable[fbIdx % reachable.length];
        mobPoints.push({ x: pick.x, y: pick.y });
        fbIdx++;
      } else {
        const ang = (mobPoints.length / Math.max(1, totalCount)) * Math.PI * 2;
        mobPoints.push({
          x: Math.max(padX, Math.min(width - padX, Math.round(playerX + Math.cos(ang) * 220))),
          y: Math.max(padY, Math.min(height - padY, Math.round(playerY + Math.sin(ang) * 180))),
        });
      }
    }

    return { mobPoints, bossPoint };
  }

  /**
   * Inicia ou retoma a instância de combate livre da Dungeon quando o jogador está no mapa.
   */
  public static async enterDungeonBattle(
    prisma: PrismaClient,
    combatController: TemporaryCombatController,
    assetMirrorService: AssetMirrorService,
    characterId: number,
    mapId: number
  ) {
    const map = await prisma.gameMap.findUnique({
      where: { id: Number(mapId) },
      include: { mapType: true },
    });
    if (!map || map.mapType?.code !== 'DUNGEON') {
      throw new Error('Este mapa não é uma Dungeon.');
    }
    const charFlight = await prisma.playerCharacter.findUnique({ where: { id: Number(characterId) }, select: { isFlying: true } });
    if ((charFlight as any)?.isFlying) {
      throw new Error('Você precisa estar no chão para iniciar uma luta na Masmorra! Pouse sua montaria primeiro.');
    }
    if (CharacterActivityStateService.isFishing(Number(characterId))) {
      throw new Error('Pare de pescar antes de entrar em combate na Masmorra.');
    }
    const today = this.getTodayDateStr();
    let run = await (prisma as any).dungeonRun.findUnique({
      where: {
        characterId_dungeonMapId_entryDate: {
          characterId: Number(characterId),
          dungeonMapId: Number(map.id),
          entryDate: today,
        },
      },
    });

    if (run && run.status !== 'IN_PROGRESS') {
      const exitDestination = await this.resolveExitDestination(prisma, run);
      await prisma.playerCharacter.update({
        where: { id: Number(characterId) },
        data: {
          currentMapId: exitDestination.mapId,
          posX: exitDestination.x,
          posY: exitDestination.y,
        },
      });
      return {
        ticketSpent: true,
        exitDestination,
        message: '⏳ Sua entrada diária nesta Dungeon já foi utilizada hoje. Retornando ao ponto seguro.',
      };
    }

    if (!run) {
      run = await this.validateAndEnterDungeonRun(prisma, characterId, map.id);
    }

    if (run.battleId) {
      const existingBattle = combatController.getBattleState(run.battleId);
      if (existingBattle && !existingBattle.isFinished) {
        return { ticketSpent: false, battleState: existingBattle, dungeonRun: run };
      }
    }

    const mobCount = Math.max(1, Math.min(50, Number((map as any).dungeonMonsterCount) || 10));
    const bossId = Number((map as any).dungeonBossTemplateId) || null;

    let candidates = await MapSpawnResolver.findEligibleMonstersForMap<MonsterTemplate>(prisma, map);
    let bossTemplate: MonsterTemplate | null = bossId
      ? await prisma.monsterTemplate.findUnique({ where: { id: bossId } })
      : null;

    if (candidates.length === 0 && bossTemplate) {
      candidates = [bossTemplate];
    }
    if (candidates.length === 0) {
      throw new Error('Nenhum monstro configurado para spawnar nesta Dungeon.');
    }
    if (!bossTemplate) {
      bossTemplate = candidates[0];
    }

    const allTemplates = bossTemplate && !candidates.some((c) => c.id === bossTemplate!.id)
      ? [...candidates, bossTemplate]
      : candidates;

    const [i18nMap, scalingCtx, asset] = await Promise.all([
      I18nCache.getTranslations(prisma),
      MonsterCombatBuilder.loadScalingContext(prisma),
      assetMirrorService.getOrFetchAsset(map.mcreworkMapImage),
    ]);

    const dims = asset ? AssetMirrorService.getImageDimensions(asset.buffer) : null;
    const mapWidth = dims?.width ?? 2000;
    const mapHeight = dims?.height ?? 1500;
    const collisionPolys = (Array.isArray(map.collisionMeshJson) ? (map.collisionMeshJson as unknown as MapPolygon[]) : []).filter(
      (p) => Array.isArray(p?.points) && p.points.length >= 3
    );
    const colMesh = new MapPolygonMesh(collisionPolys);

    const pc = await prisma.playerCharacter.findUnique({ where: { id: Number(characterId) } });
    const rawStartX = Math.max(40, Math.min(mapWidth - 40, Number(pc?.posX ?? map.spawnX) || 500));
    const rawStartY = Math.max(40, Math.min(mapHeight - 40, Number(pc?.posY ?? map.spawnY) || 500));
    const safeSpawnX = Math.max(40, Math.min(mapWidth - 40, Number(map.spawnX) || 500));
    const safeSpawnY = Math.max(40, Math.min(mapHeight - 40, Number(map.spawnY) || 500));
    const playerStartX = colMesh.containsPoint(rawStartX, rawStartY) && !colMesh.containsPoint(safeSpawnX, safeSpawnY) ? safeSpawnX : rawStartX;
    const playerStartY = colMesh.containsPoint(rawStartX, rawStartY) && !colMesh.containsPoint(safeSpawnX, safeSpawnY) ? safeSpawnY : rawStartY;

    const { mobPoints, bossPoint } = this.generateDungeonSpawnCoords(
      mapWidth,
      mapHeight,
      collisionPolys,
      playerStartX,
      playerStartY,
      mobCount
    );

    const cfg = MonsterGlobalConfigService.getCachedConfig();
    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < mobCount; i++) {
      const tmpl = MonsterCombatBuilder.pickWeightedMonsterTemplate(candidates);
      const mobLvl = MonsterCombatBuilder.resolveBalancedMapMonsterLevel(
        map.requiredLevel || 1,
        map.levelVarianceMin,
        map.levelVarianceMax
      );
      const rTier = String(tmpl.rarityTier || 'F').toUpperCase();
      const baseName = i18nMap.get(tmpl.nameI18nKey) || tmpl.code;
      const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';
      const displayName = `${baseName} #${i + 1}${raritySuffix}`;

      const unit: CombatUnit = MonsterCombatBuilder.buildMonsterUnit(
        tmpl,
        mobLvl,
        i,
        displayName,
        scalingCtx,
        this.mcreworkPagesBaseUrl,
        'NORMAL'
      );
      // Regra de Dungeon via Configuração Global de Monstros
      unit.maxHp = Math.max(50, Math.round(unit.maxHp * cfg.dungeonNormalHpMult));
      unit.hp = unit.maxHp;
      unit.damageDealtMultiplier = cfg.dungeonNormalDamageDealtMult;
      unit.aggroRadius = cfg.dungeonNormalAggroRadius;
      unit.spawnX = mobPoints[i].x;
      unit.spawnY = mobPoints[i].y;
      monsterUnits.push(unit);
    }

    // Spawna o Boss Específico da Dungeon (Status de BOSS + modificadores globais de Dungeon)
    const bossLvl = MonsterCombatBuilder.resolveBalancedMapMonsterLevel(
      map.requiredLevel || 1,
      map.levelVarianceMin,
      map.levelVarianceMax
    );
    const bossRTier = String(bossTemplate.rarityTier || 'F').toUpperCase();
    const bossBaseName = i18nMap.get(bossTemplate.nameI18nKey) || bossTemplate.code;
    const bossRaritySuffix = bossRTier === 'SS' ? ' ⭐[SS]' : bossRTier === 'S' ? ' ⭐[S]' : '';
    const bossUnit: CombatUnit = MonsterCombatBuilder.buildMonsterUnit(
      bossTemplate,
      bossLvl,
      mobCount,
      `💀 [BOSS] ${bossBaseName}${bossRaritySuffix}`,
      scalingCtx,
      this.mcreworkPagesBaseUrl,
      'BOSS'
    );
    bossUnit.maxHp = Math.max(150, Math.round(bossUnit.maxHp * cfg.dungeonBossHpMult));
    bossUnit.hp = bossUnit.maxHp;
    bossUnit.damageDealtMultiplier = cfg.dungeonBossDamageDealtMult;
    bossUnit.aggroRadius = cfg.dungeonBossAggroRadius;
    bossUnit.isDungeonBoss = true;
    bossUnit.spawnX = bossPoint.x;
    bossUnit.spawnY = bossPoint.y;
    monsterUnits.push(bossUnit);

    const battleState = await combatController.createDungeonBattleInstance({
      characterId: Number(characterId),
      dungeonMapId: map.id,
      dungeonRunId: run.id,
      monsterUnits,
      scalingCtx,
      mapWidth,
      mapHeight,
      playerStartX,
      playerStartY,
    });

    await (prisma as any).dungeonRun.update({
      where: { id: run.id },
      data: { battleId: battleState.battleId },
    });

    return { ticketSpent: false, battleState, dungeonRun: run };
  }

  /**
   * Finaliza a Dungeon com Vitória quando todos os monstros e o Boss são derrotados.
   */
  public static async completeDungeonRun(
    prisma: PrismaClient,
    battleId: string,
    characterId: number,
    dungeonRunId?: number
  ): Promise<{ mapId: number; x: number; y: number } | null> {
    const run = dungeonRunId
      ? await (prisma as any).dungeonRun.findUnique({ where: { id: Number(dungeonRunId) } })
      : await (prisma as any).dungeonRun.findFirst({
          where: { characterId: Number(characterId), battleId },
        });
    if (!run) return await this.findFallbackSafeTown(prisma);

    const exitDestination = await this.resolveExitDestination(prisma, run);
    await (prisma as any).dungeonRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });

    CharacterActivityStateService.exitCombat(Number(characterId));
    MapPresenceService.removePlayer(characterId);
    await prisma.playerCharacter.update({
      where: { id: Number(characterId) },
      data: {
        currentMapId: exitDestination.mapId,
        posX: exitDestination.x,
        posY: exitDestination.y,
      },
    });

    return exitDestination;
  }

  /**
   * Processa fuga da Dungeon: consome o ingresso diário de hoje (status FLED) e retorna o jogador para fora.
   */
  public static async fleeDungeonRun(
    prisma: PrismaClient,
    combatController: TemporaryCombatController,
    characterId: number,
    mapId?: number,
    battleId?: string
  ) {
    const today = this.getTodayDateStr();
    const run = await (prisma as any).dungeonRun.findFirst({
      where: {
        characterId: Number(characterId),
        ...(mapId ? { dungeonMapId: Number(mapId) } : {}),
        entryDate: today,
        status: 'IN_PROGRESS',
      },
    });

    if (battleId) {
      combatController.endBattle(battleId);
    }

    const exitDestination = await this.resolveExitDestination(prisma, run);
    if (run) {
      await (prisma as any).dungeonRun.update({
        where: { id: run.id },
        data: { status: 'FLED', finishedAt: new Date() },
      });
    }

    CharacterActivityStateService.exitCombat(Number(characterId));
    MapPresenceService.removePlayer(characterId);
    await prisma.playerCharacter.update({
      where: { id: Number(characterId) },
      data: {
        currentMapId: exitDestination.mapId,
        posX: exitDestination.x,
        posY: exitDestination.y,
      },
    });

    return { ok: true, exitDestination };
  }

  /**
   * Marca a execução da Dungeon de hoje como DEFEATED quando o jogador morre lá dentro.
   */
  public static async failDungeonRunOnDeath(
    prisma: PrismaClient,
    characterId: number,
    dungeonMapId: number
  ): Promise<void> {
    CharacterActivityStateService.exitCombat(Number(characterId));
    const today = this.getTodayDateStr();
    await (prisma as any).dungeonRun.updateMany({
      where: {
        characterId: Number(characterId),
        dungeonMapId: Number(dungeonMapId),
        entryDate: today,
        status: 'IN_PROGRESS',
      },
      data: { status: 'DEFEATED', finishedAt: new Date() },
    });
  }

  /**
   * Roteador HTTP modular para endpoints de Dungeon na rota `/play`.
   */
  public static async handlePlayDungeonRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    userRole: string,
    prisma: PrismaClient,
    combatController: TemporaryCombatController,
    assetMirrorService: AssetMirrorService,
    verifyOwnership: (cId: number) => Promise<boolean>,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void
  ): Promise<boolean> {
    if (pathname === '/api/play/dungeon/enter-battle' && method === 'POST') {
      const body = await readJsonBody<{ characterId: number; mapId: number }>(req);
      const charId = Number(body.characterId) || 0;
      if (!(await verifyOwnership(charId))) {
        sendJson(res, 403, { error: 'Acesso não autorizado a este personagem.' });
        return true;
      }
      try {
        const result = await this.enterDungeonBattle(
          prisma,
          combatController,
          assetMirrorService,
          charId,
          Number(body.mapId)
        );
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err?.message || 'Erro ao iniciar instância da Dungeon.' });
      }
      return true;
    }

    if (pathname === '/api/play/dungeon/flee' && method === 'POST') {
      const body = await readJsonBody<{ characterId: number; mapId?: number; battleId?: string }>(req);
      const charId = Number(body.characterId) || 0;
      if (!(await verifyOwnership(charId))) {
        sendJson(res, 403, { error: 'Acesso não autorizado a este personagem.' });
        return true;
      }
      try {
        const result = await this.fleeDungeonRun(
          prisma,
          combatController,
          charId,
          body.mapId ? Number(body.mapId) : undefined,
          body.battleId
        );
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err?.message || 'Erro ao fugir da Dungeon.' });
      }
      return true;
    }

    if (pathname === '/api/play/dungeon/spawn-chest' && method === 'POST') {
      const body = await readJsonBody<{ battleId: string; x?: number; y?: number }>(req);
      const battle = combatController.getBattleState(String(body.battleId || ''));
      if (!battle || !battle.isDungeon) {
        sendJson(res, 404, { error: 'Instância de Dungeon não encontrada.' });
        return true;
      }
      if (!(await verifyOwnership(Number(battle.characterId) || 0))) {
        sendJson(res, 403, { error: 'Acesso não autorizado.' });
        return true;
      }
      try {
        const chest = await DungeonChestService.rollChestForBattle(
          prisma,
          combatController,
          String(body.battleId),
          Number(body.x),
          Number(body.y)
        );
        sendJson(res, 200, { ok: true, chest });
      } catch (err: any) {
        sendJson(res, 400, { error: err?.message || 'Erro ao gerar baú da Dungeon.' });
      }
      return true;
    }

    if (pathname === '/api/play/gm/reset-dungeon-tickets' && method === 'POST') {
      if (!['ADMIN', 'GM'].includes(userRole)) {
        sendJson(res, 403, { error: 'Apenas GM ou ADMIN podem resetar entradas de Dungeon.' });
        return true;
      }
      const body = await readJsonBody<{ characterId: number }>(req);
      const charId = Number(body.characterId) || 0;
      const today = this.getTodayDateStr();
      await (prisma as any).dungeonRun.deleteMany({
        where: { characterId: charId, entryDate: today },
      });
      sendJson(res, 200, { ok: true, message: 'Entradas diárias de Dungeon resetadas para hoje.' });
      return true;
    }

    return false;
  }
}
