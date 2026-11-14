/**
 * @file apps/server/src/controllers/GameChatService.ts
 * @description Serviço autoritário de chat multi-canal em tempo real para o Etheria Campus.
 * 
 * CANAIS DE COMUNICAÇÃO:
 * - SISTEMA: Mensagens oficiais do servidor (anúncios, level-up, recompensas). Visualizadas em todos os canais!
 * - MUNDO: Chat global livre entre todos os aventureiros do continente.
 * - LOCAL: Chat restrito aos jogadores presentes no mapa atual (currentMapId).
 * - GUILDA: Chat exclusivo para membros da guilda do jogador.
 * - FACCÃO: Chat exclusivo para membros da facção do jogador.
 * - EQUIPE: Chat exclusivo para integrantes do grupo/equipe atual do jogador.
 */

import type { PrismaClient } from '@prisma/client';
import { ChatModerationFilter } from '../security/ChatModerationFilter.js';

export type ChatCategory = 'SISTEMA' | 'MUNDO' | 'LOCAL' | 'GUILDA' | 'FACCÃO' | 'EQUIPE';

export interface ChatMessageDto {
  id: number;
  category: ChatCategory;
  senderId?: number;
  senderName: string;
  senderClass?: string;
  senderElement?: string;
  senderLevel?: number;
  mapId?: number;
  guildId?: number;
  factionId?: string;
  teamId?: number;
  text: string;
  timestamp: number;
  isCensored?: boolean;
}

export interface SendMessageOptions {
  category: ChatCategory;
  text: string;
  senderCharacterId: number;
  clientMapId?: number;
}

export interface GetMessagesQuery {
  sinceId?: number;
  mapId?: number;
  guildId?: number;
  factionId?: string;
  teamId?: number;
  limit?: number;
}

export class GameChatService {
  /** Capacidade máxima do buffer em memória para histórico recente */
  private static readonly MAX_BUFFER_SIZE = 500;

  /** Sequenciador de ID incremental único de mensagens */
  private static nextMessageId = 1;

  /** Buffer circular em memória das mensagens recentes */
  private static messageBuffer: ChatMessageDto[] = [];

  /** Flag para garantir seed inicial de boas-vindas do sistema */
  private static isInitialized = false;

  /**
   * Garante a inicialização com mensagem do sistema de boas-vindas.
   */
  private static ensureInitialized(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.sendSystemMessage(
      '🌟 Bem-vindo ao Etheria Campus! O chat está ativo nos canais Mundo, Local, Guilda, Facção e Equipe. Respeite as diretrizes comunitárias 16+.'
    );
  }

  /**
   * Envia uma mensagem autoritária de jogador validando permissões e aplicando o filtro 16+.
   */
  public static async sendMessage(
    prisma: PrismaClient,
    options: SendMessageOptions
  ): Promise<ChatMessageDto> {
    this.ensureInitialized();

    const { category, text, senderCharacterId, clientMapId } = options;

    if (!text || !text.trim()) {
      throw new Error('A mensagem não pode estar vazia.');
    }

    if (text.length > 200) {
      throw new Error('A mensagem excede o limite máximo de 200 caracteres.');
    }

    // Jogadores não podem enviar mensagens fingindo ser do canal SISTEMA
    if (category === 'SISTEMA') {
      throw new Error('O canal SISTEMA é de uso exclusivo do servidor.');
    }

    // 1. Busca os dados do personagem autoritário no banco de dados
    const character = await prisma.playerCharacter.findUnique({
      where: { id: senderCharacterId },
      include: {
        classTemplate: true,
      },
    });

    if (!character) {
      throw new Error('Personagem emissor não encontrado.');
    }

    const effectiveMapId = Number(character.currentMapId) || Number(clientMapId) || 1;

    // 2. Validações contextuais por canal
    if (category === 'LOCAL' && !effectiveMapId) {
      throw new Error('Não foi possível identificar o mapa atual para o chat Local.');
    }

    // Validações para Guilda, Facção e Equipe
    // (Caso os sistemas futuros ainda não tenham vinculado guild/party no personagem, o chat avisa cordialmente)
    if (category === 'GUILDA') {
      // Futuro: vincular à guilda real do jogador
      throw new Error('Você ainda não possui uma Guilda para conversar neste canal.');
    }

    if (category === 'FACCÃO') {
      // Futuro: vincular à facção real do jogador
      throw new Error('Você ainda não possui uma Facção para conversar neste canal.');
    }

    if (category === 'EQUIPE') {
      // Futuro: vincular à equipe/party ativa do jogador
      throw new Error('Você não está em nenhuma Equipe/Grupo no momento.');
    }

    // 3. Aplica o filtro comunitário de conduta 16+
    const moderation = ChatModerationFilter.filterMessage(text);
    if (!moderation.allowed) {
      throw new Error(moderation.blockedReason || 'Mensagem bloqueada pelo sistema de moderação 16+.');
    }

    // 4. Constrói o DTO da mensagem
    const messageDto: ChatMessageDto = {
      id: this.nextMessageId++,
      category,
      senderId: character.id,
      senderName: character.name,
      senderClass: character.classTemplate?.code || 'Aventureiro',
      senderElement: character.elementCode || 'NEUTRAL',
      senderLevel: character.level || 1,
      mapId: category === 'LOCAL' ? effectiveMapId : undefined,
      text: moderation.censoredText,
      timestamp: Date.now(),
      isCensored: moderation.hasProfanity,
    };

    this.pushMessage(messageDto);
    return messageDto;
  }

