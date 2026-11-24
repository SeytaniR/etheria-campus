/**
 * @file packages/database/src/I18nCache.ts
 * @module @etheria/database
 * @description Cache em memória de alta performance com TTL e contexto AsyncLocalStorage
 *   para traduções i18n multi-locale (`pt-BR`, `en-US`, `es-ES`) do PostgreSQL.
 * @rules Evita queries N+1 repetidas no banco em rotas de alta frequência mantendo TTL de 5 minutos,
 *   aplicando fallback em camadas sem mutar registros existentes no banco (Cláusula 0.2).
 * @dependencies @prisma/client, node:async_hooks
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';

export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

export class I18nCache {
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutos
  private static readonly store = new Map<string, { map: Map<string, string>; expiresAt: number }>();
  private static readonly localeStorage = new AsyncLocalStorage<SupportedLocale>();

  /**
   * Normaliza qualquer código de idioma recebido para um dos locales suportados (`pt-BR`, `en-US`, `es-ES`).
   */
  public static normalizeLocale(raw?: string | null): SupportedLocale {
    const cleaned = String(raw || '').trim().replace(/_/g, '-').toLowerCase();
    if (cleaned.startsWith('en')) return 'en-US';
    if (cleaned.startsWith('es')) return 'es-ES';
    return DEFAULT_LOCALE;
  }

  /**
   * Valida se a string de idioma fornecida pertence explicitamente às famílias suportadas (`pt`, `en`, `es`).
   */
  public static isSupportedLocaleInput(raw?: string | null): boolean {
    const cleaned = String(raw || '').trim().replace(/_/g, '-').toLowerCase();
    return cleaned.startsWith('pt') || cleaned.startsWith('en') || cleaned.startsWith('es');
  }

  /**
   * Extrai o melhor locale suportado a partir do cabeçalho HTTP `Accept-Language`.
   */
  public static parseAcceptLanguage(header?: string | null): SupportedLocale {
    const raw = String(header || '').trim();
    if (!raw) return DEFAULT_LOCALE;

    const candidates = raw
      .split(',')
      .map((part) => {
        const [tagPart, ...params] = part.trim().split(';');
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? Number(qParam.trim().slice(2)) : 1.0;
        return {
          tag: (tagPart || '').trim().replace(/_/g, '-').toLowerCase(),
          q: Number.isFinite(q) ? q : 0,
        };
      })
      .filter((c) => c.tag.length > 0 && c.q > 0)
      .sort((a, b) => b.q - a.q);

    for (const c of candidates) {
      if (c.tag.startsWith('pt')) return 'pt-BR';
      if (c.tag.startsWith('en')) return 'en-US';
      if (c.tag.startsWith('es')) return 'es-ES';
    }
    return DEFAULT_LOCALE;
  }

  /**
   * Executa um escopo assíncrono isolado com o locale ativo vinculado à requisição corrente.
   */
  public static runWithLocale<T>(locale: string | null | undefined, fn: () => T): T {
    return this.localeStorage.run(this.normalizeLocale(locale), fn);
  }

  /**
   * Retorna o locale ativo no contexto da requisição corrente ou `pt-BR` fora de requisições.
   */
  public static getCurrentLocale(): SupportedLocale {
    return this.localeStorage.getStore() ?? DEFAULT_LOCALE;
  }

  /**
   * Obtém o dicionário de traduções em memória para o locale solicitado (ou ativo no contexto).
   * Aplica fallback em camadas (`pt-BR` base -> `en` legado -> `en-US`, ou `pt-BR` -> `es-ES`)
   * em uma única consulta ao PostgreSQL sem modificar linhas legadas (Cláusula 0.2).
   */
  public static async getTranslations(prisma: PrismaClient, locale?: string): Promise<Map<string, string>> {
    const targetLocale = locale ? this.normalizeLocale(locale) : this.getCurrentLocale();
    const now = Date.now();
    const cached = this.store.get(targetLocale);
    if (cached && cached.expiresAt > now) {
      return cached.map;
    }

    const layers: string[] =
      targetLocale === 'en-US'
        ? ['pt-BR', 'en', 'en-US']
        : targetLocale === 'es-ES'
        ? ['pt-BR', 'es-ES']
        : ['pt-BR'];

    const rows = await prisma.i18nTranslation.findMany({
      where: { locale: { in: layers } },
    });

    const byLayer = new Map<string, Array<{ key: string; text: string }>>();
    for (const layer of layers) {
      byLayer.set(layer, []);
    }
    for (const r of rows) {
      const bucket = byLayer.get(r.locale);
      if (bucket) {
        bucket.push({ key: r.key, text: r.text });
      }
    }

    const map = new Map<string, string>();
    for (const layer of layers) {
      const entries = byLayer.get(layer) ?? [];
      for (const entry of entries) {
        map.set(entry.key, entry.text);
      }
    }

    this.store.set(targetLocale, {
      map,
      expiresAt: now + this.TTL_MS,
    });

    return map;
  }

  /**
   * Invalida o cache para forçar recarga imediata na próxima consulta.
   */
  public static invalidate(locale?: string): void {
    if (!locale || this.normalizeLocale(locale) === DEFAULT_LOCALE) {
      this.store.clear();
      return;
    }
    this.store.delete(this.normalizeLocale(locale));
  }
}
