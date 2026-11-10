/**
 * @file apps/server/src/controllers/AdminExperienceController.ts
 * @module @etheria/server
 * @description Controller da Tabela de Níveis e Experiência (`level_experience_templates`) da Rota `/admin`.
 *   - Permite geração procedural global com base numérica (Base XP, Exponente, Incremento Linear, Bônus).
 *   - Permite edições em lote de 10 em 10 níveis (Grupos / Brackets: 1-10, 11-20, etc.) com multiplicadores e recompensas.
 *   - Permite ajuste fino individual de cada nível com recálculo automático da curva acumulada total.
 *   - Sincronização automática com Snapshot JSON e persistência autoritária no PostgreSQL.
 * @rules Segue estritamente AGENTS.md (Limite < 900 linhas, Arquitetura OO).
 */

import { PrismaClient, SnapshotManager } from '@etheria/database';

export interface ProceduralCurveDto {
  baseExperience?: number;
  growthExponent?: number;
  flatIncrement?: number;
  maxLevel?: number;
  statPointsReward?: number;
  skillPointsReward?: number;
  hpBonus?: number;
  mpBonus?: number;
}

export interface BracketUpdateDto {
  multiplier?: number;
  flatOffset?: number;
  statPointsReward?: number;
  skillPointsReward?: number;
  hpBonus?: number;
  mpBonus?: number;
  bracketBaseXp?: number;
  bracketGrowthExponent?: number;
}

export interface SingleLevelUpdateDto {
  experienceToNext?: number;
  statPointsReward?: number;
  skillPointsReward?: number;
  hpBonus?: number;
  mpBonus?: number;
}

