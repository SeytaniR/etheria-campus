/**
 * @file apps/server/src/security/CombatAntiCheatService.ts
 * @module @etheria/server/security/CombatAntiCheatService
 * @description Serviço autoritário de mitigação anti-cheat para encontros e declarações de vitória em combate.
 * @rules
 *   - Impõe cooldown mínimo entre encontros por personagem para contas PLAYER.
 *   - Exige `battleNonce` criptográfico emitido pelo servidor no início da batalha.
 *   - Valida número mínimo de golpes, dano acumulado plausível vs HP total dos monstros e tempo mínimo
 *     de combate calculado pelo DPS teórico máximo da equipe.
 *   - Preserva agilidade para testes operacionais de contas GM/ADMIN/DEV.
 * @dependencies ../controllers/TemporaryCombatController.js
 */

import type { TemporaryBattleState } from '../controllers/TemporaryCombatController.js';

export interface VictoryClaimPayload {
  battleNonce?: string;
  totalDamageDealt?: number;
  hitsCount?: number;
}

export interface AntiCheatValidationResult {
  ok: boolean;
  reason?: string;
}

export class CombatAntiCheatService {
  private static readonly ENCOUNTER_COOLDOWN_MS = 1500;
  private static readonly encounterTimestamps = new Map<number, number>();

  /**
   * Verifica se o personagem está apto a iniciar um novo encontro no mapa (anti-spam de encontros).
   */
  public static checkEncounterAllowed(
    characterId: number,
    role: string,
    hasActiveUnfinishedBattle: boolean
  ): AntiCheatValidationResult {
    if (['ADMIN', 'GM', 'DEV'].includes(role)) {
      return { ok: true };
    }

    if (hasActiveUnfinishedBattle) {
      return { ok: false, reason: 'Já existe uma batalha ativa em andamento para este personagem.' };
    }

    const now = Date.now();
    const lastAt = this.encounterTimestamps.get(characterId) || 0;
    if (now - lastAt < this.ENCOUNTER_COOLDOWN_MS) {
      return { ok: false, reason: 'Aguarde um instante antes de iniciar outro encontro.' };
    }

    // Limpeza oportunista caso o mapa cresça muito em sessões longas
    if (this.encounterTimestamps.size > 5000) {
      const cutoff = now - 60_000;
      for (const [cid, ts] of this.encounterTimestamps.entries()) {
        if (ts < cutoff) this.encounterTimestamps.delete(cid);
      }
    }

    this.encounterTimestamps.set(characterId, now);
    return { ok: true };
  }

  /**
   * Valida a reivindicação de vitória de combate da Arena Action antes de conceder XP, Ouro e Drops.
   */
  public static validateVictoryClaim(
    battle: TemporaryBattleState,
    role: string,
    payload: VictoryClaimPayload
  ): AntiCheatValidationResult {
    if (['ADMIN', 'GM', 'DEV'].includes(role)) {
      return { ok: true };
    }

    if (!battle.battleNonce || !payload.battleNonce || payload.battleNonce !== battle.battleNonce) {
      return { ok: false, reason: 'Token de verificação de batalha (battleNonce) ausente ou inválido.' };
    }

    const totalMobHp = (battle.monsters || []).reduce(
      (acc, m) => acc + Math.max(1, Number(m.maxHp) || 1),
      0
    );

    const hitsCount = Number(payload.hitsCount) || 0;
    const totalDamageDealt = Number(payload.totalDamageDealt) || 0;

    if (hitsCount < 1) {
      return { ok: false, reason: 'Registro de combate inválido: nenhum golpe contabilizado.' };
    }

    if (totalDamageDealt < Math.floor(totalMobHp * 0.9)) {
      return { ok: false, reason: 'Dano total insuficiente para encerrar os monstros da batalha.' };
    }

    const elapsedMs = Date.now() - (battle.createdAt || 0);
    const playerAtk = Math.max(
      Number(battle.player?.physAtk) || 0,
      Number(battle.player?.magAtk) || 0,
      Number(battle.player?.atk) || 10
    );
    const petsAtk = (battle.pets || []).reduce(
      (acc, p) => acc + Math.max(Number(p.physAtk) || 0, Number(p.magAtk) || 0, Number(p.atk) || 5),
      0
    );
    const maxGenerousDps = Math.max(50, (playerAtk * 5 + petsAtk * 4) * 4);
    const minPlausibleMs = Math.min(
      30_000,
      Math.max(800, Math.floor((totalMobHp / maxGenerousDps) * 1000))
    );

    if (elapsedMs < minPlausibleMs) {
      return { ok: false, reason: 'Duração de combate incompatível com o HP dos monstros enfrentados.' };
    }

    if (battle.isDungeon && elapsedMs < 1500) {
      return { ok: false, reason: 'Tempo mínimo de conclusão da Dungeon não atingido.' };
    }

    return { ok: true };
  }
}
