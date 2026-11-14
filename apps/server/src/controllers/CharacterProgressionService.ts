/**
 * @file apps/server/src/controllers/CharacterProgressionService.ts
 * @module @etheria/server
 * @description Serviço Centralizado de Progressão de Nível, XP e Atributos para Personagens e Pets.
 *   - Gerencia avanço de Nível autoritário baseado em `level_experience_templates`.
 *   - Concede RIGOROSAMENTE 5 pontos base distribuíveis por Level Up do Jogador (Regra Sagrada).
 *   - Aplica progressão e level up sincronizado para Pets ativos em combate e missões.
 *   - Persiste dados de forma atômica no banco de dados sem alterar dados ou tabelas existentes.
 * @rules Segue estritamente AGENTS.md (Limite < 900 linhas, Arquitetura OO).
 */

import { PrismaClient } from '@etheria/database';
import { GameChatService } from './GameChatService.js';

export interface PlayerProgressionResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  oldExp: number;
  newExp: number;
  maxXp: number;
  unspentStatPoints: number;
  statPointsGained: number;
}

export interface PetProgressionResult {
  petId: number;
  nickname: string;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
  oldExp: number;
  newExp: number;
  maxXp: number;
}

export interface FullProgressionResult {
  player: PlayerProgressionResult;
  pets: PetProgressionResult[];
}

export class CharacterProgressionService {
  /**
   * Obtém o mapa de XP necessária por nível a partir de `level_experience_templates`.
   */
  public static async getExperienceMap(
    prismaOrTx: any,
    fromLevel: number = 1
  ): Promise<Map<number, number>> {
    try {
      const expLevels = await prismaOrTx.levelExperienceTemplate.findMany({
        where: { level: { gte: fromLevel } },
        orderBy: { level: 'asc' },
      });
      return new Map<number, number>(
        expLevels.map((l: any) => [Number(l.level), Number(l.experienceToNext)])
      );
    } catch {
      return new Map<number, number>();
    }
  }

  /**
   * Concede Experiência ao Jogador, processa múltiplos Level Ups se atingir a meta,
   * soma rigorosamente 5 pontos distribuíveis por level up e persiste em `player_characters`.
   */
  public static async awardCharacterExperience(
    prismaOrTx: any,
    characterId: number,
    expGain: number
  ): Promise<PlayerProgressionResult | null> {
    if (!characterId) return null;

    const pc = await prismaOrTx.playerCharacter.findUnique({
      where: { id: characterId },
    });
    if (!pc) return null;

    const oldLevel = pc.level || 1;
    const oldExp = Number(pc.experience || 0);

    if (expGain <= 0) {
      const expMap = await this.getExperienceMap(prismaOrTx, oldLevel);
      const currentMaxXp = expMap.get(oldLevel) ?? (oldLevel * 200);
      return {
        leveledUp: false,
        oldLevel,
        newLevel: oldLevel,
        levelsGained: 0,
        oldExp,
        newExp: oldExp,
        maxXp: currentMaxXp,
        unspentStatPoints: pc.unspentStatPoints || 0,
        statPointsGained: 0,
      };
    }

    let currentLevel = oldLevel;
    let currentExp = oldExp + expGain;
    let unspentStatPoints = Number(pc.unspentStatPoints || 0);
    let levelsGained = 0;
    let statPointsGained = 0;

    const expMap = await this.getExperienceMap(prismaOrTx, currentLevel);

    while (true) {
      if (currentLevel >= 100) break;
      const requiredExp = expMap.get(currentLevel) ?? (currentLevel * 200);
      if (requiredExp > 0 && currentExp >= requiredExp) {
        currentExp -= requiredExp;
        currentLevel += 1;
        levelsGained += 1;
        // REGRA SAGRADA: Exatamente 5 pontos base distribuíveis por Level Up
        unspentStatPoints += 5;
        statPointsGained += 5;
      } else {
        break;
      }
    }

    const currentMaxXp = expMap.get(currentLevel) ?? (currentLevel * 200);

    await prismaOrTx.playerCharacter.update({
      where: { id: characterId },
      data: {
        level: currentLevel,
        experience: BigInt(currentExp),
        unspentStatPoints: unspentStatPoints,
      },
    });

    if (levelsGained > 0) {
      try {
        GameChatService.sendSystemMessage(
          `🎉 Parabéns! ${pc.name} alcançou o Nível ${currentLevel}! (+${statPointsGained} Pontos de Atributos)`
        );
      } catch (_) {}
    }

    return {
      leveledUp: levelsGained > 0,
      oldLevel,
      newLevel: currentLevel,
      levelsGained,
      oldExp,
      newExp: currentExp,
      maxXp: currentMaxXp,
      unspentStatPoints,
      statPointsGained,
    };
  }

  /**
   * Concede Experiência aos Pets de um Personagem, processa Level Ups e persiste em `character_pets`.
   * Se targetPetIds for fornecido, aplica apenas a esses pets; senão aplica aos até 3 primeiros pets (ativos).
   */
  public static async awardPetsExperience(
    prismaOrTx: any,
    characterId: number,
    expGain: number,
    targetPetIds?: number[]
  ): Promise<PetProgressionResult[]> {
    if (!characterId || expGain <= 0) return [];

    let petsQuery: any = { characterId };
    if (Array.isArray(targetPetIds) && targetPetIds.length > 0) {
      petsQuery.id = { in: targetPetIds };
    }

    const pets = await prismaOrTx.characterPet.findMany({
      where: petsQuery,
      take: 3,
      include: { monsterTemplate: true },
    });

    if (!pets || pets.length === 0) return [];

    const minPetLevel = Math.min(...pets.map((p: any) => p.level || 1));
    const expMap = await this.getExperienceMap(prismaOrTx, minPetLevel);

    const results: PetProgressionResult[] = [];

    for (const pet of pets) {
      const oldLevel = pet.level || 1;
      const oldExp = Number(pet.experience || 0);
      let currentLevel = oldLevel;
      let currentExp = oldExp + expGain;
      let levelsGained = 0;

      while (true) {
        if (currentLevel >= 100) break;
        const requiredExp = expMap.get(currentLevel) ?? (currentLevel * 200);
        if (requiredExp > 0 && currentExp >= requiredExp) {
          currentExp -= requiredExp;
          currentLevel += 1;
          levelsGained += 1;
        } else {
          break;
        }
      }

      const currentMaxXp = expMap.get(currentLevel) ?? (currentLevel * 200);

      await prismaOrTx.characterPet.update({
        where: { id: pet.id },
        data: {
          level: currentLevel,
          experience: BigInt(currentExp),
        },
      });

      const petName = pet.nickname || pet.monsterTemplate?.code || `Pet #${pet.id}`;

      results.push({
        petId: pet.id,
        nickname: petName,
        leveledUp: levelsGained > 0,
        oldLevel,
        newLevel: currentLevel,
        levelsGained,
        oldExp,
        newExp: currentExp,
        maxXp: currentMaxXp,
      });
    }

    return results;
  }

  /**
   * Concede Experiência simultaneamente para o Jogador e para seus Pets ativos em combate/missões.
   */
  public static async awardProgression(
    prismaOrTx: any,
    characterId: number,
    expGain: number,
    targetPetIds?: number[]
  ): Promise<FullProgressionResult | null> {
    const playerResult = await this.awardCharacterExperience(prismaOrTx, characterId, expGain);
    if (!playerResult) return null;
    const petsResult = await this.awardPetsExperience(prismaOrTx, characterId, expGain, targetPetIds);
    return {
      player: playerResult,
      pets: petsResult,
    };
  }
}
