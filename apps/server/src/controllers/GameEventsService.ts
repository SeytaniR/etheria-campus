/**
 * @file apps/server/src/controllers/GameEventsService.ts
 * @module @etheria/server
 * @description Serviço Autoritário do Sistema Modular de Eventos (`/play`):
 *   - Realiza seed idempotente dos eventos iniciais (Login 7 Dias em Destaque + Login 30 Dias no Grid).
 *   - Retorna lista separada de Destaques (Carrossel) e Grid de Ícones com progresso individual por personagem.
 *   - Executa check-in manual diário atômico (00:00 BRT) com verificação prévia de mochila cheia e entrega de Ouro/XP/Itens.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Zero Hardcode).
 * @dependencies @prisma/client, @etheria/database (I18nCache), ./CharacterInventoryService.js, ./CharacterProgressionService.js, ./EventDateAndRewardHelper.js
 */

import type { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CharacterProgressionService } from './CharacterProgressionService.js';
import {
  EventDateAndRewardHelper,
  type DailyLoginConfigDto,
  type DailyLoginDayConfig,
} from './EventDateAndRewardHelper.js';

export class GameEventsService {
  private static seededOnce = false;

  /**
   * Garante de forma idempotente que os eventos iniciais (7 dias e 30 dias) existam no banco.
   * Nunca sobrescreve edições feitas pelo administrador caso o evento já exista pelo `code`.
   */
  public static async ensureDefaultEventsSeed(prisma: PrismaClient): Promise<void> {
    if (this.seededOnce) return;

    const existing = await prisma.gameEventTemplate.findMany({
      where: { code: { in: ['daily_login_7d', 'daily_login_30d'] } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((e) => e.code));

    if (!existingCodes.has('daily_login_7d') || !existingCodes.has('daily_login_30d')) {
      const catalogItems = await prisma.itemTemplate.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
        take: 40,
      });

      const pickItem = (categories: string[], offset = 0): number | null => {
        const matches = catalogItems.filter((it) => categories.includes(String(it.itemCategory || '').toUpperCase()));
        if (matches.length > 0) return Number(matches[offset % matches.length].id);
        if (catalogItems.length > 0) return Number(catalogItems[offset % catalogItems.length].id);
        return null;
      };

      const itemSmall = pickItem(['CONSUMABLE', 'MATERIAL'], 0);
      const itemMid = pickItem(['CONSUMABLE', 'MATERIAL', 'FISHING_BAIT'], 1);
      const itemChest = pickItem(['CONTAINER', 'CHEST', 'CONSUMABLE'], 0);

      if (!existingCodes.has('daily_login_7d')) {
        const days7: DailyLoginDayConfig[] = [
          { day: 1, title: 'Dia 1 • Boas-vindas', gold: 250, exp: 300, items: itemSmall ? [{ itemTemplateId: itemSmall, quantity: 3 }] : [] },
          { day: 2, title: 'Dia 2 • Suprimentos', gold: 400, exp: 500, items: itemSmall ? [{ itemTemplateId: itemSmall, quantity: 5 }] : [] },
          { day: 3, title: 'Dia 3 • Treino Rápido', gold: 650, exp: 800, items: itemMid ? [{ itemTemplateId: itemMid, quantity: 3 }] : [] },
          { day: 4, title: 'Dia 4 • Impulso Arcano', gold: 900, exp: 1200, items: itemMid ? [{ itemTemplateId: itemMid, quantity: 5 }] : [] },
          { day: 5, title: 'Dia 5 • Tesouro Médio', gold: 1400, exp: 1800, items: itemSmall ? [{ itemTemplateId: itemSmall, quantity: 8 }] : [] },
          { day: 6, title: 'Dia 6 • Véspera Dourada', gold: 2000, exp: 2600, items: itemMid ? [{ itemTemplateId: itemMid, quantity: 8 }] : [] },
          { day: 7, title: 'Dia 7 • Grande Prêmio', gold: 4500, exp: 5000, items: itemChest ? [{ itemTemplateId: itemChest, quantity: 1 }] : [] },
        ];

        await prisma.gameEventTemplate.create({
          data: {
            code: 'daily_login_7d',
            eventType: 'DAILY_LOGIN',
            titlePtBr: 'Login Seguido — 7 Dias',
            descriptionPtBr: 'Entre no jogo, faça check-in manual por 7 dias acumulados e resgate ouro, XP e suprimentos para a sua jornada.',
            bannerImageUrl: '/play/assets/events/banner_login_7d.png',
            iconImageUrl: '/play/assets/events/icon_login_7d.png',
            isFeatured: true,
            sortOrder: 10,
            isActive: true,
            configJson: { totalDays: 7, days: days7 } as any,
          },
        });
      }

      if (!existingCodes.has('daily_login_30d')) {
        const days30: DailyLoginDayConfig[] = Array.from({ length: 30 }, (_, idx) => {
          const day = idx + 1;
          const isMajor = day % 10 === 0;
          const isMinor = !isMajor && day % 5 === 0;
          const items =
            isMajor && itemChest
              ? [{ itemTemplateId: itemChest, quantity: day === 30 ? 2 : 1 }]
              : isMinor && itemMid
              ? [{ itemTemplateId: itemMid, quantity: 4 }]
              : itemSmall
              ? [{ itemTemplateId: itemSmall, quantity: 2 }]
              : [];
          return {
            day,
            title: isMajor ? `Marco Dia ${day}` : isMinor ? `Bônus Dia ${day}` : `Dia ${day}`,
            gold: Math.round(150 + day * 110 + (isMajor ? 1500 : isMinor ? 400 : 0)),
            exp: Math.round(200 + day * 140 + (isMajor ? 2200 : isMinor ? 600 : 0)),
            items,
          };
        });

        await prisma.gameEventTemplate.create({
          data: {
            code: 'daily_login_30d',
            eventType: 'DAILY_LOGIN',
            titlePtBr: 'Jornada de Login — 30 Dias',
            descriptionPtBr: 'Calendário de 30 dias com marcos especiais a cada 5 dias. Se faltar algum dia, seu avanço fica salvo!',
            bannerImageUrl: '/play/assets/events/banner_login_30d.png',
            iconImageUrl: '/play/assets/events/icon_login_30d.png',
            isFeatured: false,
            sortOrder: 20,
            isActive: true,
            configJson: { totalDays: 30, days: days30 } as any,
          },
        });
      }
    }

    this.seededOnce = true;
  }

