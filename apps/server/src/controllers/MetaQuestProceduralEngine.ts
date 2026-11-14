/**
 * @file apps/server/src/controllers/MetaQuestProceduralEngine.ts
 * @module @etheria/server
 * @description Motor Procedural de Quests Meta (`questCategory = 'META'`).
 * @rules
 *   - Gera e valida estágios progressivos (1..N) com escalonamento configurável de objetivos
 *     (ex: inicial 10 com fator x10 => 10, 100, 1000, 10000, 100000...) sem números mágicos fixos.
 *   - Suporta alvos por Monstro específico (`KILL_MONSTER`), Raça/Tipo (`KILL_RACE`) ou
 *     Coleta e Entrega de Item (`COLLECT_ITEM`).
 *   - Calcula sugestões procedurais independentes para recompensas selecionáveis (EXP, Ouro,
 *     Pontos de Atributo, Item) em modo MULTIPLIER, LINEAR_PCT ou ADDITIVE, preservando
 *     integra qualquer edição manual por estágio feita pelo Admin na grade do modal.
 * @dependencies QuestTemplate (`meta_config_json`), CharacterQuestProgress (`current_stage`).
 */

export type MetaQuestTargetType = 'KILL_MONSTER' | 'KILL_RACE' | 'COLLECT_ITEM';
export type MetaQuestDropSourceMode = 'SPECIFIC_MONSTER' | 'RACE' | 'ANY_MONSTER';
export type MetaRewardScaleMode = 'MULTIPLIER' | 'LINEAR_PCT' | 'ADDITIVE';

export interface MetaRewardTrackConfigDto {
  enabled: boolean;
  baseValue: number;
  scaleMode: MetaRewardScaleMode;
  scaleFactor: number;
  itemTemplateId?: number | null;
}

export interface MetaQuestStageDto {
  stageIndex: number;
  requiredCount: number;
  rewardExp: number;
  rewardGold: number;
  rewardStatPoints: number;
  rewardItemTemplateId: number | null;
  rewardItemQuantity: number;
  triggerReborn?: boolean;
  stageDialogueCompletePtBr?: string | null;
}

export interface MetaQuestConfigDto {
  targetType: MetaQuestTargetType;
  monsterTemplateId?: number | null;
  raceCode?: string | null;
  itemTemplateId?: number | null;
  /** Fonte provisória de drop vinculada à quest enquanto o sistema completo de Drops/Economia não existe. */
  dropSourceMode?: MetaQuestDropSourceMode;
  dropMonsterTemplateId?: number | null;
  dropRaceCode?: string | null;
  dropChancePct?: number;
  initialRequiredCount: number;
  targetMultiplier: number;
  stageCount: number;
  rewardTracks?: {
    exp?: MetaRewardTrackConfigDto;
    gold?: MetaRewardTrackConfigDto;
    statPoints?: MetaRewardTrackConfigDto;
    item?: MetaRewardTrackConfigDto;
  };
  stages: MetaQuestStageDto[];
}

export class MetaQuestProceduralEngine {
  public static readonly MAX_STAGES = 15;
  public static readonly MAX_TARGET_COUNT = 9_000_000_000;

  public static computeScaledRewardValue(
    track: Partial<MetaRewardTrackConfigDto> | undefined,
    stageIndex: number,
  ): number {
    if (!track || !track.enabled) return 0;
    const base = Math.max(0, Number(track.baseValue) || 0);
    const factor = Math.max(0, Number(track.scaleFactor) || 0);
    const step = Math.max(0, stageIndex - 1);
    const mode: MetaRewardScaleMode =
      track.scaleMode === 'LINEAR_PCT' || track.scaleMode === 'ADDITIVE' ? track.scaleMode : 'MULTIPLIER';

    let result = base;
    if (mode === 'MULTIPLIER') {
      const mult = factor > 0 ? factor : 1;
      result = base * Math.pow(mult, step);
    } else if (mode === 'LINEAR_PCT') {
      result = base * (1 + (factor / 100) * step);
    } else {
      result = base + factor * step;
    }

    if (!Number.isFinite(result)) return 0;
    return Math.max(0, Math.min(MetaQuestProceduralEngine.MAX_TARGET_COUNT, Math.round(result)));
  }

