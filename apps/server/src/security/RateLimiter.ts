/**
 * @file apps/server/src/security/RateLimiter.ts
 * @module @etheria/server/security/RateLimiter
 * @description Limitador de taxa (Rate Limiter) em memória por chave e janela fixa para endpoints críticos.
 * @rules
 *   - Protege rotas de autenticação (`/auth/login`) contra ataques de força bruta.
 *   - Protege rotas de alta frequência (`/chat/send`, encontros) contra spam e DoS.
 *   - Executa limpeza periódica de janelas expiradas sem bloquear o encerramento do processo (`unref()`).
 * @dependencies node:http
 */

import type * as http from 'node:http';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor() {
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        if (now >= bucket.resetAt) {
          this.buckets.delete(key);
        }
      }
    }, 2 * 60 * 1000);
    cleanupTimer.unref();
  }

  /**
   * Extrai o endereço IP do cliente respeitando proxies reversos confiáveis (Caddy/Nginx/Cloudflare).
   */
  public static getClientIp(req: http.IncomingMessage): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim().length > 0) {
      return xff.split(',')[0].trim();
    }
    if (Array.isArray(xff) && xff.length > 0) {
      return String(xff[0]).split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim().length > 0) {
      return realIp.trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Consome uma unidade da cota para a chave informada dentro da janela especificada.
   */
  public consume(key: string, maxRequests: number, windowMs: number): RateLimitDecision {
    const now = Date.now();
    const limit = Math.max(1, Math.round(maxRequests));
    const windowDuration = Math.max(1000, Math.round(windowMs));

    const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowDuration });
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        retryAfterSec: 0,
      };
    }

    if (current.count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, limit - current.count),
      retryAfterSec: 0,
    };
  }
}
