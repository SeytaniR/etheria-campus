/**
 * @file apps/server/src/controllers/MapSpawnResolver.ts
 * @module @etheria/server
 * @description Resolvedor autoritativo e encapsulado das regras de spawn de monstros por mapa.
 *   Centraliza:
 *     1. Bloqueio absoluto de spawn em tipos de mapa seguros (`MapType.allowMonsterSpawn === false`, como Cidades e Vilas);
 *     2. Normalização estrita de `encounterRatePct`, `allowedMonsterRacesJson` e `allowedMonsterTemplateIdsJson`;
 *     3. Resolução estrita do pool elegível (união de raças selecionadas + monstros individuais permitidos,
 *        mesmo que pertençam a outra raça), sem fallback global para todos os monstros do banco.
 */

export interface MapSpawnTypeRule {
  allowMonsterSpawn: boolean;
}

export interface MapSpawnConfigInput {
  encounterRatePct?: number | null;
  allowedMonsterRacesJson?: unknown;
  allowedMonsterTemplateIdsJson?: unknown;
  mapType?: MapSpawnTypeRule | null;
}

export interface MonsterTemplateSpawnCandidate {
  id: number;
  raceCode: string;
  isActive: boolean;
}

export interface MonsterSpawnPrismaPort {
  monsterTemplate: {
    findMany(args: {
      where: {
        isActive: boolean;
        OR: Array<{ raceCode?: { in: string[] }; id?: { in: number[] } }>;
      };
    }): Promise<unknown[]>;
  };
}

export class MapSpawnResolver {
  public static parseAllowedRaces(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const unique = new Set<string>();
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const normalized = item.trim();
      if (normalized.length > 0) {
        unique.add(normalized);
      }
    }
    return Array.from(unique);
  }

  public static parseAllowedMonsterIds(raw: unknown): number[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const unique = new Set<number>();
    for (const item of raw) {
      const parsed = Number(item);
      if (Number.isInteger(parsed) && parsed > 0) {
        unique.add(parsed);
      }
    }
    return Array.from(unique);
  }

  public static resolveEffectiveEncounterRate(allowMonsterSpawn: boolean, rawRate: unknown): number {
    if (!allowMonsterSpawn) {
      return 0.0;
    }
    const numeric = Number(rawRate ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0.0;
    }
    return Math.max(0, Math.min(100, numeric));
  }

  public static canMapSpawnMonsters(map: MapSpawnConfigInput | null | undefined): boolean {
    if (!map || !map.mapType || map.mapType.allowMonsterSpawn !== true) {
      return false;
    }
    return this.resolveEffectiveEncounterRate(true, map.encounterRatePct) > 0;
  }

  public static async findEligibleMonstersForMap<
    T extends MonsterTemplateSpawnCandidate = MonsterTemplateSpawnCandidate,
  >(prisma: MonsterSpawnPrismaPort, map: MapSpawnConfigInput | null | undefined): Promise<T[]> {
    if (!this.canMapSpawnMonsters(map)) {
      return [];
    }

    const allowedRaces = this.parseAllowedRaces(map?.allowedMonsterRacesJson);
    const allowedIds = this.parseAllowedMonsterIds(map?.allowedMonsterTemplateIdsJson);

    // Regra estrita: sem tipos permitidos E sem monstros individuais configurados,
    // nenhum monstro pode nascer neste mapa (proibido fallback global).
    if (allowedRaces.length === 0 && allowedIds.length === 0) {
      return [];
    }

    const orClauses: Array<{ raceCode?: { in: string[] }; id?: { in: number[] } }> = [];
    if (allowedRaces.length > 0) {
      orClauses.push({ raceCode: { in: allowedRaces } });
    }
    if (allowedIds.length > 0) {
      orClauses.push({ id: { in: allowedIds } });
    }

    const rows = (await prisma.monsterTemplate.findMany({
      where: {
        isActive: true,
        OR: orClauses,
      },
    })) as T[];

    const raceSet = new Set(allowedRaces);
    const idSet = new Set(allowedIds);

    return rows.filter(
      (tpl) =>
        Boolean(tpl && tpl.isActive) &&
        (raceSet.has(String(tpl.raceCode || '').trim()) || idSet.has(Number(tpl.id))),
    );
  }
}