  public static buildDefaultStages(cfg: Partial<MetaQuestConfigDto>): MetaQuestStageDto[] {
    const stageCount = Math.max(1, Math.min(MetaQuestProceduralEngine.MAX_STAGES, Math.round(Number(cfg.stageCount) || 3)));
    const initialCount = Math.max(1, Math.round(Number(cfg.initialRequiredCount) || 10));
    const multiplier = Math.max(1, Number(cfg.targetMultiplier) || 10);
    const tracks = cfg.rewardTracks || {};

    const stages: MetaQuestStageDto[] = [];
    for (let s = 1; s <= stageCount; s++) {
      const rawReq = initialCount * Math.pow(multiplier, s - 1);
      const requiredCount = Math.max(
        1,
        Math.min(MetaQuestProceduralEngine.MAX_TARGET_COUNT, Math.round(Number.isFinite(rawReq) ? rawReq : initialCount)),
      );
      const itemTrack = tracks.item;
      const itemId = itemTrack?.enabled && itemTrack.itemTemplateId ? Number(itemTrack.itemTemplateId) : null;
      const itemQty = itemId ? Math.max(1, this.computeScaledRewardValue(itemTrack, s)) : 0;

      stages.push({
        stageIndex: s,
        requiredCount,
        rewardExp: this.computeScaledRewardValue(tracks.exp, s),
        rewardGold: this.computeScaledRewardValue(tracks.gold, s),
        rewardStatPoints: 0, // REGRA SAGRADA: 0 pontos livres em quests (apenas Level Up concede pontos distribuíveis)
        rewardItemTemplateId: itemId,
        rewardItemQuantity: itemQty,
        triggerReborn: false,
        stageDialogueCompletePtBr: null,
      });
    }
    return stages;
  }