export class AdminExperienceController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Retorna a lista completa de níveis e experiência configurados, ordenados do nível 1 ao nível máximo.
   */
  public async getLevelExperienceTemplates(bracketTier?: number) {
    const whereClause: any = {};
    if (typeof bracketTier === 'number' && bracketTier > 0) {
      whereClause.bracketTier = bracketTier;
    }

    const levels = await this.prisma.levelExperienceTemplate.findMany({
      where: whereClause,
      orderBy: { level: 'asc' },
    });

    return levels.map((l) => ({
      level: l.level,
      experienceToNext: Number(l.experienceToNext),
      totalExperience: Number(l.totalExperience),
      statPointsReward: l.statPointsReward,
      skillPointsReward: l.skillPointsReward,
      hpBonus: l.hpBonus,
      mpBonus: l.mpBonus,
      bracketTier: l.bracketTier,
      updatedAt: l.updatedAt,
    }));
  }

  /**
   * Gera a curva procedural global para todos os níveis de 1 até maxLevel.
   * Fórmula: XP(L) = Math.round(baseXP * Math.pow(L, exponent) + (L - 1) * flatIncrement)
   */
  public async generateProceduralCurve(dto: ProceduralCurveDto) {
    const baseXP = Math.max(10, Number(dto.baseExperience) || 100);
    const exponent = Math.max(1.0, Math.min(3.5, Number(dto.growthExponent) || 1.45));
    const flatInc = Math.max(0, Number(dto.flatIncrement) || 50);
    const maxLevel = Math.max(10, Math.min(200, Number(dto.maxLevel) || 100));
    const statPts = Math.max(0, Number(dto.statPointsReward) ?? 5);
    const skillPts = Math.max(0, Number(dto.skillPointsReward) ?? 1);
    const hpBonus = Math.max(0, Number(dto.hpBonus) ?? 20);
    const mpBonus = Math.max(0, Number(dto.mpBonus) ?? 10);

    let cumulativeTotal = BigInt(0);
    const records: Array<{
      level: number;
      experienceToNext: bigint;
      totalExperience: bigint;
      statPointsReward: number;
      skillPointsReward: number;
      hpBonus: number;
      mpBonus: number;
      bracketTier: number;
    }> = [];

    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const bracketTier = Math.floor((lvl - 1) / 10) + 1;
      let expToNext = BigInt(0);

      if (lvl < maxLevel) {
        // Cálculo procedural exponencial + linear suave
        const rawXp = Math.round(baseXP * Math.pow(lvl, exponent) + (lvl - 1) * flatInc);
        expToNext = BigInt(Math.max(10, rawXp));
      }

      records.push({
        level: lvl,
        experienceToNext: expToNext,
        totalExperience: cumulativeTotal,
        statPointsReward: statPts,
        skillPointsReward: skillPts,
        hpBonus: hpBonus,
        mpBonus: mpBonus,
        bracketTier: bracketTier,
      });

      cumulativeTotal += expToNext;
    }

    // Executa em transação atômica: limpa e recria a progressão inteira
    await this.prisma.$transaction(async (tx) => {
      await tx.levelExperienceTemplate.deleteMany({});
      for (const r of records) {
        await tx.levelExperienceTemplate.create({ data: r });
      }
    });

    try {
      await this.snapshotManager.exportToDisk();
    } catch (err) {
      console.error('Aviso: Falha ao exportar snapshot de progressão de níveis:', err);
    }

    return {
      success: true,
      message: `Curva procedural gerada com sucesso para ${records.length} níveis!`,
      totalLevels: records.length,
      maxLevelExperience: cumulativeTotal.toString(),
      levels: await this.getLevelExperienceTemplates(),
    };
  }

  /**
   * Altera em lote um grupo de 10 em 10 níveis (Brackets 1-10, 11-20, 21-30, etc.).
   * Suporta multiplicador percentual, soma fixa ou recalibração de recompensas e curva interna.
   */
  public async updateBracketGroup(bracketTier: number, dto: BracketUpdateDto) {
    if (!bracketTier || bracketTier < 1) {
      throw new Error('Bracket tier inválido.');
    }

    const allLevels = await this.prisma.levelExperienceTemplate.findMany({
      orderBy: { level: 'asc' },
    });

    if (allLevels.length === 0) {
      throw new Error('Nenhum nível cadastrado. Gere primeiro a curva procedural.');
    }

    const minLvl = (bracketTier - 1) * 10 + 1;
    const maxLvl = bracketTier * 10;
    const targetLevels = allLevels.filter((l) => l.level >= minLvl && l.level <= maxLvl);

    if (targetLevels.length === 0) {
      throw new Error(`Nenhum nível encontrado para o Grupo ${bracketTier} (Níveis ${minLvl} a ${maxLvl}).`);
    }

    const mult = typeof dto.multiplier === 'number' && dto.multiplier > 0 ? dto.multiplier : 1.0;
    const offset = typeof dto.flatOffset === 'number' ? dto.flatOffset : 0;
    const statPts = typeof dto.statPointsReward === 'number' ? dto.statPointsReward : undefined;
    const skillPts = typeof dto.skillPointsReward === 'number' ? dto.skillPointsReward : undefined;
    const hpB = typeof dto.hpBonus === 'number' ? dto.hpBonus : undefined;
    const mpB = typeof dto.mpBonus === 'number' ? dto.mpBonus : undefined;

    // Atualiza os registros do grupo
    for (const lvlRec of targetLevels) {
      let newExp = Number(lvlRec.experienceToNext);

      if (dto.bracketBaseXp && dto.bracketGrowthExponent) {
        // Sub-gerador procedural do bracket
        const stepInBracket = lvlRec.level - minLvl + 1;
        newExp = Math.round(dto.bracketBaseXp * Math.pow(stepInBracket, dto.bracketGrowthExponent));
      } else {
        if (mult !== 1.0) newExp = Math.round(newExp * mult);
        if (offset !== 0) newExp = Math.max(10, newExp + offset);
      }

      lvlRec.experienceToNext = BigInt(newExp);
      if (typeof statPts === 'number') lvlRec.statPointsReward = statPts;
      if (typeof skillPts === 'number') lvlRec.skillPointsReward = skillPts;
      if (typeof hpB === 'number') lvlRec.hpBonus = hpB;
      if (typeof mpB === 'number') lvlRec.mpBonus = mpB;
    }

    // Recalcula a cadeia inteira de totalExperience para consistência matemática
    let cumulative = BigInt(0);
    for (const l of allLevels) {
      l.totalExperience = cumulative;
      cumulative += l.experienceToNext;
    }

    // Grava tudo no banco em transação
    await this.prisma.$transaction(async (tx) => {
      for (const l of allLevels) {
        await tx.levelExperienceTemplate.update({
          where: { level: l.level },
          data: {
            experienceToNext: l.experienceToNext,
            totalExperience: l.totalExperience,
            statPointsReward: l.statPointsReward,
            skillPointsReward: l.skillPointsReward,
            hpBonus: l.hpBonus,
            mpBonus: l.mpBonus,
          },
        });
      }
    });

    try {
      await this.snapshotManager.exportToDisk();
    } catch (err) {
      console.error('Aviso ao exportar snapshot de progressão:', err);
    }

    return {
      success: true,
      message: `Grupo ${bracketTier} (Níveis ${minLvl}-${maxLvl}) atualizado com sucesso!`,
      bracketTier,
      levels: await this.getLevelExperienceTemplates(),
    };
  }

  /**
   * Altera os valores de um nível individualmente e recalcula a experiência acumulada subsequente.
   */
  public async updateSingleLevel(level: number, dto: SingleLevelUpdateDto) {
    if (!level || level < 1) {
      throw new Error('Nível inválido.');
    }

    const allLevels = await this.prisma.levelExperienceTemplate.findMany({
      orderBy: { level: 'asc' },
    });

    const target = allLevels.find((l) => l.level === level);
    if (!target) {
      throw new Error(`Nível ${level} não encontrado.`);
    }

    if (typeof dto.experienceToNext === 'number') {
      target.experienceToNext = BigInt(Math.max(0, Math.round(dto.experienceToNext)));
    }
    if (typeof dto.statPointsReward === 'number') {
      target.statPointsReward = Math.max(0, dto.statPointsReward);
    }
    if (typeof dto.skillPointsReward === 'number') {
      target.skillPointsReward = Math.max(0, dto.skillPointsReward);
    }
    if (typeof dto.hpBonus === 'number') {
      target.hpBonus = Math.max(0, dto.hpBonus);
    }
    if (typeof dto.mpBonus === 'number') {
      target.mpBonus = Math.max(0, dto.mpBonus);
    }

    // Recalcula acumulado a partir do nível alterado
    let cumulative = BigInt(0);
    for (const l of allLevels) {
      l.totalExperience = cumulative;
      cumulative += l.experienceToNext;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const l of allLevels) {
        await tx.levelExperienceTemplate.update({
          where: { level: l.level },
          data: {
            experienceToNext: l.experienceToNext,
            totalExperience: l.totalExperience,
            statPointsReward: l.statPointsReward,
            skillPointsReward: l.skillPointsReward,
            hpBonus: l.hpBonus,
            mpBonus: l.mpBonus,
          },
        });
      }
    });

    try {
      await this.snapshotManager.exportToDisk();
    } catch (err) {
      console.error('Aviso ao exportar snapshot de progressão:', err);
    }

    return {
      success: true,
      message: `Nível ${level} atualizado com sucesso!`,
      level: {
        level: target.level,
        experienceToNext: Number(target.experienceToNext),
        totalExperience: Number(target.totalExperience),
        statPointsReward: target.statPointsReward,
        skillPointsReward: target.skillPointsReward,
        hpBonus: target.hpBonus,
        mpBonus: target.mpBonus,
        bracketTier: target.bracketTier,
      },
      levels: await this.getLevelExperienceTemplates(),
    };
  }

  /**
   * Semeia a progressão inicial balanceada de 1 a 100 se o banco estiver vazio.
   */
  public async seedInitialLevelExperienceIfEmpty() {
    const count = await this.prisma.levelExperienceTemplate.count();
    if (count > 0) return;

    console.log('🌱 [AdminExperienceController] Semeando tabela de Níveis e XP (1 a 100)...');
    await this.generateProceduralCurve({
      baseExperience: 100,
      growthExponent: 1.48,
      flatIncrement: 60,
      maxLevel: 100,
      statPointsReward: 5,
      skillPointsReward: 1,
      hpBonus: 25,
      mpBonus: 10,
    });
    console.log('✅ [AdminExperienceController] Tabela de Níveis e XP semeada com sucesso (100 níveis).');
  }
}
