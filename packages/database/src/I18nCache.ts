/**
 * @file packages/database/src/I18nCache.ts
 * @module @etheria/database
 * @description Cache em memória de alta performance com TTL para traduções i18n do PostgreSQL.
 * @rules Evita queries N+1 repetidas no banco em rotas de alta frequência mantendo TTL de 5 minutos.
 * @dependencies @prisma/client
 */

import type { PrismaClient } from '@prisma/client';

export class I18nCache {
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutos
  private static readonly store = new Map<string, { map: Map<string, string>; expiresAt: number }>();

  /**
   * Obtém o dicionário de traduções em memória para o locale solicitado.
   * Se expirado ou ausente, busca do PostgreSQL e renova o cache.
   */
  public static async getTranslations(prisma: PrismaClient, locale: string = 'pt-BR'): Promise<Map<string, string>> {
    const now = Date.now();
    const cached = this.store.get(locale);
    if (cached && cached.expiresAt > now) {
      return cached.map;
    }

    const rows = await prisma.i18nTranslation.findMany({
      where: { locale },
    });

    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.text);
    }

    this.store.set(locale, {
      map,
      expiresAt: now + this.TTL_MS,
    });

    return map;
  }

  /**
   * Invalida o cache para forçar recarga imediata na próxima consulta.
   */
  public static invalidate(locale?: string): void {
    if (locale) {
      this.store.delete(locale);
    } else {
      this.store.clear();
    }
  }
}