  /**
   * Enriquece todos os itens referenciados nas configurações dos eventos com nome e ícone local.
   */
  public static async buildItemLookup(prismaOrTx: any, itemIds: number[]): Promise<Map<number, { id: number; code: string; namePtBr: string; iconUrl: string; rarityTier: string }>> {
    const map = new Map<number, { id: number; code: string; namePtBr: string; iconUrl: string; rarityTier: string }>();
    if (itemIds.length === 0) return map;

    const [items, i18nMap] = await Promise.all([
      prismaOrTx.itemTemplate.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, code: true, nameI18nKey: true, mcreworkIconKey: true, rarityTier: true },
      }),
      I18nCache.getTranslations(prismaOrTx),
    ]);

    for (const it of items) {
      map.set(Number(it.id), {
        id: Number(it.id),
        code: it.code,
        namePtBr: i18nMap.get(it.nameI18nKey) ?? it.code,
        iconUrl: CharacterInventoryService.resolveIconUrl(it.mcreworkIconKey),
        rarityTier: it.rarityTier || 'COMMON',
      });
    }
    return map;
  }

  /**
   * Lista os eventos ativos/vigentes para o jogador `/play`, separados entre Carrossel (`featuredEvents`)
   * e Grid de Ícones (`gridEvents`), com progresso e badge de resgate pendente do personagem.
   */
  public static async getPlayEventsState(prisma: PrismaClient, characterId: number, now: Date = new Date()) {
    await this.ensureDefaultEventsSeed(prisma);

    const safeCharId = Number(characterId);
    const resetInfo = EventDateAndRewardHelper.getBrasiliaNextResetInfo(now);

    const [allEvents, progresses] = await Promise.all([
      prisma.gameEventTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      prisma.characterEventProgress.findMany({
        where: { characterId: safeCharId },
      }),
    ]);

    const activeEvents = allEvents.filter((ev) => EventDateAndRewardHelper.isEventWithinSchedule(ev, now));
    const progressByEventId = new Map<number, any>(progresses.map((p) => [Number(p.eventTemplateId), p]));

    const normalizedConfigs = new Map<number, DailyLoginConfigDto>();
    const referencedItemIds = new Set<number>();

    for (const ev of activeEvents) {
      if (ev.eventType === 'DAILY_LOGIN') {
        const cfg = EventDateAndRewardHelper.normalizeDailyLoginConfig(ev.configJson);
        normalizedConfigs.set(ev.id, cfg);
        for (const day of cfg.days) {
          for (const spec of day.items) {
            if (spec.itemTemplateId > 0) referencedItemIds.add(spec.itemTemplateId);
          }
        }
      }
    }

    const itemLookup = await this.buildItemLookup(prisma, Array.from(referencedItemIds));

    const enrichedEvents = activeEvents.map((ev) => {
      const prog = progressByEventId.get(ev.id) ?? null;
      const cfg = normalizedConfigs.get(ev.id);
      const progressState = cfg
        ? EventDateAndRewardHelper.computeDailyLoginProgressState(cfg, prog, resetInfo.dateKey)
        : null;

      const enrichedDays = progressState
        ? progressState.days.map((d) => ({
            ...d,
            items: d.items.map((spec) => {
              const info = itemLookup.get(spec.itemTemplateId);
              return {
                itemTemplateId: spec.itemTemplateId,
                quantity: spec.quantity,
                namePtBr: info?.namePtBr ?? `Item #${spec.itemTemplateId}`,
                iconUrl: info?.iconUrl ?? '/play/assets/hud/menu_inventory.png',
                rarityTier: info?.rarityTier ?? 'COMMON',
              };
            }),
          }))
        : [];

      return {
        id: ev.id,
        code: ev.code,
        eventType: ev.eventType,
        titlePtBr: ev.titlePtBr,
        descriptionPtBr: ev.descriptionPtBr,
        bannerImageUrl: ev.bannerImageUrl,
        iconImageUrl: ev.iconImageUrl,
        isFeatured: ev.isFeatured,
        sortOrder: ev.sortOrder,
        startsAt: ev.startsAt ? ev.startsAt.toISOString() : null,
        endsAt: ev.endsAt ? ev.endsAt.toISOString() : null,
        hasPendingReward: Boolean(progressState?.canClaimToday),
        progress: progressState
          ? {
              ...progressState,
              days: enrichedDays,
            }
          : null,
      };
    });

    const featuredEvents = enrichedEvents.filter((e) => e.isFeatured);
    const gridEvents = enrichedEvents.filter((e) => !e.isFeatured);
    const pendingCount = enrichedEvents.filter((e) => e.hasPendingReward).length;

    return {
      characterId: safeCharId,
      todayDateKey: resetInfo.dateKey,
      nextResetAtIso: resetInfo.nextResetAtIso,
      secondsUntilReset: resetInfo.secondsUntilReset,
      pendingCount,
      featuredEvents,
      gridEvents,
    };
  }

  /**
   * Efetua check-in manual no dia disponível do evento para o personagem.
   * Valida virada 00:00 BRT, previne duplo resgate e bloqueia com erro caso a mochila esteja cheia sem consumir o dia.
   */
  public static async claimEventReward(
    prisma: PrismaClient,
    characterId: number,
    eventId: number,
    now: Date = new Date()
  ) {
    const safeCharId = Number(characterId);
    const safeEventId = Number(eventId);
    const todayDateKey = EventDateAndRewardHelper.getBrasiliaDateKey(now);

    const event = await prisma.gameEventTemplate.findUnique({ where: { id: safeEventId } });
    if (!event) {
      throw new Error('Evento não encontrado.');
    }
    if (!EventDateAndRewardHelper.isEventWithinSchedule(event, now)) {
      throw new Error('Este evento não está ativo ou está fora do período de vigência.');
    }
    if (event.eventType !== 'DAILY_LOGIN') {
      throw new Error(`Tipo de evento "${event.eventType}" não possui resgate de check-in configurado.`);
    }

    const config = EventDateAndRewardHelper.normalizeDailyLoginConfig(event.configJson);

    const claimOutcome = await prisma.$transaction(async (tx) => {
      const existingProg = await tx.characterEventProgress.findUnique({
        where: { characterId_eventTemplateId: { characterId: safeCharId, eventTemplateId: safeEventId } },
      });

      const state = EventDateAndRewardHelper.computeDailyLoginProgressState(config, existingProg, todayDateKey);
      if (state.isCompleted) {
        throw new Error('Você já concluiu todas as recompensas deste evento!');
      }
      if (state.claimedToday || !state.canClaimToday || state.nextClaimDay === null) {
        throw new Error('Check-in de hoje já realizado! Volte após às 00:00 (Horário de Brasília).');
      }

      const dayConfig = config.days.find((d) => d.day === state.nextClaimDay);
      if (!dayConfig) {
        throw new Error(`Recompensa do Dia ${state.nextClaimDay} não encontrada.`);
      }

      // 1. Verifica capacidade livre na mochila ANTES de consumir o check-in
      if (dayConfig.items.length > 0) {
        const cap = await EventDateAndRewardHelper.checkInventoryCapacityForItems(tx, safeCharId, dayConfig.items);
        if (!cap.fits) {
          throw new Error(
            `Mochila cheia! Libere pelo menos ${cap.missingSlots} espaço(s) na sua mochila antes de resgatar o Dia ${dayConfig.day}.`
          );
        }
      }

      const nextCompleted = dayConfig.day >= config.totalDays;
      const prevHistory = Array.isArray(existingProg?.claimedHistoryJson) ? (existingProg.claimedHistoryJson as any[]) : [];
      const updatedHistory = [
        ...prevHistory,
        {
          day: dayConfig.day,
          dateKey: todayDateKey,
          claimedAt: now.toISOString(),
        },
      ];

      // 2. Lock atômico contra cliques simultâneos (CAS)
      if (existingProg) {
        const cas = await tx.characterEventProgress.updateMany({
          where: {
            id: existingProg.id,
            claimedDaysCount: existingProg.claimedDaysCount,
            isCompleted: false,
            OR: [{ lastClaimDateKey: null }, { lastClaimDateKey: { not: todayDateKey } }],
          },
          data: {
            claimedDaysCount: dayConfig.day,
            lastClaimDateKey: todayDateKey,
            isCompleted: nextCompleted,
            claimedHistoryJson: updatedHistory,
          },
        });
        if (cas.count === 0) {
          throw new Error('Check-in de hoje já foi registrado.');
        }
      } else {
        await tx.characterEventProgress.create({
          data: {
            characterId: safeCharId,
            eventTemplateId: safeEventId,
            claimedDaysCount: dayConfig.day,
            lastClaimDateKey: todayDateKey,
            isCompleted: nextCompleted,
            claimedHistoryJson: updatedHistory,
          },
        });
      }

      // 3. Entrega autoritativa dos prêmios
      const grantedItems: Array<{ itemTemplateId: number; namePtBr: string; quantity: number; iconUrl: string }> = [];
      if (dayConfig.items.length > 0) {
        const itemLookup = await this.buildItemLookup(
          tx,
          dayConfig.items.map((x) => x.itemTemplateId)
        );
        for (const spec of dayConfig.items) {
          const addRes = await CharacterInventoryService.addItem(tx, safeCharId, spec.itemTemplateId, spec.quantity);
          if (addRes.remaining > 0) {
            throw new Error(`Mochila cheia! Não foi possível armazenar todos os itens do Dia ${dayConfig.day}.`);
          }
          const info = itemLookup.get(spec.itemTemplateId);
          grantedItems.push({
            itemTemplateId: spec.itemTemplateId,
            namePtBr: info?.namePtBr ?? `Item #${spec.itemTemplateId}`,
            quantity: spec.quantity,
            iconUrl: info?.iconUrl ?? '/play/assets/hud/menu_inventory.png',
          });
        }
      }

      const newGold = await CharacterInventoryService.addGold(tx, safeCharId, dayConfig.gold);
      const progression =
        dayConfig.exp > 0 ? await CharacterProgressionService.awardCharacterExperience(tx, safeCharId, dayConfig.exp) : null;

      return {
        claimedDay: dayConfig.day,
        dayTitle: dayConfig.title,
        isCompleted: nextCompleted,
        gold: newGold,
        progression,
        rewards: {
          gold: dayConfig.gold,
          exp: dayConfig.exp,
          items: grantedItems,
        },
      };
    });

    const eventsState = await this.getPlayEventsState(prisma, safeCharId, now);
    return {
      ok: true,
      ...claimOutcome,
      eventsState,
    };
  }
}
