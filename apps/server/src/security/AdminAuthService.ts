/**
 * @file apps/server/src/security/AdminAuthService.ts
 * @module @etheria/server
 * @description Serviço Orientado a Objetos de Autenticação e Autorização da Rota `/admin`.
 * @rules
 *   1. Acesso via `.env` (ADMIN_LOCAL_USERNAME / ADMIN_LOCAL_PASSWORD) SÓ funciona se a requisição
 *      vier estritamente do `localhost` (loopback direto, sem cabeçalhos de proxy/túnel e Host localhost/127.0.0.1).
 *   2. Qualquer acesso fora do `localhost` (LAN Wi-Fi, Celular, Cloudflare Tunnel, VPS) bloqueia o login `.env`
 *      e exige obrigatoriamente uma conta com `role = 'ADMIN'` cadastrada no CRUD do banco PostgreSQL.
 *   3. Senhas do banco utilizam derivação criptográfica `crypto.scryptSync` com salt aleatório e comparação `timingSafeEqual`.
 * @dependencies node:crypto, node:http, @etheria/database
 */

import * as crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { PrismaClient } from '@etheria/database';

export interface AdminTokenPayload {
  sub: string;
  username: string;
  role: string;
  authSource: 'LOCAL_ENV' | 'DATABASE_CRUD';
  exp: number;
}

export class AdminAuthService {
  private readonly prisma: PrismaClient;
  private readonly localUsername: string;
  private readonly localPassword: string;
  private readonly sessionSecret: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.localUsername = process.env.ADMIN_LOCAL_USERNAME ?? 'admin';
    this.localPassword = process.env.ADMIN_LOCAL_PASSWORD ?? '';
    this.sessionSecret = process.env.ADMIN_SESSION_SECRET ?? crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verifica de forma estrita se a requisição HTTP partiu genuinamente da própria máquina (localhost),
   * rejeitando qualquer conexão via IP de rede local (192.168.x.x), proxy reverso ou túnel externo.
   */
  public isStrictLocalhost(req: IncomingMessage): boolean {
    const remoteAddr = req.socket?.remoteAddress ?? '';
    const isLoopbackSocket =
      remoteAddr === '127.0.0.1' ||
      remoteAddr === '::1' ||
      remoteAddr === '::ffff:127.0.0.1';

    if (!isLoopbackSocket) {
      return false;
    }

    // Se existir qualquer cabeçalho de proxy/túnel (Nginx, Cloudflare Tunnel, etc.), NÃO é localhost direto!
    const proxyHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip',
      'true-client-ip',
      'forwarded',
      'x-forwarded-host',
    ];
    for (const h of proxyHeaders) {
      if (req.headers[h]) {
        return false;
      }
    }

    // O Host da requisição também deve ser explicitamente localhost ou 127.0.0.1
    const hostHeader = (req.headers.host ?? '').toLowerCase();
    const hostname = hostHeader.split(':')[0];
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  /**
   * Gera hash seguro de senha com salt usando scrypt nativo do Node.js.
   */
  public static hashPassword(plainPassword: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  /**
   * Verifica uma senha em texto plano contra o hash `salt:derived` salvo no PostgreSQL.
   */
  public static verifyPassword(plainPassword: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(plainPassword, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  }

  /**
   * Realiza a autenticação do usuário tentando acessar o `/admin`.
   * - Se estiver no localhost: aceita tanto a senha do `.env` quanto contas ADMIN do banco.
   * - Se estiver fora do localhost: bloqueia a senha do `.env` e aceita somente contas ADMIN do banco.
   */
  public async authenticate(
    req: IncomingMessage,
    username: string,
    password: string
  ): Promise<{ success: boolean; token?: string; payload?: AdminTokenPayload; error?: string }> {
    const isLocal = this.isStrictLocalhost(req);

    // 1. Tentativa via credenciais do .env (SOMENTE no localhost estrito)
    if (
      this.localPassword.length > 0 &&
      username === this.localUsername &&
      password === this.localPassword
    ) {
      if (!isLocal) {
        return {
          success: false,
          error: 'Acesso negado: A senha do arquivo .env só é permitida diretamente no localhost. Use uma conta cadastrada no CRUD de Administradores.',
        };
      }

      const payload: AdminTokenPayload = {
        sub: 'env-local-admin',
        username: this.localUsername,
        role: 'ADMIN',
        authSource: 'LOCAL_ENV',
        exp: Date.now() + 12 * 60 * 60 * 1000, // 12 horas
      };
      return { success: true, token: this.signToken(payload), payload };
    }

    // 2. Tentativa via Conta de Usuário cadastrada no CRUD do PostgreSQL
    const account = await this.prisma.userAccount.findUnique({
      where: { username },
    });

    if (!account || !AdminAuthService.verifyPassword(password, account.passwordHash)) {
      return {
        success: false,
        error: isLocal
          ? 'Usuário ou senha inválidos (verifique o .env ou o CRUD do banco).'
          : 'Usuário ou senha inválidos no banco de dados.',
      };
    }

    if (account.role !== 'ADMIN') {
      return {
        success: false,
        error: `A conta "${account.username}" possui cargo "${account.role}", mas a rota /admin exige cargo "ADMIN".`,
      };
    }

    const payload: AdminTokenPayload = {
      sub: String(account.id),
      username: account.username,
      role: account.role,
      authSource: 'DATABASE_CRUD',
      exp: Date.now() + 12 * 60 * 60 * 1000,
    };

    return { success: true, token: this.signToken(payload), payload };
  }

  /**
   * Assina um token de sessão Admin usando HMAC-SHA256.
   */
  public signToken(payload: AdminTokenPayload): string {
    const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(data)
      .digest('base64url');
    return `${data}.${signature}`;
  }

  /**
   * Valida o token Bearer da requisição e garante que tokens `LOCAL_ENV` nunca sejam usados fora do localhost.
   */
  public verifyRequestToken(req: IncomingMessage): AdminTokenPayload | null {
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(data)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as AdminTokenPayload;
      if (Date.now() > payload.exp) return null;
      if (payload.role !== 'ADMIN') return null;

      // Trava extra: Um token gerado pelo .env NUNCA pode ser usado se a requisição atual não for localhost!
      if (payload.authSource === 'LOCAL_ENV' && !this.isStrictLocalhost(req)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}
