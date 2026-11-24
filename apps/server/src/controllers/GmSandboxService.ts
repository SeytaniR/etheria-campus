/**
 * @file apps/server/src/controllers/GmSandboxService.ts
 * @module @etheria/server
 * @description Arsenal & Sandbox Autoritário de Game Master (`/gm` e Painel GM em `/play`).
 *   Permite que contas GM, ADMIN e DEV testem livremente qualquer mecânica do jogo:
 *   - Catálogo completo de Itens, Equipamentos (Personagem, Pet, Asas, Montarias Voadoras) e Conjuntos.
 *   - Adição/equipamento instantâneo de itens avulsos, conjuntos inteiros, kit de essências e limpeza de mochila.
 *   - Manipulação de Ouro, XP, Nível (1 a 100), Pontos de Atributo, Classe, Elemento e geração de Pets.
 * @rules Acesso estritamente restrito a roles ADMIN, GM e DEV (Cláusula 0 de Segurança, Regra #7 < 1.000 linhas).
 * @dependencies node:http, @prisma/client, @etheria/database (I18nCache), ./CharacterInventoryService.js, ./CharacterEquipmentService.js, ./CharacterProgressionService.js, ./MapPresenceService.js
 */

import type * as http from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CharacterEquipmentService } from './CharacterEquipmentService.js';
import { CharacterProgressionService } from './CharacterProgressionService.js';
import { MapPresenceService } from './MapPresenceService.js';
import type { GamePlayController } from './GamePlayController.js';

export class GmSandboxService {
  public static isElevatedRole(role: string | undefined | null): boolean {
    return ['ADMIN', 'GM', 'DEV'].includes(String(role || '').toUpperCase());
  }

