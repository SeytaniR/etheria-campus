/**
 * @file apps/server/src/controllers/DungeonService.ts
 * @module @etheria/server
 * @description Serviço Autoritário das Dungeons Instanciadas (1x ao dia por personagem):
 *   - Garante MapType DUNGEON (não dominável, dentro do Véu, área de combate livre).
 *   - Controla entrada diária única (`dungeon_runs` por YYYY-MM-DD em America/Sao_Paulo).
 *   - Gera monstros normais (HP x2) + 1 Boss específico (status normais de Boss + HP x3),
 *     ambos com debuff de -30% no dano final aplicado e lógica de aggro curto.
 *   - Gerencia conclusão (vitória total), derrota (morte -> santuário) e fuga (gasta ingresso do dia).
 */

import type * as http from 'node:http';
import type { PrismaClient, MonsterTemplate } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { MapSpawnResolver } from './MapSpawnResolver.js';
import { MonsterCombatBuilder } from './MonsterCombatBuilder.js';
import type { TemporaryCombatController, CombatUnit } from './TemporaryCombatController.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import { MapPresenceService } from './MapPresenceService.js';

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
    } catch (err) {
      console.warn('[DungeonService] Aviso ao sincronizar MapType DUNGEON:', err);
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
   * Sorteia coordenadas válidas e livres de colisão por todo o mapa da Dungeon.
   * Mantém distância mínima segura do spawn do jogador e coloca o Boss mais afastado.
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
    const padX = Math.min(80, Math.round(width * 0.06));
    const padY = Math.min(80, Math.round(height * 0.06));
    const isSpotValid = (x: number, y: number, safeRadius: number, existing: Array<{ x: number; y: number }>, minSep: number) => {
      if (x < padX || y < padY || x > width - padX || y > height - padY) return false;
      if (Math.hypot(x - playerX, y - playerY) < safeRadius) return false;
      if (mesh.containsPoint(x, y)) return false;
      const m = 16;
      if (mesh.containsPoint(x + m, y) || mesh.containsPoint(x - m, y) || mesh.containsPoint(x, y + m) || mesh.containsPoint(x, y - m)) {
        return false;
      }
      for (const pt of existing) {
        if (Math.hypot(x - pt.x, y - pt.y) < minSep) return false;
      }
      return true;
    };

    const points: Array<{ x: number; y: number }> = [];
    const targetTotal = totalCount + 1; // +1 para o Boss
    const configs = [
      { safeR: 250, minSep: 110, tries: 350 },
      { safeR: 190, minSep: 70, tries: 350 },
      { safeR: 130, minSep: 40, tries: 350 },
    ];

    for (const cfg of configs) {
      let attempt = 0;
      while (points.length < targetTotal && attempt < cfg.tries) {
        attempt++;
        const rx = Math.round(padX + Math.random() * Math.max(100, width - padX * 2));
        const ry = Math.round(padY + Math.random() * Math.max(100, height - padY * 2));
        if (isSpotValid(rx, ry, cfg.safeR, points, cfg.minSep)) {
          points.push({ x: rx, y: ry });
        }
      }
      if (points.length >= targetTotal) break;
    }

    // Fallback garantido caso o mapa seja muito pequeno ou restrito
    while (points.length < targetTotal) {
      const ang = (points.length / Math.max(1, targetTotal)) * Math.PI * 2;
      const cx = Math.max(padX, Math.min(width - padX, Math.round(playerX + Math.cos(ang) * 260)));
      const cy = Math.max(padY, Math.min(height - padY, Math.round(playerY + Math.sin(ang) * 200)));
      points.push({ x: cx, y: cy });
    }

    // O Boss ocupa o ponto mais distante da entrada do jogador
    let bossIdx = 0;
    let maxDist = -1;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - playerX, points[i].y - playerY);
      if (d > maxDist) {
        maxDist = d;
        bossIdx = i;
      }
    }
    const bossPoint = points.splice(bossIdx, 1)[0];
    return { mobPoints: points, bossPoint };
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

    const [translations, scalingCtx, asset] = await Promise.all([
      prisma.i18nTranslation.findMany({
        where: { key: { in: allTemplates.map((t) => t.nameI18nKey) }, locale: 'pt-BR' },
      }),
      MonsterCombatBuilder.loadScalingContext(prisma),
      assetMirrorService.getOrFetchAsset(map.mcreworkMapImage),
    ]);

    const i18nMap = new Map(translations.map((t) => [t.key, t.text]));
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

    const pickWeightedCandidate = () => {
      let totalW = 0;
      const weights = candidates.map((c) => {
        const w = MonsterCombatBuilder.resolveRarityProfile(c.rarityTier).spawnWeight;
        totalW += w;
        return w;
      });
      let roll = Math.random() * totalW;
      for (let i = 0; i < candidates.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return candidates[i];
      }
      return candidates[candidates.length - 1];
    };

    const monsterUnits: CombatUnit[] = [];
    for (let i = 0; i < mobCount; i++) {
      const tmpl = pickWeightedCandidate();
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
      // Regra Oficial de Dungeon: Monstros recebem HP * 2, -30% dano final e aggro curto
      unit.maxHp = Math.max(50, Math.round(unit.maxHp * 2));
      unit.hp = unit.maxHp;
      unit.damageDealtMultiplier = 0.70;
      unit.aggroRadius = 210;
      unit.spawnX = mobPoints[i].x;
      unit.spawnY = mobPoints[i].y;
      monsterUnits.push(unit);
    }

    // Spawna o Boss Específico da Dungeon (Status normais de BOSS + HP * 3, -30% dano final)
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
    bossUnit.maxHp = Math.max(150, Math.round(bossUnit.maxHp * 3));
    bossUnit.hp = bossUnit.maxHp;
    bossUnit.damageDealtMultiplier = 0.70;
    bossUnit.aggroRadius = 250;
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
