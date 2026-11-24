/**
 * @file apps/server/src/security/InputSanitizer.ts
 * @module @etheria/server/security/InputSanitizer
 * @description Validação estrita de identificadores de jogador/conta e sanitização de erros HTTP.
 * @rules
 *   - Impede Stored XSS via nomes de personagens e usernames com caracteres HTML/script (`< > " ' / \ ; &`).
 *   - Impede vazamento de mensagens internas do Prisma/PostgreSQL em respostas HTTP 500.
 * @dependencies Nenhuma dependência externa (puro TypeScript).
 */

export interface SanitizedHttpError {
  statusCode: number;
  message: string;
}

export class InputSanitizer {
  private static readonly CHARACTER_NAME_REGEX = /^[\p{L}\p{N}_\- ]+$/u;
  private static readonly USERNAME_REGEX = /^[a-zA-Z0-9._\-]+$/;

  /**
   * Valida e normaliza o nome de personagem durante a criação, bloqueando qualquer payload HTML/XSS.
   */
  public static validateCharacterName(raw: string): string {
    const clean = String(raw ?? '').trim();
    if (clean.length < 2 || clean.length > 24) {
      throw new Error('O nome do personagem deve ter entre 2 e 24 caracteres.');
    }
    if (!this.CHARACTER_NAME_REGEX.test(clean)) {
      throw new Error('O nome do personagem aceita apenas letras, números, espaços, hífen (-) e sublinhado (_).');
    }
    return clean;
  }

  /**
   * Valida e normaliza o username de contas administrativas ou de jogadores.
   */
  public static validateUsername(raw: string): string {
    const clean = String(raw ?? '').trim();
    if (clean.length < 3 || clean.length > 32) {
      throw new Error('O nome de usuário deve ter entre 3 e 32 caracteres.');
    }
    if (!this.USERNAME_REGEX.test(clean)) {
      throw new Error('O nome de usuário aceita apenas letras, números, ponto (.), hífen (-) e sublinhado (_).');
    }
    return clean;
  }

  /**
   * Converte exceções desconhecidas em respostas HTTP seguras sem expor detalhes do PostgreSQL ou Prisma.
   */
  public static sanitizeHttpError(err: unknown): SanitizedHttpError {
    const anyErr = err as { name?: string; code?: string; message?: string } | null;
    const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
    const lower = msg.toLowerCase();

    if (lower.includes('acesso negado') || lower.includes('não autorizado')) {
      return { statusCode: 403, message: msg };
    }

    const name = String(anyErr?.name || '');
    const code = String(anyErr?.code || '');
    const isInfraOrPrisma =
      name.includes('Prisma') ||
      code.startsWith('P1') ||
      code.startsWith('P2') ||
      code === 'ECONNREFUSED' ||
      lower.includes('invalid `prisma.');

    if (isInfraOrPrisma) {
      return {
        statusCode: 500,
        message: 'Erro interno ao processar requisição.',
      };
    }

    return {
      statusCode: 400,
      message: msg || 'Erro ao processar requisição.',
    };
  }
}