  public static async getCatalog(prisma: PrismaClient) {
    const [items, sets, classes, monsters, i18nMap] = await Promise.all([
      prisma.itemTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ itemCategory: 'asc' }, { requiredLevel: 'asc' }, { id: 'asc' }],
      }),
      prisma.equipmentSet.findMany({
        where: { isActive: true },
        include: { _count: { select: { items: true } } },
        orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
      }),
      prisma.classTemplate.findMany({ orderBy: { id: 'asc' } }),
      prisma.monsterTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ rarityTier: 'asc' }, { id: 'asc' }],
      }),
      I18nCache.getTranslations(prisma),
    ]);

    return {
      items: items.map((it) => ({
        id: it.id,
        code: it.code,
        namePtBr: i18nMap.get(it.nameI18nKey) || it.code,
        itemCategory: it.itemCategory,
        equipmentSlotCode: it.equipmentSlotCode,
        equipmentSetId: it.equipmentSetId,
        rarityTier: it.rarityTier || 'F',
        requiredLevel: it.requiredLevel || 1,
        iconUrl: CharacterInventoryService.resolveIconUrl(it.mcreworkIconKey),
        combatStatBonuses: it.combatStatBonusesJson || {},
      })),
      equipmentSets: sets.map((s) => ({
        id: s.id,
        code: s.code,
        namePtBr: i18nMap.get(s.nameI18nKey) || s.code,
        rarityTier: s.rarityTier || 'F',
        requiredLevel: s.requiredLevel || 1,
        minPiecesFull: s.minPiecesFull || 12,
        piecesCount: (s as any)._count?.items || 0,
      })),
      classes: classes.map((c) => ({
        id: c.id,
        code: c.code,
        namePtBr: i18nMap.get(c.nameI18nKey) || c.code,
      })),
      monsters: monsters.map((m) => ({
        id: m.id,
        code: m.code,
        namePtBr: i18nMap.get(m.nameI18nKey) || m.code,
        raceCode: m.raceCode,
        rarityTier: m.rarityTier || 'F',
      })),
    };
  }

  public static async executeAction(
    prisma: PrismaClient,
    playController: GamePlayController,
    userAccountId: number,
    role: string,
    body: any
  ) {
    if (!this.isElevatedRole(role)) {
      throw new Error('Acesso negado: apenas contas GM, ADMIN ou DEV podem usar o Arsenal GM.');
    }

    const characterId = Number(body?.characterId);
    if (!characterId) throw new Error('characterId é obrigatório.');

    const char = await prisma.playerCharacter.findUnique({ where: { id: characterId } });
    if (!char) throw new Error(`Personagem #${characterId} não encontrado.`);

    const action = String(body?.action || '').toUpperCase();
    let message = 'Ação GM executada com sucesso!';

    if (action === 'ADD_GOLD') {
      const amount = Number(body.amount) || 0;
      const nextGold = Math.max(0, Number(char.gold || 0) + amount);
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: { gold: BigInt(Math.round(nextGold)) },
      });
      message = `🪙 Ouro atualizado para ${nextGold.toLocaleString('pt-BR')}!`;
    } else if (action === 'SET_GOLD') {
      const amount = Math.max(0, Math.round(Number(body.amount) || 0));
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: { gold: BigInt(amount) },
      });
      message = `🪙 Ouro definido em ${amount.toLocaleString('pt-BR')}!`;
    } else if (action === 'ADD_XP') {
      const amount = Math.max(1, Math.round(Number(body.amount) || 10000));
      const prog = await CharacterProgressionService.awardCharacterExperience(prisma, characterId, amount);
      message = `✨ +${amount.toLocaleString('pt-BR')} XP concedidos! (Nível atual: ${prog?.newLevel ?? char.level})`;
    } else if (action === 'SET_LEVEL') {
      const level = Math.max(1, Math.min(100, Math.round(Number(body.level) || 1)));
      const dist = (char.distributedStatsJson && typeof char.distributedStatsJson === 'object'
        ? char.distributedStatsJson
        : {}) as Record<string, number>;
      const spent = Object.values(dist).reduce((acc, v) => acc + (Number(v) || 0), 0);
      const totalEarned = (level - 1) * 5;
      const unspent = Math.max(0, totalEarned - spent);
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: { level, experience: BigInt(0), unspentStatPoints: unspent },
      });
      MapPresenceService.invalidateCharacterCache(characterId);
      message = `🆙 Nível do personagem definido para Nv.${level} (${unspent} pts livres)!`;
    } else if (action === 'ADD_STAT_POINTS') {
      const pts = Math.max(1, Math.round(Number(body.amount) || 100));
      const updated = await prisma.playerCharacter.update({
        where: { id: characterId },
        data: { unspentStatPoints: { increment: pts } },
      });
      message = `📊 +${pts} pontos de atributo adicionados (Total livre: ${updated.unspentStatPoints})!`;
    } else if (action === 'RESET_STATS') {
      const totalPts = Math.max(0, ((char.level || 1) - 1) * 5);
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: {
          distributedStatsJson: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
          unspentStatPoints: totalPts,
        },
      });
      message = `🔄 Atributos resetados! (${totalPts} pontos disponíveis para redistribuir).`;
    } else if (action === 'SET_CLASS_OR_ELEMENT') {
      const updateData: any = {};
      if (body.classTemplateId) updateData.classTemplateId = Number(body.classTemplateId);
      if (body.elementCode) updateData.elementCode = String(body.elementCode).toUpperCase();
      await prisma.playerCharacter.update({
        where: { id: characterId },
        data: updateData,
      });
      MapPresenceService.invalidateCharacterCache(characterId);
      message = `🎭 Classe / Elemento atualizados em tempo real!`;
    } else if (action === 'GIVE_ITEM') {
      const itemTemplateId = Number(body.itemTemplateId);
      const quantity = Math.max(1, Math.min(9999, Math.round(Number(body.quantity) || 1)));
      const autoEquip = Boolean(body.autoEquip);
      const item = await prisma.itemTemplate.findUnique({ where: { id: itemTemplateId } });
      if (!item) throw new Error('Item não encontrado.');

      if (autoEquip && item.itemCategory === 'CHARACTER_EQUIPMENT' && item.equipmentSlotCode) {
        const eqMap = (char.equippedItemsJson && typeof char.equippedItemsJson === 'object'
          ? { ...(char.equippedItemsJson as Record<string, number>) }
          : {}) as Record<string, number>;
        eqMap[item.equipmentSlotCode] = item.id;
        await prisma.playerCharacter.update({
          where: { id: characterId },
          data: { equippedItemsJson: eqMap as any },
        });
        MapPresenceService.invalidateCharacterCache(characterId);
        message = `⚔️ Item equipado diretamente no slot ${item.equipmentSlotCode}!`;
      } else {
        const resAdd = await CharacterInventoryService.addItem(prisma, characterId, item.id, quantity);
        if (resAdd.added <= 0) {
          throw new Error('Mochila sem espaço livre! Use "Limpar Mochila" no Painel GM.');
        }
        message = `🎒 +${resAdd.added}x item adicionado(s) na mochila!`;
      }
    } else if (action === 'GIVE_SET') {
      const setId = Number(body.equipmentSetId);
      const mode = String(body.mode || 'BAG').toUpperCase();
      const setItems = await prisma.itemTemplate.findMany({
        where: { equipmentSetId: setId, isActive: true },
        orderBy: { id: 'asc' },
      });
      if (setItems.length === 0) throw new Error('Nenhuma peça encontrada para este conjunto.');

      const isCharSet = setItems.every((i) => i.itemCategory === 'CHARACTER_EQUIPMENT');
      if (mode === 'EQUIP' && isCharSet) {
        const eqMap = (char.equippedItemsJson && typeof char.equippedItemsJson === 'object'
          ? { ...(char.equippedItemsJson as Record<string, number>) }
          : {}) as Record<string, number>;
        for (const it of setItems) {
          if (it.equipmentSlotCode) eqMap[it.equipmentSlotCode] = it.id;
        }
        await prisma.playerCharacter.update({
          where: { id: characterId },
          data: { equippedItemsJson: eqMap as any },
        });
        MapPresenceService.invalidateCharacterCache(characterId);
        message = `👑 Conjunto completo (${setItems.length} peças) vestido instantaneamente no personagem!`;
      } else {
        let addedCount = 0;
        for (const it of setItems) {
          const r = await CharacterInventoryService.addItem(prisma, characterId, it.id, 1);
          addedCount += r.added;
        }
        message = `🎁 ${addedCount}/${setItems.length} peças do conjunto adicionadas na mochila!`;
      }
    } else if (action === 'GIVE_ALL_ESSENCES') {
      const qty = Math.max(1, Math.min(9999, Math.round(Number(body.quantity) || 3500)));
      const essences = await prisma.itemTemplate.findMany({
        where: { code: { startsWith: 'item_essencia_' } },
      });
      let addedTypes = 0;
      for (const es of essences) {
        const r = await CharacterInventoryService.addItem(prisma, characterId, es.id, qty);
        if (r.added > 0) addedTypes += 1;
      }
      message = `🧪 +${qty.toLocaleString('pt-BR')} de cada uma das ${addedTypes} Essências adicionadas na mochila!`;
    } else if (action === 'GIVE_FLIGHT_KIT') {
      const flightItems = await prisma.itemTemplate.findMany({
        where: { equipmentSlotCode: { in: ['WINGS', 'FLYING_MOUNT'] }, isActive: true },
        orderBy: { id: 'asc' },
      });
      const autoEquip = Boolean(body.autoEquip);
      if (autoEquip) {
        const eqMap = (char.equippedItemsJson && typeof char.equippedItemsJson === 'object'
          ? { ...(char.equippedItemsJson as Record<string, number>) }
          : {}) as Record<string, number>;
        for (const it of flightItems) {
          if (it.equipmentSlotCode && !eqMap[it.equipmentSlotCode]) {
            eqMap[it.equipmentSlotCode] = it.id;
          }
        }
        await prisma.playerCharacter.update({
          where: { id: characterId },
          data: { equippedItemsJson: eqMap as any },
        });
        MapPresenceService.invalidateCharacterCache(characterId);
        message = `🪽 Asa e Montaria Voadora vestidas diretamente nos slots do personagem!`;
      } else {
        let count = 0;
        for (const it of flightItems) {
          const r = await CharacterInventoryService.addItem(prisma, characterId, it.id, 1);
          count += r.added;
        }
        message = `🪽 ${count} item(ns) de Asa/Montaria Voadora adicionados na mochila!`;
      }
    } else if (action === 'CLEAR_BAG') {
      await prisma.characterInventoryItem.deleteMany({ where: { characterId } });
      message = `🗑️ Mochila esvaziada com sucesso (100/100 slots livres)!`;
    } else if (action === 'SPAWN_PET') {
      const monsterTemplateId = Number(body.monsterTemplateId);
      const level = Math.max(1, Math.min(100, Math.round(Number(body.level) || 50)));
      const elementCode = String(body.elementCode || 'FIRE').toUpperCase();
      const mob = await prisma.monsterTemplate.findUnique({ where: { id: monsterTemplateId } });
      if (!mob) throw new Error('Espécie de monstro não encontrada.');

      const rarityBonusPts: Record<string, number> = { F: 0, D: 4, C: 8, B: 14, A: 22, S: 32, SS: 45 };
      const basePts = rarityBonusPts[String(mob.rarityTier || 'F').toUpperCase()] || 0;
      const levelPts = Math.max(0, (level - 1) * 4);

      await prisma.characterPet.create({
        data: {
          characterId,
          monsterTemplateId: mob.id,
          nickname: null,
          level,
          experience: BigInt(0),
          elementCode,
          unspentStatPoints: basePts + levelPts,
          distributedStatsJson: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
          skillIdsJson: Array.isArray(mob.skillIdsJson) ? mob.skillIdsJson : [],
          equippedItemsJson: {},
        },
      });
      message = `🐾 Pet #${mob.id} (${mob.code}) Nv.${level} [${elementCode}] gerado com sucesso!`;
    } else {
      throw new Error(`Ação GM desconhecida: ${action}`);
    }

    const [updatedChar, equippedDetails, bag] = await Promise.all([
      playController.getCharacterById(userAccountId, 'ADMIN', characterId),
      CharacterEquipmentService.getCharacterEquippedDetails(prisma, characterId),
      CharacterInventoryService.getWalletAndBag(prisma, characterId),
    ]);

    return {
      ok: true,
      message,
      character: updatedChar,
      equippedDetails,
      bag,
    };
  }

  public static async handleRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    userAccountId: number,
    role: string,
    prisma: PrismaClient,
    playController: GamePlayController,
    readJsonBody: <T = any>(r: http.IncomingMessage) => Promise<T>,
    sendJson: (r: http.ServerResponse, status: number, data: unknown) => void
  ): Promise<boolean> {
    if (pathname === '/api/play/gm/sandbox/catalog' && method === 'GET') {
      if (!this.isElevatedRole(role)) {
        sendJson(res, 403, { error: 'Acesso restrito a GM/ADMIN/DEV.' });
        return true;
      }
      sendJson(res, 200, await this.getCatalog(prisma));
      return true;
    }

    if (pathname === '/api/play/gm/sandbox/action' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const result = await this.executeAction(prisma, playController, userAccountId, role, body);
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || 'Erro ao executar ação GM.' });
      }
      return true;
    }

    return false;
  }
}
