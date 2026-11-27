/**
 * @file apps/server/src/controllers/PartyService.ts
 * @module @etheria/server
 * @description Serviço Autoritário de Gerenciamento de Equipes (Parties de até 3 Jogadores).
 * 
 * RECURSOS:
 * - Limite estrito de no máximo 3 jogadores por equipe.
 * - Formação por proximidade física (~350px no mesmo mapa).
 * - Sincronização em tempo real de membros, HP/MP, Líder e Seguidores (Fila Indiana).
 * - Mudança de mapa em conjunto e entrada simultânea na arena de combate.
 * - Cálculo e divisão de recompensas (+30% de XP, Ouro e Drops divididos igualmente com Math.ceil).
 * - Suporte a convites com expiração automática.
 * 
 * Segue estritamente AGENTS.md (Regra #7: < 1.000 linhas).
 * @rules Limite máximo de 3 jogadores por equipe, bônus cooperativo +30% dividido igualmente no servidor.
 * @dependencies Sem dependências externas (gerenciamento em memória autoritativo).
 */

export interface PartyMember {
  characterId: number;
  userAccountId: number;
  name: string;
  level: number;
  classCode: string;
  mcreworkCharKey: string;
  thumbUrl?: string;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  mapId: number;
  posX: number;
  posY: number;
  isLeader: boolean;
  memberIndex: number; // 0 = Líder, 1 = Membro 1, 2 = Membro 2
  joinedAt: number;
}

export interface PartyInvite {
  id: string;
  partyId: string;
  fromCharacterId: number;
  fromCharacterName: string;
  fromLevel: number;
  fromClassCode: string;
  toCharacterId: number;
  mapId: number;
  createdAt: number;
  expiresAt: number;
}

export interface Party {
  id: string;
  leaderCharacterId: number;
  members: PartyMember[];
  createdAt: number;
  currentMapId: number;
  activeBattleId?: string | null;
  targetMapChange?: { mapId: number; posX: number; posY: number; timestamp: number } | null;
}

export class PartyService {
  private static parties = new Map<string, Party>();
  private static partyByCharId = new Map<number, string>();
  private static invites = new Map<string, PartyInvite>();
  private static invitesByTarget = new Map<number, Set<string>>();

  private static readonly MAX_PARTY_MEMBERS = 3;
  private static readonly MAX_INVITE_DISTANCE = 350; // pixels
  private static readonly INVITE_TTL_MS = 30000; // 30 segundos

  public static getPartyByCharacterId(characterId: number): Party | null {
    const partyId = this.partyByCharId.get(characterId);
    if (!partyId) return null;
    return this.parties.get(partyId) || null;
  }

  public static getPartyById(partyId: string): Party | null {
    return this.parties.get(partyId) || null;
  }

  public static isPartyLeader(characterId: number): boolean {
    const party = this.getPartyByCharacterId(characterId);
    return party ? party.leaderCharacterId === characterId : false;
  }

