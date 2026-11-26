/**
 * @file apps/server/src/controllers/EventDateAndRewardHelper.ts
 * @module @etheria/server
 * @description Helpers puros para datas/virada 00:00 no Horário de Brasília (America/Sao_Paulo),
 *   vigência de eventos, normalização do config de Login Diário, validação de assets locais
 *   e verificação prévia de capacidade livre na mochila antes do resgate.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Regra #10 Zero URLs externas).
 * @dependencies ./CharacterInventoryService.js
 */

import { CharacterInventoryService, INVENTORY_CONFIG } from './CharacterInventoryService.js';

export interface EventRewardItemSpec {
  itemTemplateId: number;
  quantity: number;
}

export interface DailyLoginDayConfig {
  day: number;
  title: string;
  gold: number;
  exp: number;
  items: EventRewardItemSpec[];
}

export interface DailyLoginConfigDto {
  totalDays: number;
  days: DailyLoginDayConfig[];
}

export type DailyLoginDayStatus = 'CLAIMED' | 'AVAILABLE' | 'LOCKED';

export interface DailyLoginDayState extends DailyLoginDayConfig {
  status: DailyLoginDayStatus;
}

export interface DailyLoginProgressState {
  claimedDaysCount: number;
  totalDays: number;
  isCompleted: boolean;
  claimedToday: boolean;
  canClaimToday: boolean;
  nextClaimDay: number | null;
  lastClaimDateKey: string | null;
  days: DailyLoginDayState[];
}

export interface InventoryCapacityCheckResult {
  fits: boolean;
  requiredNewSlots: number;
  freeSlots: number;
  missingSlots: number;
}

const BRT_TIMEZONE = 'America/Sao_Paulo';
const BRT_FIXED_OFFSET_MS = 3 * 60 * 60 * 1000;

