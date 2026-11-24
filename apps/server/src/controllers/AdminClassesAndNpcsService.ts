/**
 * @file apps/server/src/controllers/AdminClassesAndNpcsService.ts
 * @module @etheria/server
 * @description Serviço modular de persistência e curadoria de Templates de Classes (`class_templates`)
 *   e Templates de NPCs (`npc_templates`) para o Studio `/admin`.
 * @rules
 *   1. Centraliza operações CRUD transacionais de `class_templates` e `npc_templates` com `i18n_translations`.
 *   2. Sincroniza sequências PostgreSQL via `SnapshotManager` e grava `lowcode.snapshot.json` atomicamente.
 *   3. Executa espelhamento imediato dos sprites/atlas locais (`AssetMirrorService`) respeitando Regra #10 reforçada.
 * @dependencies @etheria/database, ./AssetMirrorService.js
 */

import { PrismaClient, SnapshotManager } from '@etheria/database';
import type { AssetMirrorService } from './AssetMirrorService.js';

export interface TeleportDestinationDto {
  label: string;
  targetMapId: number;
  targetX?: number;
  targetY?: number;
  requiredLevel?: number;
  costGold?: number;
}

export interface SaveNpcTemplateDto {
  id?: number | null;
  code?: string;
  namePtBr: string;
  mcreworkNpcKey: string;
  isDecorationOnly: boolean;
  rolesJson?: string[];
  shopTemplateId?: number | null;
  triggersJson: Array<{ type: 'QUEST' | 'SHOP' | 'BATTLE' | 'EVENT' | 'DIALOGUE'; label?: string; config?: Record<string, unknown> }>;
}

export interface SaveClassTemplateDto {
  id?: number | null;
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkCharKey: string;
  rebornMcreworkCharKey?: string | null;
  groundOffsetY?: number;
  rebornGroundOffsetY?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  rebornShadowOffsetX?: number;
  rebornShadowOffsetY?: number;
  raceCode?: string;
  combatStyle?: string;
  attackRange?: number;
  damageType?: string;
  skillIdsJson?: number[];
  isActive?: boolean;
  baseCombatAttributesJson?: Record<string, number>;
  baseAttributesJson?: Record<string, number>;
  growthPerLevelJson?: Record<string, number>;
}

export class AdminClassesAndNpcsService {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly assetMirrorService?: AssetMirrorService;
  private readonly localAssetBaseUrl = '/api/assets/mcrework';

  constructor(
    prisma: PrismaClient,
    snapshotManager: SnapshotManager,
    assetMirrorService?: AssetMirrorService
  ) {
    this.prisma = prisma;
    this.snapshotManager = snapshotManager;
    this.assetMirrorService = assetMirrorService;
  }

