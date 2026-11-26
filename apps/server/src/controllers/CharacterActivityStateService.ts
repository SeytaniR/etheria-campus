/**
 * @file apps/server/src/controllers/CharacterActivityStateService.ts
 * @module @etheria/server
 * @description Máquina autoritativa de estado único de atividade do personagem (`EXPLORING` | `COMBAT` | `FISHING`):
 *   - Garante exclusividade mútua entre exploração livre, combate na arena e pesca contínua no servidor.
 *   - Impede transições diretas ilegais (`COMBAT` ⇄ `FISHING`) sem retornar antes ao estado `EXPLORING`.
 *   - Aplica TTL de segurança em estados `COMBAT` abandonados para evitar travamento após quedas abruptas.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 servidor autoritativo, Regra #1 JSDoc, Regra #7 < 1.000 linhas).
 * @dependencies Sem dependências externas (rastreamento autoritativo em memória por `characterId`).
 */

export type CharacterActivityState = 'EXPLORING' | 'COMBAT' | 'FISHING';

interface CharacterActivityEntry {
  state: CharacterActivityState;
  updatedAt: number;
  battleId?: string | null;
}

export type ActivityTransitionResult = { ok: true } | { ok: false; error: string };

export class CharacterActivityStateService {
  private static readonly states = new Map<number, CharacterActivityEntry>();
  private static readonly COMBAT_TTL_MS = 20 * 60 * 1000;

  /**
   * Retorna o estado autoritativo atual do personagem (`EXPLORING` por padrão),
   * expirando automaticamente registros `COMBAT` acima do TTL de segurança.
   */
  public static getState(characterId: number): CharacterActivityState {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return 'EXPLORING';

    const entry = this.states.get(id);
    if (!entry) return 'EXPLORING';

    if (entry.state === 'COMBAT' && Date.now() - entry.updatedAt > this.COMBAT_TTL_MS) {
      this.states.delete(id);
      return 'EXPLORING';
    }
    return entry.state;
  }

  public static isInCombat(characterId: number): boolean {
    return this.getState(characterId) === 'COMBAT';
  }

  public static isFishing(characterId: number): boolean {
    return this.getState(characterId) === 'FISHING';
  }

  /**
   * Tenta transicionar o personagem para `COMBAT` a partir de `EXPLORING` (ou já em `COMBAT`).
   * Bloqueia transição direta a partir de `FISHING`.
   */
  public static enterCombat(characterId: number, battleId?: string | null): ActivityTransitionResult {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return { ok: true };

    if (this.getState(id) === 'FISHING') {
      return { ok: false, error: 'Pare de pescar antes de entrar em combate.' };
    }

    this.states.set(id, {
      state: 'COMBAT',
      updatedAt: Date.now(),
      battleId: battleId ?? null,
    });
    return { ok: true };
  }

  /**
   * Força registro autoritativo do estado `COMBAT` após validações prévias de criação da batalha.
   */
  public static forceEnterCombat(characterId: number, battleId?: string | null): void {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return;

    this.states.set(id, {
      state: 'COMBAT',
      updatedAt: Date.now(),
      battleId: battleId ?? null,
    });
  }

  /**
   * Encerra o estado `COMBAT`, retornando o personagem para `EXPLORING`.
   */
  public static exitCombat(characterId: number, battleId?: string | null): void {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return;

    const entry = this.states.get(id);
    if (!entry || entry.state !== 'COMBAT') return;

    if (!battleId || !entry.battleId || entry.battleId === battleId) {
      this.states.delete(id);
    }
  }

  /**
   * Tenta transicionar o personagem para `FISHING` a partir de `EXPLORING` (ou já em `FISHING`).
   * Bloqueia transição direta a partir de `COMBAT`.
   */
  public static enterFishing(characterId: number): ActivityTransitionResult {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: 'Personagem inválido para iniciar pesca.' };
    }

    if (this.getState(id) === 'COMBAT') {
      return { ok: false, error: 'Não é possível pescar enquanto estiver em combate.' };
    }

    this.states.set(id, {
      state: 'FISHING',
      updatedAt: Date.now(),
      battleId: null,
    });
    return { ok: true };
  }

  /**
   * Encerra o estado `FISHING`, retornando o personagem para `EXPLORING`.
   */
  public static exitFishing(characterId: number): void {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return;

    const entry = this.states.get(id);
    if (entry?.state === 'FISHING') {
      this.states.delete(id);
    }
  }

  /**
   * Reseta completamente o estado de atividade do personagem para `EXPLORING` (respawn/reset).
   */
  public static resetCharacter(characterId: number): void {
    const id = Number(characterId);
    if (!Number.isInteger(id) || id <= 0) return;
    this.states.delete(id);
  }

  /**
   * Limpa o mapa de estados em memória (uso exclusivo em testes automatizados).
   */
  public static clearAllForTests(): void {
    this.states.clear();
  }
}