export class EventDateAndRewardHelper {
  /**
   * Retorna a chave civil YYYY-MM-DD corrente no fuso America/Sao_Paulo (virada às 00:00 BRT).
   */
  public static getBrasiliaDateKey(now: Date = new Date()): string {
    try {
      const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: BRT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
        return formatted;
      }
    } catch {
      // Fallback determinístico UTC-3 caso runtime não possua dados ICU completos
    }
    const shifted = new Date(now.getTime() - BRT_FIXED_OFFSET_MS);
    return shifted.toISOString().slice(0, 10);
  }

  /**
   * Calcula o instante exato da próxima virada às 00:00:00 em Brasília e segundos restantes.
   */
  public static getBrasiliaNextResetInfo(now: Date = new Date()): {
    dateKey: string;
    nextResetAtIso: string;
    secondsUntilReset: number;
  } {
    const dateKey = this.getBrasiliaDateKey(now);
    const [yStr, mStr, dStr] = dateKey.split('-');
    const todayBrtMidnightAsUtc = Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr), 3, 0, 0, 0);
    let nextResetMs = todayBrtMidnightAsUtc + 24 * 60 * 60 * 1000;
    if (now.getTime() >= nextResetMs) {
      nextResetMs += 24 * 60 * 60 * 1000;
    }
    return {
      dateKey,
      nextResetAtIso: new Date(nextResetMs).toISOString(),
      secondsUntilReset: Math.max(0, Math.floor((nextResetMs - now.getTime()) / 1000)),
    };
  }

  /**
   * Verifica se o evento está ativo e dentro da janela de vigência configurada.
   */
  public static isEventWithinSchedule(
    ev: { isActive: boolean; startsAt: Date | string | null; endsAt: Date | string | null },
    now: Date = new Date()
  ): boolean {
    if (!ev.isActive) return false;
    const nowMs = now.getTime();
    if (ev.startsAt) {
      const start = new Date(ev.startsAt);
      if (!Number.isNaN(start.getTime()) && nowMs < start.getTime()) return false;
    }
    if (ev.endsAt) {
      const end = new Date(ev.endsAt);
      if (!Number.isNaN(end.getTime()) && nowMs > end.getTime()) return false;
    }
    return true;
  }

  /**
   * Retorna o rótulo de estado da vigência para exibição no painel /admin.
   */
  public static getEventScheduleStatus(
    ev: { isActive: boolean; startsAt: Date | string | null; endsAt: Date | string | null },
    now: Date = new Date()
  ): 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE' {
    if (!ev.isActive) return 'INACTIVE';
    const nowMs = now.getTime();
    if (ev.startsAt) {
      const start = new Date(ev.startsAt);
      if (!Number.isNaN(start.getTime()) && nowMs < start.getTime()) return 'SCHEDULED';
    }
    if (ev.endsAt) {
      const end = new Date(ev.endsAt);
      if (!Number.isNaN(end.getTime()) && nowMs > end.getTime()) return 'EXPIRED';
    }
    return 'ACTIVE';
  }

  /**
   * Valida e normaliza caminhos de imagens locais do mesmo domínio (Regra #10).
   */
  public static validateLocalEventAssetUrl(url: string | null | undefined): string {
    const cleaned = String(url ?? '').trim();
    if (!cleaned) return '';
    const lower = cleaned.toLowerCase();
    if (
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('//') ||
      lower.startsWith('data:') ||
      lower.startsWith('javascript:') ||
      cleaned.includes('..') ||
      cleaned.includes('\\')
    ) {
      throw new Error('URLs externas ou relativas inválidas não são permitidas. Use um asset hospedado localmente sob /play/assets/ ou faça upload no Admin.');
    }
    const allowedPrefixes = ['/play/assets/', '/assets/', '/api/assets/mcrework/'];
    if (!allowedPrefixes.some((p) => cleaned.startsWith(p))) {
      throw new Error('O caminho de imagem do evento deve iniciar com /play/assets/, /assets/ ou /api/assets/mcrework/.');
    }
    return cleaned;
  }

  /**
   * Normaliza o JSON de configuração de dias do evento DAILY_LOGIN (1..60 dias).
   */
  public static normalizeDailyLoginConfig(raw: any): DailyLoginConfigDto {
    const src = raw && typeof raw === 'object' ? raw : {};
    const rawDaysList = Array.isArray(src.days) ? src.days : [];
    const totalDays = Math.min(60, Math.max(1, Math.round(Number(src.totalDays) || rawDaysList.length || 7)));

    const byDay = new Map<number, DailyLoginDayConfig>();
    for (const entry of rawDaysList) {
      if (!entry || typeof entry !== 'object') continue;
      const d = Math.round(Number(entry.day) || 0);
      if (d < 1 || d > totalDays) continue;

      const mergedItems = new Map<number, number>();
      if (Array.isArray(entry.items)) {
        for (const it of entry.items) {
          const itemTemplateId = Math.round(Number(it?.itemTemplateId) || 0);
          const qty = Math.min(999, Math.max(0, Math.round(Number(it?.quantity) || 0)));
          if (itemTemplateId > 0 && qty > 0) {
            mergedItems.set(itemTemplateId, (mergedItems.get(itemTemplateId) || 0) + qty);
          }
        }
      }

      byDay.set(d, {
        day: d,
        title: String(entry.title ?? `Dia ${d}`).trim().slice(0, 60) || `Dia ${d}`,
        gold: Math.max(0, Math.round(Number(entry.gold) || 0)),
        exp: Math.max(0, Math.round(Number(entry.exp) || 0)),
        items: Array.from(mergedItems.entries()).map(([itemTemplateId, quantity]) => ({ itemTemplateId, quantity })),
      });
    }

    const days: DailyLoginDayConfig[] = [];
    for (let d = 1; d <= totalDays; d++) {
      days.push(
        byDay.get(d) ?? {
          day: d,
          title: `Dia ${d}`,
          gold: d * 100,
          exp: d * 150,
          items: [],
        }
      );
    }

    return { totalDays, days };
  }

  /**
   * Calcula o estado de progresso diário de um personagem:
   * - Acumulativo sem reset se faltar um dia.
   * - Não reinicia ao completar o último dia.
   */
  public static computeDailyLoginProgressState(
    config: DailyLoginConfigDto,
    progress: { claimedDaysCount?: number | null; lastClaimDateKey?: string | null; isCompleted?: boolean | null } | null | undefined,
    todayDateKey: string
  ): DailyLoginProgressState {
    const totalDays = config.totalDays;
    const claimedDaysCount = Math.max(0, Math.min(totalDays, Math.round(Number(progress?.claimedDaysCount || 0))));
    const isCompleted = Boolean(progress?.isCompleted) || claimedDaysCount >= totalDays;
    const lastClaimDateKey = progress?.lastClaimDateKey ? String(progress.lastClaimDateKey) : null;
    const claimedToday = !isCompleted && lastClaimDateKey === todayDateKey;
    const canClaimToday = !isCompleted && !claimedToday;
    const nextClaimDay = canClaimToday ? claimedDaysCount + 1 : null;

    const days: DailyLoginDayState[] = config.days.map((d) => {
      let status: DailyLoginDayStatus = 'LOCKED';
      if (d.day <= claimedDaysCount) {
        status = 'CLAIMED';
      } else if (canClaimToday && d.day === claimedDaysCount + 1) {
        status = 'AVAILABLE';
      }
      return { ...d, status };
    });

    return {
      claimedDaysCount,
      totalDays,
      isCompleted,
      claimedToday,
      canClaimToday,
      nextClaimDay,
      lastClaimDateKey,
      days,
    };
  }

  /**
   * Verifica antecipadamente se a mochila do personagem comporta todos os itens da recompensa,
   * considerando stacks existentes (999) e itens não-acumuláveis (stack = 1).
   */
  public static async checkInventoryCapacityForItems(
    prismaOrTx: any,
    characterId: number,
    items: EventRewardItemSpec[]
  ): Promise<InventoryCapacityCheckResult> {
    if (!Array.isArray(items) || items.length === 0) {
      return { fits: true, requiredNewSlots: 0, freeSlots: INVENTORY_CONFIG.DEFAULT_UNLOCKED_SLOTS, missingSlots: 0 };
    }

    const unlockedCount = CharacterInventoryService.getUnlockedSlotsCount(characterId);
    const existingRows = await prismaOrTx.characterInventoryItem.findMany({
      where: {
        characterId: Number(characterId),
        slotIndex: { lt: unlockedCount },
        quantity: { gt: 0 },
      },
      select: { slotIndex: true, itemTemplateId: true, quantity: true },
    });

    const freeSlots = Math.max(0, unlockedCount - existingRows.length);
    const itemIds = Array.from(new Set(items.map((x) => Number(x.itemTemplateId)).filter((id) => id > 0)));
    if (itemIds.length === 0) {
      return { fits: true, requiredNewSlots: 0, freeSlots, missingSlots: 0 };
    }

    const templates = await prismaOrTx.itemTemplate.findMany({
      where: { id: { in: itemIds } },
    });
    const tplMap = new Map<number, any>(templates.map((t: any) => [Number(t.id), t]));

    const remainingSpaceByItem = new Map<number, number>();
    for (const r of existingRows) {
      const tpl = tplMap.get(Number(r.itemTemplateId));
      if (!tpl || CharacterInventoryService.isNonStackable(tpl)) continue;
      const room = Math.max(0, INVENTORY_CONFIG.MAX_STACK_DEFAULT - (Number(r.quantity) || 0));
      remainingSpaceByItem.set(Number(r.itemTemplateId), (remainingSpaceByItem.get(Number(r.itemTemplateId)) || 0) + room);
    }

    let requiredNewSlots = 0;
    for (const spec of items) {
      const itemId = Number(spec.itemTemplateId);
      const qty = Math.max(0, Math.round(Number(spec.quantity) || 0));
      if (itemId <= 0 || qty <= 0) continue;

      const tpl = tplMap.get(itemId);
      if (!tpl) {
        throw new Error(`Item de recompensa #${itemId} não encontrado no catálogo.`);
      }

      if (CharacterInventoryService.isNonStackable(tpl)) {
        requiredNewSlots += qty;
      } else {
        const currentRoom = remainingSpaceByItem.get(itemId) || 0;
        if (qty <= currentRoom) {
          remainingSpaceByItem.set(itemId, currentRoom - qty);
        } else {
          const overflow = qty - currentRoom;
          remainingSpaceByItem.set(itemId, 0);
          const newSlots = Math.ceil(overflow / INVENTORY_CONFIG.MAX_STACK_DEFAULT);
          requiredNewSlots += newSlots;
          const leftoverRoom = newSlots * INVENTORY_CONFIG.MAX_STACK_DEFAULT - overflow;
          remainingSpaceByItem.set(itemId, leftoverRoom);
        }
      }
    }

    const fits = requiredNewSlots <= freeSlots;
    return {
      fits,
      requiredNewSlots,
      freeSlots,
      missingSlots: Math.max(0, requiredNewSlots - freeSlots),
    };
  }
}
