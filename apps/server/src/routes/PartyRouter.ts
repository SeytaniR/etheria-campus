/**
 * @file apps/server/src/routes/PartyRouter.ts
 * @module @etheria/server
 * @description Roteador Especializado de Equipes (Parties de até 3 Jogadores).
 * 
 * Segue estritamente AGENTS.md (Regra #7: < 1.000 linhas).
 * @rules Verificação estrita de posse do personagem (`verifyCharacterOwnership`) e bloqueio contra BOLA/IDOR.
 * @dependencies node:http, @prisma/client, ../controllers/PartyService.js, ../controllers/MapPresenceService.js
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { PartyService } from '../controllers/PartyService.js';
import { MapPresenceService } from '../controllers/MapPresenceService.js';

export interface PartyRouterDeps {
  prisma: PrismaClient;
  readJsonBody: <T>(req: IncomingMessage) => Promise<T>;
  sendJson: (res: ServerResponse, status: number, data: any) => void;
  verifyCharacterOwnership: (userAccountId: number, role: string, characterId: number) => Promise<boolean>;
}

export class PartyRouter {
  constructor(private readonly deps: PartyRouterDeps) {}

  public async handle(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
    method: string,
    session: { userAccountId: number; role: string }
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/play/party')) return false;

    const userAccountId = session.userAccountId;

    // 1. Estado da Equipe Atual do Personagem + Convites Pendentes
    if (pathname === '/api/play/party/state' && method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const characterId = Number(url.searchParams.get('characterId'));
      if (!characterId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      const party = PartyService.getPartyByCharacterId(characterId);
      const invites = PartyService.getPendingInvites(characterId);

      this.deps.sendJson(res, 200, {
        ok: true,
        success: true,
        inParty: Boolean(party),
        party: party || null,
        invites,
      });
      return true;
    }

    // 2. Jogadores Próximos Disponíveis para Convite
    if (pathname === '/api/play/party/nearby' && method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const characterId = Number(url.searchParams.get('characterId'));
      const mapId = Number(url.searchParams.get('mapId')) || 1;
      if (!characterId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      const [reqChar, nearbyAll] = await Promise.all([
        this.deps.prisma.playerCharacter.findUnique({ where: { id: characterId }, select: { posX: true, posY: true } }),
        Promise.resolve(MapPresenceService.getNearbyPlayers(characterId, mapId, 400)),
      ]);
      const rx = Number(reqChar?.posX ?? 500);
      const ry = Number(reqChar?.posY ?? 500);

      const candidates = nearbyAll.map((p) => {
        const pParty = PartyService.getPartyByCharacterId(p.characterId);
        return {
          characterId: p.characterId,
          name: p.name,
          level: p.level,
          classCode: p.classCode,
          mcreworkCharKey: p.mcreworkCharKey,
          thumbUrl: p.thumbUrl,
          posX: p.posX,
          posY: p.posY,
          distance: Math.round(Math.hypot((p.posX || 0) - rx, (p.posY || 0) - ry)),
          inParty: Boolean(pParty),
        };
      });

      this.deps.sendJson(res, 200, { ok: true, success: true, candidates, nearbyPlayers: candidates });
      return true;
    }

    // 3. Criar Equipe
    if (pathname === '/api/play/party/create' && method === 'POST') {
      try {
        const body = await this.deps.readJsonBody<{ characterId: number }>(req);
        const charId = Number(body.characterId);
        if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
          this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
          return true;
        }

        const pc = await this.deps.prisma.playerCharacter.findUnique({
          where: { id: charId },
          include: { classTemplate: true },
        });
        if (!pc) {
          this.deps.sendJson(res, 404, { error: 'Personagem não encontrado.' });
          return true;
        }

        const party = PartyService.createParty(charId, userAccountId, {
          name: pc.name,
          level: pc.level || 1,
          classCode: pc.classTemplate?.code || 'WARRIOR',
          mcreworkCharKey: pc.classTemplate?.mcreworkCharKey || '100101',
          thumbUrl: `/api/assets/mcrework/assets/characters/${pc.classTemplate?.mcreworkCharKey || '100101'}/thumb.webp`,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
          mapId: pc.currentMapId || 1,
          posX: pc.posX || 500,
          posY: pc.posY || 500,
        });

        this.deps.sendJson(res, 200, { ok: true, success: true, party });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err?.message || 'Erro ao criar equipe.' });
      }
      return true;
    }

    // 4. Enviar Convite de Equipe
    if (pathname === '/api/play/party/invite' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; targetCharacterId: number }>(req);
      const charId = Number(body.characterId);
      const targetId = Number(body.targetCharacterId);

      if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      const [inviterPc, targetPc] = await Promise.all([
        this.deps.prisma.playerCharacter.findUnique({ where: { id: charId }, include: { classTemplate: true } }),
        this.deps.prisma.playerCharacter.findUnique({ where: { id: targetId } }),
      ]);

      if (!inviterPc || !targetPc) {
        this.deps.sendJson(res, 404, { error: 'Personagem ou jogador alvo não encontrado.' });
        return true;
      }

      try {
        const invite = PartyService.invitePlayer(
          {
            id: inviterPc.id,
            name: inviterPc.name,
            level: inviterPc.level || 1,
            classCode: inviterPc.classTemplate?.code || 'WARRIOR',
            userAccountId,
            mapId: inviterPc.currentMapId || 1,
            posX: inviterPc.posX || 500,
            posY: inviterPc.posY || 500,
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            mcreworkCharKey: inviterPc.classTemplate?.mcreworkCharKey || '100101',
            thumbUrl: `/api/assets/mcrework/assets/characters/${inviterPc.classTemplate?.mcreworkCharKey || '100101'}/thumb.webp`,
          },
          {
            id: targetPc.id,
            name: targetPc.name,
            mapId: targetPc.currentMapId || 1,
            posX: targetPc.posX || 500,
            posY: targetPc.posY || 500,
          }
        );

        this.deps.sendJson(res, 200, { ok: true, success: true, invite });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao enviar convite.' });
      }
      return true;
    }

    // 5. Aceitar Convite de Equipe
    if (pathname === '/api/play/party/accept' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; inviteId: string }>(req);
      const charId = Number(body.characterId);
      if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      const pc = await this.deps.prisma.playerCharacter.findUnique({
        where: { id: charId },
        include: { classTemplate: true },
      });
      if (!pc) {
        this.deps.sendJson(res, 404, { error: 'Personagem não encontrado.' });
        return true;
      }

      try {
        const party = PartyService.acceptInvite(
          {
            id: pc.id,
            name: pc.name,
            level: pc.level || 1,
            classCode: pc.classTemplate?.code || 'WARRIOR',
            mcreworkCharKey: pc.classTemplate?.mcreworkCharKey || '100101',
            thumbUrl: `/api/assets/mcrework/assets/characters/${pc.classTemplate?.mcreworkCharKey || '100101'}/thumb.webp`,
            userAccountId,
            mapId: pc.currentMapId || 1,
            posX: pc.posX || 500,
            posY: pc.posY || 500,
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
          },
          String(body.inviteId)
        );

        this.deps.sendJson(res, 200, { ok: true, success: true, party });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao aceitar convite.' });
      }
      return true;
    }

    // 6. Recusar Convite
    if (pathname === '/api/play/party/decline' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; inviteId: string }>(req);
      const charId = Number(body.characterId);
      if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      PartyService.declineInvite(charId, String(body.inviteId));
      this.deps.sendJson(res, 200, { ok: true, success: true });
      return true;
    }

    // 7. Sair da Equipe
    if (pathname === '/api/play/party/leave' && method === 'POST') {
      try {
        const body = await this.deps.readJsonBody<{ characterId: number }>(req);
        const charId = Number(body.characterId);
        if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
          this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
          return true;
        }

        const resLeave = PartyService.leaveParty(charId);
        this.deps.sendJson(res, 200, { ok: true, success: true, ...resLeave });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err?.message || 'Erro ao sair da equipe.' });
      }
      return true;
    }

    // 8. Expulsar Membro
    if (pathname === '/api/play/party/kick' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; targetCharacterId: number }>(req);
      const charId = Number(body.characterId);
      const targetId = Number(body.targetCharacterId);
      if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      try {
        const party = PartyService.kickMember(charId, targetId);
        this.deps.sendJson(res, 200, { ok: true, success: true, party });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao expulsar membro.' });
      }
      return true;
    }

    // 9. Transferir Liderança
    if (pathname === '/api/play/party/transfer' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; targetCharacterId: number }>(req);
      const charId = Number(body.characterId);
      const targetId = Number(body.targetCharacterId);
      if (!charId || !(await this.deps.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Personagem inválido.' });
        return true;
      }

      try {
        const party = PartyService.transferLeadership(charId, targetId);
        this.deps.sendJson(res, 200, { ok: true, success: true, party });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao transferir liderança.' });
      }
      return true;
    }

    return false;
  }
}