  public static normalizeConfig(raw: unknown): MetaQuestConfigDto {
    const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<MetaQuestConfigDto>;
    const validTargetTypes: MetaQuestTargetType[] = ['KILL_MONSTER', 'KILL_RACE', 'COLLECT_ITEM'];
    const targetType: MetaQuestTargetType = validTargetTypes.includes(input.targetType as MetaQuestTargetType)
      ? (input.targetType as MetaQuestTargetType)
      : 'KILL_MONSTER';

    const validDropModes: MetaQuestDropSourceMode[] = ['SPECIFIC_MONSTER', 'RACE', 'ANY_MONSTER'];
    const dropSourceMode: MetaQuestDropSourceMode = validDropModes.includes(
      input.dropSourceMode as MetaQuestDropSourceMode,
    )
      ? (input.dropSourceMode as MetaQuestDropSourceMode)
      : 'ANY_MONSTER';

    const stageCount = Math.max(
      1,
      Math.min(MetaQuestProceduralEngine.MAX_STAGES, Math.round(Number(input.stageCount) || 3)),
    );
    const initialRequiredCount = Math.max(1, Math.round(Number(input.initialRequiredCount) || 10));
    const targetMultiplier = Math.max(1, Number(input.targetMultiplier) || 10);

    const sanitizedInput: Partial<MetaQuestConfigDto> = {
      targetType,
      monsterTemplateId: input.monsterTemplateId ? Number(input.monsterTemplateId) : null,
      raceCode: input.raceCode ? String(input.raceCode).trim().toUpperCase() : null,
      itemTemplateId: input.itemTemplateId ? Number(input.itemTemplateId) : null,
      dropSourceMode,
      dropMonsterTemplateId: input.dropMonsterTemplateId ? Number(input.dropMonsterTemplateId) : null,
      dropRaceCode: input.dropRaceCode ? String(input.dropRaceCode).trim().toUpperCase() : null,
      dropChancePct: Math.max(1, Math.min(100, Number(input.dropChancePct ?? 100) || 100)),
      initialRequiredCount,
      targetMultiplier,
      stageCount,
      rewardTracks: input.rewardTracks || {},
    };

    const generated = this.buildDefaultStages(sanitizedInput);
    const rawStages = Array.isArray(input.stages) ? input.stages : [];
    const stages: MetaQuestStageDto[] = [];

    for (let idx = 0; idx < stageCount; idx++) {
      const stageNumber = idx + 1;
      const provided = rawStages[idx];
      const fallback = generated[idx];
      if (!provided || typeof provided !== 'object') {
        stages.push(fallback);
        continue;
      }

      const reqCount = Math.max(
        1,
        Math.min(MetaQuestProceduralEngine.MAX_TARGET_COUNT, Math.round(Number(provided.requiredCount) || fallback.requiredCount)),
      );
      const rewardItemTemplateId = provided.rewardItemTemplateId ? Number(provided.rewardItemTemplateId) : null;
      const rewardItemQuantity = rewardItemTemplateId
        ? Math.max(1, Math.min(999999, Math.round(Number(provided.rewardItemQuantity) || 1)))
        : 0;

      stages.push({
        stageIndex: stageNumber,
        requiredCount: reqCount,
        rewardExp: Math.max(0, Math.min(MetaQuestProceduralEngine.MAX_TARGET_COUNT, Math.round(Number(provided.rewardExp ?? fallback.rewardExp) || 0))),
        rewardGold: Math.max(0, Math.min(MetaQuestProceduralEngine.MAX_TARGET_COUNT, Math.round(Number(provided.rewardGold ?? fallback.rewardGold) || 0))),
        rewardStatPoints: 0, // REGRA SAGRADA: 0 pontos livres em quests
        rewardItemTemplateId,
        rewardItemQuantity,
        triggerReborn: Boolean(provided.triggerReborn),
        stageDialogueCompletePtBr: provided.stageDialogueCompletePtBr
          ? String(provided.stageDialogueCompletePtBr).trim()
          : null,
      });
    }

    return {
      targetType,
      monsterTemplateId: sanitizedInput.monsterTemplateId,
      raceCode: sanitizedInput.raceCode,
      itemTemplateId: sanitizedInput.itemTemplateId,
      dropSourceMode: sanitizedInput.dropSourceMode,
      dropMonsterTemplateId: sanitizedInput.dropMonsterTemplateId,
      dropRaceCode: sanitizedInput.dropRaceCode,
      dropChancePct: sanitizedInput.dropChancePct,
      initialRequiredCount,
      targetMultiplier,
      stageCount,
      rewardTracks: sanitizedInput.rewardTracks,
      stages,
    };
  }

  public static resolveActiveStage(config: MetaQuestConfigDto, rawStageIndex: number): {
    stage: MetaQuestStageDto;
    stageIndex: number;
    totalStages: number;
  } {
    const stages = Array.isArray(config.stages) && config.stages.length > 0
      ? config.stages
      : this.buildDefaultStages(config);
    const totalStages = stages.length;
    const clampedIndex = Math.max(1, Math.min(totalStages, Math.round(Number(rawStageIndex) || 1)));
    return {
      stage: stages[clampedIndex - 1],
      stageIndex: clampedIndex,
      totalStages,
    };
  }

  public static formatTargetLabelPtBr(
    config: MetaQuestConfigDto,
    stage: MetaQuestStageDto,
    names: { monsterName?: string; raceName?: string; itemName?: string },
  ): string {
    const qty = Number(stage.requiredCount || 1).toLocaleString('pt-BR');
    if (config.targetType === 'KILL_RACE') {
      return `Abater ${qty}x da Raça ${names.raceName || config.raceCode || 'Qualquer'}`;
    }
    if (config.targetType === 'COLLECT_ITEM') {
      return `Coletar e entregar ${qty}x ${names.itemName || `Item #${config.itemTemplateId || '?'}`}`;
    }
    return `Abater ${qty}x ${names.monsterName || `Monstro #${config.monsterTemplateId || '?'}`}`;
  }
}