  /**
   * Envia uma mensagem oficial de SISTEMA.
   * Regra Central: Mensagens de sistema são visualizadas em todos os outros chats também!
   */
  public static sendSystemMessage(
    text: string,
    options?: { mapId?: number }
  ): ChatMessageDto {
    this.ensureInitialized();

    const messageDto: ChatMessageDto = {
      id: this.nextMessageId++,
      category: 'SISTEMA',
      senderName: 'Sistema',
      mapId: options?.mapId,
      text,
      timestamp: Date.now(),
    };

    this.pushMessage(messageDto);
    return messageDto;
  }

  /**
   * Adiciona mensagem ao buffer circular com limite de memória.
   */
  private static pushMessage(message: ChatMessageDto): void {
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.MAX_BUFFER_SIZE) {
      this.messageBuffer.splice(0, this.messageBuffer.length - this.MAX_BUFFER_SIZE);
    }
  }

  /**
   * Retorna as mensagens filtradas de acordo com o contexto do jogador e o id incremental.
   */
  public static getMessages(query: GetMessagesQuery): ChatMessageDto[] {
    this.ensureInitialized();

    const sinceId = Number(query.sinceId) || 0;
    const playerMapId = query.mapId ? Number(query.mapId) : undefined;
    const guildId = query.guildId ? Number(query.guildId) : undefined;
    const factionId = query.factionId ? String(query.factionId) : undefined;
    const teamId = query.teamId ? Number(query.teamId) : undefined;
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 60));

    // Filtra mensagens mais recentes que sinceId e compatíveis com a visibilidade
    const filtered = this.messageBuffer.filter((msg) => {
      if (msg.id <= sinceId) return false;

      // 1. Mensagens do SISTEMA: visíveis para todos os jogadores sempre!
      if (msg.category === 'SISTEMA') return true;

      // 2. Mensagens do MUNDO: visíveis para todos os jogadores online
      if (msg.category === 'MUNDO') return true;

      // 3. Mensagens do LOCAL: apenas se o jogador estiver no mesmo mapa
      if (msg.category === 'LOCAL') {
        if (!playerMapId || !msg.mapId) return true;
        return msg.mapId === playerMapId;
      }

      // 4. Mensagens de GUILDA: apenas se o jogador pertencer à mesma guilda
      if (msg.category === 'GUILDA') {
        if (!guildId || !msg.guildId) return false;
        return msg.guildId === guildId;
      }

      // 5. Mensagens de FACCÃO: apenas se o jogador pertencer à mesma facção
      if (msg.category === 'FACCÃO') {
        if (!factionId || !msg.factionId) return false;
        return msg.factionId === factionId;
      }

      // 6. Mensagens de EQUIPE: apenas se o jogador estiver na mesma equipe
      if (msg.category === 'EQUIPE') {
        if (!teamId || !msg.teamId) return false;
        return msg.teamId === teamId;
      }

      return false;
    });

    if (sinceId > 0) {
      return filtered;
    }

    // Se é a carga inicial (sinceId = 0), retorna as últimas `limit` mensagens
    return filtered.slice(-limit);
  }
}
