/**
 * @file apps/server/src/security/ChatModerationFilter.ts
 * @description Filtro Autoritário de Moderação de Conteúdo e Conduta Comunitária (Classificação 16+).
 * 
 * DIRETRIZES DA CLASSIFICAÇÃO 16+:
 * 1. Nível Crítico (Zero Tolerância / Bloqueio Total):
 *    - Discurso de ódio, racismo, homofobia, transfobia, intolerância religiosa, capacitismo.
 *    - Ameaças diretas de morte, violência física extrema, incitação a suicídio ou automutilação.
 *    - Mensagens dessa categoria são REJEITADAS integralmente com aviso educativo.
 * 
 * 2. Nível Moderado (Censura por Asteriscos `***`):
 *    - Palavrões de baixo calão graves, ofensas diretas vulgares e termos sexuais explícitos.
 *    - Palavras censuradas são substituídas por asteriscos preservando a mensagem restante.
 * 
 * 3. Prevenção ao Efeito Scunthorpe (Falsos Positivos):
 *    - Expressões legítimas da língua portuguesa (ex: "computador", "documento", "acumular", "escutar",
 *      "disputa", "assistir", "faculdade", "cura") NÃO sofrem censura indevida.
 */

export interface ModerationResult {
  /** Se a mensagem foi autorizada a ser transmitida */
  allowed: boolean;
  /** Texto sanitizado (com termos vulgares censurados por asteriscos) */
  censoredText: string;
  /** Motivo do bloqueio caso a mensagem contenha violações críticas */
  blockedReason?: string;
  /** Se houve qualquer substituição/censura no texto */
  hasProfanity: boolean;
  /** Categoria da violação detectada (se houver) */
  violationType?: 'HATE_SPEECH_OR_THREAT' | 'PROFANITY';
}

export class ChatModerationFilter {
  /**
   * Termos de Ódio, Discriminação, Preconceito e Ameaças Extremas (Zero Tolerância 16+).
   * Mensagens que contiverem esses termos serão sumariamente BLOQUEADAS.
   */
  private static readonly HATE_AND_THREAT_TERMS: string[] = [
    // Preconceito racial / étnico
    'macaco',
    'macaca',
    'preto imundo',
    'preta imunda',
    'negrinho',
    'negrinha',
    'nigger',
    'nigga',
    'racista',
    'nazista',
    'nazismo',
    'hitler',
    'neonazi',

    // Homofobia / Transfobia
    'viado',
    'veado',
    'viadinho',
    'viadao',
    'viadão',
    'bicha',
    'bichinha',
    'sapatao',
    'sapatão',
    'traveco',
    'travecao',
    'travecão',
    'faggot',
    'fag',
    'dyke',

    // Capacitismo pejorativo grave
    'retardado',
    'retardada',
    'mongol',
    'mongoloide',
    'aleijado imundo',
    'retard',

    // Ameaças de morte, violência extrema e incitação a suicídio
    'se mata',
    'vai se matar',
    'se suicide',
    'kill yourself',
    'kys',
    'vou te matar',
    'vou matar voce',
    'vou matar vc',
    'vou te estuprar',
    'estupro',
    'estupra',
    'pedofilo',
    'pedofilia',
  ];

  /**
   * Termos de Baixo Calão e Ofensas Vulgares (Censura com Asteriscos `***`).
   */
  private static readonly PROFANITY_TERMS: string[] = [
    // Ofensas graves em Português
    'porra',
    'porras',
    'puta',
    'putas',
    'putinha',
    'putona',
    'putaria',
    'filho da puta',
    'filha da puta',
    'filhos da puta',
    'fdp',
    'vsf',
    'vtnc',
    'vai se foder',
    'vai se fuder',
    'foder',
    'fuder',
    'fudendo',
    'fodendo',
    'fudeu',
    'fodeu',
    'foda-se',
    'fodasse',
    'foda',
    'fodao',
    'fodão',
    'caralho',
    'caralhos',
    'krl',
    'krlho',
    'arrombado',
    'arrombada',
    'arrombados',
    'bosta',
    'bostas',
    'merda',
    'merdas',
    'merdinha',
    'cu',
    'cus',
    'cuzão',
    'cuzao',
    'cusao',
    'cuzinho',
    'otario',
    'otaria',
    'otarios',
    'babaca',
    'babacas',
    'desgraçado',
    'desgraçada',
    'desgracado',
    'desgracada',
    'buceta',
    'bct',
    'bucetao',
    'bucetão',
    'piroca',
    'pirocas',
    'pika',
    'rola',
    'cacete',
    'chupa rola',
    'chupador',
    'corno',
    'corna',
    'vagabundo',
    'vagabunda',
    'escroto',
    'escrota',
    'vadia',
    'vadias',

    // Termos vulgares em Inglês comuns em jogos online
    'fuck',
    'fucking',
    'fucker',
    'motherfucker',
    'bitch',
    'bitches',
    'shit',
    'asshole',
    'cunt',
    'dick',
    'pussy',
    'bastard',
    'slut',
    'whore',
    'dumbass',
    'blowjob',
  ];