  /**
   * Cria ou atualiza um Template de Classe/Personagem na tabela `class_templates`
   * com auto-incremento de `id` e chave `class_N` (`class_1`, `class_2`, `class_3`...).
   */
  public async saveClassTemplate(dto: SaveClassTemplateDto, explicitId: number | null = null) {
    if (!dto.mcreworkCharKey) {
      throw new Error('Selecione um visual de Personagem da galeria do mcrework.');
    }

    const targetId = explicitId ?? (dto.id ? Number(dto.id) : null);
    const raceCode = dto.raceCode?.trim() || 'HUMAN';
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;
    const groundOffsetY = Math.round(Number(dto.groundOffsetY) || 0);
    const rebornGroundOffsetY = Math.round(Number(dto.rebornGroundOffsetY) || 0);
    const shadowOffsetX = Math.round(Number(dto.shadowOffsetX) || 0);
    const shadowOffsetY = Math.round(Number(dto.shadowOffsetY) || 0);
    const rebornShadowOffsetX = Math.round(Number(dto.rebornShadowOffsetX) || 0);
    const rebornShadowOffsetY = Math.round(Number(dto.rebornShadowOffsetY) || 0);
    const rebornMcreworkCharKey = dto.rebornMcreworkCharKey ? dto.rebornMcreworkCharKey.trim() : null;
    const combatStyle = dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE';
    const attackRange = Math.max(10, Math.min(1000, Number(dto.attackRange) || (combatStyle === 'RANGED' ? 220 : 60)));
    const damageType = dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';
    const skillIdsJson = Array.isArray(dto.skillIdsJson) ? dto.skillIdsJson.map((n) => Number(n)).filter((n) => n > 0) : undefined;

    const b = dto.baseAttributesJson || {};
    const baseAttrs = { VIT: Number(b.VIT ?? 10), STR: Number(b.STR ?? 10), INT: Number(b.INT ?? 10), WIS: Number(b.WIS ?? 10), AGI: Number(b.AGI ?? 10), DEX: Number(b.DEX ?? 10) };
    const g = dto.growthPerLevelJson || {};
    const growthAttrs = { VIT: Number(g.VIT ?? 2), STR: Number(g.STR ?? 2), INT: Number(g.INT ?? 2), WIS: Number(g.WIS ?? 2), AGI: Number(g.AGI ?? 2), DEX: Number(g.DEX ?? 2) };

    let savedClass: any;
    let finalNamePtBr = (dto.namePtBr ?? '').trim();
    let finalDescPtBr = (dto.descriptionPtBr ?? '').trim();

    await SnapshotManager.syncTableSequence(this.prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(this.prisma, 'class_templates');

    await this.prisma.$transaction(async (tx) => {
      if (targetId) {
        const autoCode = `class_${targetId}`;
        const nameKey = `class.${autoCode}.name`;
        const descKey = `class.${autoCode}.description`;
        if (!finalNamePtBr) finalNamePtBr = `Classe #${targetId}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        if (finalDescPtBr) {
          await tx.i18nTranslation.upsert({
            where: { key_locale: { key: descKey, locale: 'pt-BR' } },
            update: { text: finalDescPtBr },
            create: { key: descKey, locale: 'pt-BR', text: finalDescPtBr },
          });
        }

        savedClass = await tx.classTemplate.update({
          where: { id: targetId },
          data: {
            code: autoCode,
            mcreworkCharKey: dto.mcreworkCharKey,
            nameI18nKey: nameKey,
            descriptionI18nKey: descKey,
            rebornMcreworkCharKey,
            groundOffsetY,
            rebornGroundOffsetY,
            shadowOffsetX,
            shadowOffsetY,
            rebornShadowOffsetX,
            rebornShadowOffsetY,
            raceCode,
            combatStyle,
            attackRange,
            damageType,
            baseAttributesJson: baseAttrs as any,
            growthPerLevelJson: growthAttrs as any,
            ...(dto.baseCombatAttributesJson !== undefined ? { baseCombatAttributesJson: dto.baseCombatAttributesJson as any } : {}),
            ...(skillIdsJson !== undefined ? { skillIdsJson: skillIdsJson as any } : {}),
            isActive,
          },
        });
      } else {
        const tempCode = `class_pending_${Date.now()}`;
        const created = await tx.classTemplate.create({
          data: {
            code: tempCode,
            mcreworkCharKey: dto.mcreworkCharKey,
            nameI18nKey: `class.${tempCode}.name`,
            descriptionI18nKey: `class.${tempCode}.description`,
            rebornMcreworkCharKey,
            groundOffsetY,
            rebornGroundOffsetY,
            shadowOffsetX,
            shadowOffsetY,
            rebornShadowOffsetX,
            rebornShadowOffsetY,
            raceCode,
            combatStyle,
            attackRange,
            damageType,
            baseAttributesJson: baseAttrs as any,
            growthPerLevelJson: growthAttrs as any,
            baseCombatAttributesJson: (dto.baseCombatAttributesJson ?? {}) as any,
            skillIdsJson: (skillIdsJson ?? [1, 2, 4]) as any,
            isActive,
          },
        });

        const autoCode = `class_${created.id}`;
        const nameKey = `class.${autoCode}.name`;
        const descKey = `class.${autoCode}.description`;
        if (!finalNamePtBr) finalNamePtBr = `Classe #${created.id}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        if (finalDescPtBr) {
          await tx.i18nTranslation.upsert({
            where: { key_locale: { key: descKey, locale: 'pt-BR' } },
            update: { text: finalDescPtBr },
            create: { key: descKey, locale: 'pt-BR', text: finalDescPtBr },
          });
        }

        savedClass = await tx.classTemplate.update({
          where: { id: created.id },
          data: {
            code: autoCode,
            nameI18nKey: nameKey,
            descriptionI18nKey: descKey,
          },
        });
      }
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && savedClass?.mcreworkCharKey) {
      await this.assetMirrorService.mirrorClassAssets(savedClass.mcreworkCharKey, savedClass.rebornMcreworkCharKey);
    }
    return {
      ...savedClass,
      namePtBr: finalNamePtBr,
      descriptionPtBr: finalDescPtBr,
      thumbUrl: `${this.localAssetBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/thumb.webp`,
      atlasJsonUrl: `${this.localAssetBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/atlas.json`,
      atlasWebpUrl: `${this.localAssetBaseUrl}/assets/characters/${savedClass.mcreworkCharKey}/atlas.webp`,
      rebornThumbUrl: savedClass.rebornMcreworkCharKey
        ? `${this.localAssetBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/thumb.webp`
        : null,
      rebornAtlasJsonUrl: savedClass.rebornMcreworkCharKey
        ? `${this.localAssetBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/atlas.json`
        : null,
      rebornAtlasWebpUrl: savedClass.rebornMcreworkCharKey
        ? `${this.localAssetBaseUrl}/assets/characters/${savedClass.rebornMcreworkCharKey}/atlas.webp`
        : null,
    };
  }

  /**
   * Exclui um Template de Classe/Personagem da tabela `class_templates` (se não houver jogadores usando).
   */
  public async deleteClassTemplate(id: number) {
    const count = await this.prisma.playerCharacter.count({
      where: { classTemplateId: id },
    });
    if (count > 0) {
      throw new Error(
        `Não é possível excluir a Classe #${id} pois existem ${count} personagem(ns) de jogador utilizando ela.`
      );
    }
    await this.prisma.classTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }

  /**
   * Cria ou atualiza um Template de NPC na tabela `npc_templates` com auto-incremento de `id` e chave `npc_N`.
   */
  public async saveNpcTemplate(dto: SaveNpcTemplateDto, explicitId: number | null = null) {
    if (!dto.mcreworkNpcKey) {
      throw new Error('Selecione um visual de NPC da galeria do mcrework.');
    }

    const targetId = explicitId ?? (dto.id ? Number(dto.id) : null);
    let savedNpc: any;
    let finalNamePtBr = (dto.namePtBr ?? '').trim();

    const validRoles = ['TELEPORT', 'SHOP', 'ARMORER', 'HUNTER', 'ALCHEMIST', 'CHEF', 'MINER'];
    const rolesSet = new Set<string>(
      (Array.isArray(dto.rolesJson) ? dto.rolesJson : [])
        .map((r) => String(r || '').toUpperCase().trim())
        .filter((r) => validRoles.includes(r))
    );
    let shopTemplateId =
      dto.shopTemplateId !== null && dto.shopTemplateId !== undefined && Number(dto.shopTemplateId) > 0
        ? Math.round(Number(dto.shopTemplateId))
        : null;
    if (shopTemplateId) {
      rolesSet.add('SHOP');
    } else if (!rolesSet.has('SHOP')) {
      shopTemplateId = null;
    }
    const sanitizedRoles = Array.from(rolesSet);

    await SnapshotManager.syncTableSequence(this.prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(this.prisma, 'npc_templates');

    await this.prisma.$transaction(async (tx) => {
      if (targetId) {
        const autoCode = `npc_${targetId}`;
        const nameKey = `npc.${autoCode}.name`;
        if (!finalNamePtBr) finalNamePtBr = `NPC #${targetId}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        savedNpc = await tx.npcTemplate.update({
          where: { id: targetId },
          data: {
            code: autoCode,
            mcreworkNpcKey: dto.mcreworkNpcKey,
            nameI18nKey: nameKey,
            isDecorationOnly: Boolean(dto.isDecorationOnly),
            rolesJson: sanitizedRoles as any,
            shopTemplateId,
            triggersJson: (dto.triggersJson ?? []) as any,
          },
        });
      } else {
        const tempCode = `npc_pending_${Date.now()}`;
        const created = await tx.npcTemplate.create({
          data: {
            code: tempCode,
            mcreworkNpcKey: dto.mcreworkNpcKey,
            nameI18nKey: `npc.${tempCode}.name`,
            isDecorationOnly: Boolean(dto.isDecorationOnly),
            rolesJson: sanitizedRoles as any,
            shopTemplateId,
            triggersJson: (dto.triggersJson ?? []) as any,
          },
        });

        const autoCode = `npc_${created.id}`;
        const nameKey = `npc.${autoCode}.name`;
        if (!finalNamePtBr) finalNamePtBr = `NPC #${created.id}`;

        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          update: { text: finalNamePtBr },
          create: { key: nameKey, locale: 'pt-BR', text: finalNamePtBr },
        });

        savedNpc = await tx.npcTemplate.update({
          where: { id: created.id },
          data: {
            code: autoCode,
            nameI18nKey: nameKey,
          },
        });
      }
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && savedNpc?.mcreworkNpcKey) {
      await this.assetMirrorService.mirrorNpcAssets(savedNpc.mcreworkNpcKey);
    }
    return {
      ...savedNpc,
      namePtBr: finalNamePtBr,
      thumbUrl: `${this.localAssetBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/thumb.png`,
      atlasJsonUrl: `${this.localAssetBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/atlas.json`,
      atlasWebpUrl: `${this.localAssetBaseUrl}/assets/npcs/${savedNpc.mcreworkNpcKey}/atlas.webp`,
    };
  }

  /**
   * Exclui um NPC da tabela `npc_templates` (e automaticamente remove seus posicionamentos em `map_npcs` via Cascade).
   */
  public async deleteNpcTemplate(id: number) {
    await this.prisma.npcTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }
}