  /**
   * Cria uma nova equipe com o jogador como Líder.
   */
  public static createParty(
    leaderCharId: number,
    userAccountId: number,
    meta: {
      name: string;
      level: number;
      classCode: string;
      mcreworkCharKey: string;
      thumbUrl?: string;
      hp: number;
      maxHp: number;
      mp: number;
      maxMp: number;
      mapId: number;
      posX: number;
      posY: number;
    }
  ): Party {
    const existing = this.getPartyByCharacterId(leaderCharId);
    if (existing) return existing;

    const partyId = `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const leaderMember: PartyMember = {
      characterId: leaderCharId,
      userAccountId,
      name: meta.name,
      level: meta.level,
      classCode: meta.classCode,
      mcreworkCharKey: meta.mcreworkCharKey,
      thumbUrl: meta.thumbUrl,
      currentHp: meta.hp,
      maxHp: meta.maxHp,
      currentMp: meta.mp,
      maxMp: meta.maxMp,
      mapId: meta.mapId,
      posX: meta.posX,
      posY: meta.posY,
      isLeader: true,
      memberIndex: 0,
      joinedAt: Date.now(),
    };

    const newParty: Party = {
      id: partyId,
      leaderCharacterId: leaderCharId,
      members: [leaderMember],
      createdAt: Date.now(),
      currentMapId: meta.mapId,
    };

    this.parties.set(partyId, newParty);
    this.partyByCharId.set(leaderCharId, partyId);
    return newParty;
  }

  /**
   * Envia convite de equipe para um jogador próximo.
   */
  public static invitePlayer(
    fromChar: { id: number; name: string; level: number; classCode: string; userAccountId: number; mapId: number; posX: number; posY: number; hp: number; maxHp: number; mp: number; maxMp: number; mcreworkCharKey: string; thumbUrl?: string },
    targetChar: { id: number; name: string; mapId: number; posX: number; posY: number }
  ): PartyInvite {
    this.pruneExpiredInvites();

    if (fromChar.id === targetChar.id) {
      throw new Error('Você não pode convidar a si mesmo para a equipe.');
    }

    if (fromChar.mapId !== targetChar.mapId) {
      throw new Error('O jogador precisa estar no mesmo mapa para entrar na equipe.');
    }

    const dist = Math.hypot(fromChar.posX - targetChar.posX, fromChar.posY - targetChar.posY);
    if (dist > this.MAX_INVITE_DISTANCE) {
      throw new Error('O jogador está muito distante para entrar na equipe (aproxime-se).');
    }

    if (this.partyByCharId.has(targetChar.id)) {
      throw new Error(`${targetChar.name} já faz parte de uma equipe.`);
    }

    let party = this.getPartyByCharacterId(fromChar.id);
    if (!party) {
      party = this.createParty(fromChar.id, fromChar.userAccountId, {
        name: fromChar.name,
        level: fromChar.level,
        classCode: fromChar.classCode,
        mcreworkCharKey: fromChar.mcreworkCharKey,
        thumbUrl: fromChar.thumbUrl,
        hp: fromChar.hp,
        maxHp: fromChar.maxHp,
        mp: fromChar.mp,
        maxMp: fromChar.maxMp,
        mapId: fromChar.mapId,
        posX: fromChar.posX,
        posY: fromChar.posY,
      });
    }

    if (party.leaderCharacterId !== fromChar.id) {
      throw new Error('Apenas o Líder da equipe pode convidar novos membros.');
    }

    if (party.members.length >= this.MAX_PARTY_MEMBERS) {
      throw new Error(`A equipe já atingiu o limite máximo de ${this.MAX_PARTY_MEMBERS} jogadores.`);
    }

    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const invite: PartyInvite = {
      id: inviteId,
      partyId: party.id,
      fromCharacterId: fromChar.id,
      fromCharacterName: fromChar.name,
      fromLevel: fromChar.level,
      fromClassCode: fromChar.classCode,
      toCharacterId: targetChar.id,
      mapId: fromChar.mapId,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.INVITE_TTL_MS,
    };

    this.invites.set(inviteId, invite);
    let targetSet = this.invitesByTarget.get(targetChar.id);
    if (!targetSet) {
      targetSet = new Set();
      this.invitesByTarget.set(targetChar.id, targetSet);
    }
    targetSet.add(inviteId);

    return invite;
  }

  /**
   * Retorna os convites pendentes e válidos recebidos por um personagem.
   */
  public static getPendingInvites(targetCharId: number): PartyInvite[] {
    this.pruneExpiredInvites();
    const ids = this.invitesByTarget.get(targetCharId);
    if (!ids) return [];
    const valid: PartyInvite[] = [];
    for (const invId of ids) {
      const inv = this.invites.get(invId);
      if (inv && inv.expiresAt > Date.now()) {
        valid.push(inv);
      }
    }
    return valid;
  }

  /**
   * Aceita um convite de equipe pendente.
   */
  public static acceptInvite(
    targetChar: { id: number; name: string; level: number; classCode: string; mcreworkCharKey: string; thumbUrl?: string; userAccountId: number; mapId: number; posX: number; posY: number; hp: number; maxHp: number; mp: number; maxMp: number },
    inviteId: string
  ): Party {
    this.pruneExpiredInvites();
    const invite = this.invites.get(inviteId);
    if (!invite || invite.toCharacterId !== targetChar.id) {
      throw new Error('Convite expirado ou não encontrado.');
    }

    if (this.partyByCharId.has(targetChar.id)) {
      this.removeInvite(inviteId);
      throw new Error('Você já faz parte de uma equipe.');
    }

    const party = this.parties.get(invite.partyId);
    if (!party) {
      this.removeInvite(inviteId);
      throw new Error('A equipe não existe mais.');
    }

    if (party.members.length >= this.MAX_PARTY_MEMBERS) {
      this.removeInvite(inviteId);
      throw new Error('A equipe já está cheia (máximo 3 jogadores).');
    }

    // Valida proximidade com o Líder
    const leader = party.members.find((m) => m.isLeader);
    if (leader) {
      if (leader.mapId !== targetChar.mapId) {
        throw new Error('Você precisa estar no mesmo mapa do líder da equipe.');
      }
      const dist = Math.hypot(leader.posX - targetChar.posX, leader.posY - targetChar.posY);
      if (dist > this.MAX_INVITE_DISTANCE + 100) {
        throw new Error('Você está muito distante do líder da equipe.');
      }
    }

    const newMemberIndex = party.members.length;
    const member: PartyMember = {
      characterId: targetChar.id,
      userAccountId: targetChar.userAccountId,
      name: targetChar.name,
      level: targetChar.level,
      classCode: targetChar.classCode,
      mcreworkCharKey: targetChar.mcreworkCharKey,
      thumbUrl: targetChar.thumbUrl,
      currentHp: targetChar.hp,
      maxHp: targetChar.maxHp,
      currentMp: targetChar.mp,
      maxMp: targetChar.maxMp,
      mapId: targetChar.mapId,
      posX: targetChar.posX,
      posY: targetChar.posY,
      isLeader: false,
      memberIndex: newMemberIndex,
      joinedAt: Date.now(),
    };

    party.members.push(member);
    this.partyByCharId.set(targetChar.id, party.id);
    this.removeInvite(inviteId);

    // Remove outros convites do alvo
    this.clearAllInvitesForTarget(targetChar.id);

    return party;
  }

  /**
   * Recusa um convite.
   */
  public static declineInvite(targetCharId: number, inviteId: string): boolean {
    const invite = this.invites.get(inviteId);
    if (invite && invite.toCharacterId === targetCharId) {
      this.removeInvite(inviteId);
      return true;
    }
    return false;
  }

  /**
   * Remove um membro da equipe (ou faz o membro sair voluntariamente).
   */
  public static leaveParty(characterId: number): { left: boolean; disbanded: boolean; newLeaderId?: number } {
    const party = this.getPartyByCharacterId(characterId);
    if (!party) return { left: false, disbanded: false };

    const wasLeader = party.leaderCharacterId === characterId;
    party.members = party.members.filter((m) => m.characterId !== characterId);
    this.partyByCharId.delete(characterId);

    if (party.members.length === 0) {
      this.parties.delete(party.id);
      return { left: true, disbanded: true };
    }

    // Se o líder saiu, passa liderança para o próximo
    let newLeaderId: number | undefined;
    if (wasLeader) {
      party.members[0].isLeader = true;
      party.leaderCharacterId = party.members[0].characterId;
      newLeaderId = party.leaderCharacterId;
    }

    // Reindexa as posições na fila indiana (0, 1, 2)
    party.members.forEach((m, idx) => {
      m.memberIndex = idx;
    });

    return { left: true, disbanded: false, newLeaderId };
  }

  /**
   * Expulsa um membro da equipe (ação exclusiva do Líder).
   */
  public static kickMember(leaderCharId: number, targetCharId: number): Party {
    const party = this.getPartyByCharacterId(leaderCharId);
    if (!party) throw new Error('Você não está em uma equipe.');
    if (party.leaderCharacterId !== leaderCharId) throw new Error('Apenas o Líder pode expulsar membros.');
    if (leaderCharId === targetCharId) throw new Error('O líder não pode expulsar a si mesmo (use sair da equipe).');

    const exists = party.members.some((m) => m.characterId === targetCharId);
    if (!exists) throw new Error('Membro não encontrado nesta equipe.');

    this.leaveParty(targetCharId);
    return party;
  }

  /**
   * Transfere a liderança da equipe para outro membro.
   */
  public static transferLeadership(leaderCharId: number, targetCharId: number): Party {
    const party = this.getPartyByCharacterId(leaderCharId);
    if (!party) throw new Error('Você não está em uma equipe.');
    if (party.leaderCharacterId !== leaderCharId) throw new Error('Apenas o Líder pode transferir a liderança.');

    const target = party.members.find((m) => m.characterId === targetCharId);
    if (!target) throw new Error('Membro alvo não está na equipe.');

    party.members.forEach((m) => {
      m.isLeader = m.characterId === targetCharId;
    });
    party.leaderCharacterId = targetCharId;

    // Coloca o novo líder no índice 0
    party.members.sort((a, b) => (a.isLeader ? -1 : b.isLeader ? 1 : 0));
    party.members.forEach((m, idx) => {
      m.memberIndex = idx;
    });

    return party;
  }

  /**
   * Atualiza as coordenadas e status vitais de um membro na equipe em tempo real.
   */
  public static syncMemberVitals(
    characterId: number,
    data: { hp?: number; maxHp?: number; mp?: number; maxMp?: number; mapId?: number; posX?: number; posY?: number }
  ): void {
    const party = this.getPartyByCharacterId(characterId);
    if (!party) return;

    const member = party.members.find((m) => m.characterId === characterId);
    if (!member) return;

    if (data.hp !== undefined) member.currentHp = Number(data.hp);
    if (data.maxHp !== undefined) member.maxHp = Number(data.maxHp);
    if (data.mp !== undefined) member.currentMp = Number(data.mp);
    if (data.maxMp !== undefined) member.maxMp = Number(data.maxMp);
    if (data.mapId !== undefined) {
      member.mapId = Number(data.mapId);
      if (member.isLeader) party.currentMapId = Number(data.mapId);
    }
    if (data.posX !== undefined) member.posX = Number(data.posX);
    if (data.posY !== undefined) member.posY = Number(data.posY);
  }

  /**
   * Notifica a troca de mapa pelo Líder para puxar os seguidores juntos.
   */
  public static syncLeaderMapChange(
    leaderCharId: number,
    newMapId: number,
    spawnX: number,
    spawnY: number
  ): number[] {
    const party = this.getPartyByCharacterId(leaderCharId);
    if (!party || party.leaderCharacterId !== leaderCharId) return [];

    party.currentMapId = newMapId;
    party.targetMapChange = {
      mapId: newMapId,
      posX: spawnX,
      posY: spawnY,
      timestamp: Date.now(),
    };
    const followerIds: number[] = [];

    party.members.forEach((m) => {
      m.mapId = newMapId;
      m.posX = spawnX;
      m.posY = spawnY;
      if (!m.isLeader) followerIds.push(m.characterId);
    });

    return followerIds;
  }

  /**
   * Cálculo de recompensas com bônus de equipe (+30% dividido igualmente, Math.ceil).
   */
  public static calculatePartyRewards(
    baseExp: number,
    baseGold: number,
    partySize: number
  ): { totalExp: number; expPerMember: number; totalGold: number; goldPerMember: number } {
    const size = Math.max(1, Math.min(this.MAX_PARTY_MEMBERS, partySize));
    if (size <= 1) {
      return { totalExp: baseExp, expPerMember: baseExp, totalGold: baseGold, goldPerMember: baseGold };
    }

    // Bônus oficial de +30% em equipe (dupla ou trio)
    const bonusMultiplier = 1.30;
    const totalExp = Math.max(1, Math.ceil(baseExp * bonusMultiplier));
    const expPerMember = Math.max(1, Math.ceil(totalExp / size));

    const totalGold = Math.max(1, Math.ceil(baseGold * bonusMultiplier));
    const goldPerMember = Math.max(1, Math.ceil(totalGold / size));

    return { totalExp, expPerMember, totalGold, goldPerMember };
  }

  private static removeInvite(inviteId: string): void {
    const inv = this.invites.get(inviteId);
    if (!inv) return;
    this.invites.delete(inviteId);
    const targetSet = this.invitesByTarget.get(inv.toCharacterId);
    if (targetSet) targetSet.delete(inviteId);
  }

  private static clearAllInvitesForTarget(targetCharId: number): void {
    const ids = this.invitesByTarget.get(targetCharId);
    if (!ids) return;
    for (const invId of ids) {
      this.invites.delete(invId);
    }
    this.invitesByTarget.delete(targetCharId);
  }

  private static pruneExpiredInvites(): void {
    const now = Date.now();
    for (const [id, inv] of this.invites.entries()) {
      if (inv.expiresAt <= now) {
        this.invites.delete(id);
        const set = this.invitesByTarget.get(inv.toCharacterId);
        if (set) set.delete(id);
      }
    }
  }
}