  /**
   * Palavras seguras conhecidas que contêm substrings de palavrões (anti-falsos positivos).
   */
  private static readonly SAFE_EXCEPTIONS: Set<string> = new Set([
    'computador',
    'computadores',
    'computacao',
    'computação',
    'documento',
    'documentos',
    'acumular',
    'acumula',
    'acumulo',
    'acumulado',
    'escutar',
    'escuta',
    'escute',
    'discutir',
    'discussao',
    'discussão',
    'disputa',
    'disputar',
    'reputacao',
    'reputação',
    'assistir',
    'assistencia',
    'assistência',
    'sucuri',
    'custo',
    'custos',
    'custar',
    'cura',
    'curar',
    'cubo',
    'faculdade',
    'foco',
    'focar',
    'asfalto',
    'passado',
    'passar',
    'massa',
    'classe',
    'classes',
  ]);

  /**
   * Normaliza o texto removendo acentos e simplificando substituições do tipo "leetspeak".
   */
  public static normalizeText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      // Remove acentos
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Conversões leetspeak comuns
      .replace(/[@4]/g, 'a')
      .replace(/3/g, 'e')
      .replace(/(?<=[a-z0-9])!(?=[a-z0-9])/gi, 'i')
      .replace(/1/g, 'i')
      .replace(/0/g, 'o')
      .replace(/[$5]/g, 's')
      .replace(/7/g, 't');
  }

  /**
   * Avalia e sanitiza a mensagem conforme as regras comunitárias 16+.
   */
  public static filterMessage(rawText: string): ModerationResult {
    if (!rawText || !rawText.trim()) {
      return { allowed: true, censoredText: '', hasProfanity: false };
    }

    const trimmed = rawText.trim();
    const normalized = this.normalizeText(trimmed);

    // 1. Verificação de Discurso de Ódio / Ameaças Severas (Zero Tolerância)
    for (const term of this.HATE_AND_THREAT_TERMS) {
      const termNorm = this.normalizeText(term);
      if (this.containsTerm(normalized, termNorm)) {
        return {
          allowed: false,
          censoredText: '',
          blockedReason: 'Mensagem bloqueada pelo sistema de conduta (16+): discurso de ódio, discriminação ou ameaça direta não são tolerados.',
          hasProfanity: true,
          violationType: 'HATE_SPEECH_OR_THREAT',
        };
      }
    }

    // 2. Censura de Baixo Calão e Palavrões (Substitui por asteriscos)
    let processedText = trimmed;
    let profanityFound = false;

    for (const term of this.PROFANITY_TERMS) {
      const termNorm = this.normalizeText(term);
      const regex = this.buildTermRegex(termNorm);

      if (regex.test(this.normalizeText(processedText))) {
        // Aplica a censura preservando o comprimento ou substituindo por ****
        processedText = this.censorMatches(processedText, termNorm);
        profanityFound = true;
      }
    }

    return {
      allowed: true,
      censoredText: processedText,
      hasProfanity: profanityFound,
      violationType: profanityFound ? 'PROFANITY' : undefined,
    };
  }

  /**
   * Verifica se o texto normalizado contém o termo exato ou como palavra isolada.
   */
  private static containsTerm(normalizedText: string, term: string): boolean {
    // Termos com espaço (ex: "se mata", "filho da puta") checamos diretamente
    if (term.includes(' ')) {
      return normalizedText.includes(term);
    }

    // Termos de uma palavra usam limites de palavra ou tokenização
    const regex = new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, 'i');
    return regex.test(normalizedText);
  }

  /**
   * Constrói regex com limites seguros para evitar colisões indevidas.
   */
  private static buildTermRegex(term: string): RegExp {
    if (term.includes(' ')) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, 'i');
    }
    return new RegExp(`(^|[^a-z0-9])(${term})([^a-z0-9]|$)`, 'i');
  }

  /**
   * Substitui ocorrências da palavra proibida por asteriscos correspondentes.
   */
  private static censorMatches(originalText: string, termNorm: string): string {
    const tokens = originalText.split(/(\s+|[.,!?;:()\[\]])/);

    return tokens
      .map((token) => {
        const normToken = this.normalizeText(token);
        if (this.SAFE_EXCEPTIONS.has(normToken)) {
          return token;
        }

        if (termNorm.length <= 3) {
          // Palavras curtas (ex: 'cu', 'fdp') devem casar exatamente
          if (normToken === termNorm) {
            return '*'.repeat(token.length);
          }
        } else {
          // Palavras com 4+ letras (ex: 'caralho', 'puta', 'arrombado')
          if (normToken.includes(termNorm) && !this.SAFE_EXCEPTIONS.has(normToken)) {
            return '*'.repeat(Math.max(3, token.length));
          }
        }
        return token;
      })
      .join('');
  }
}
