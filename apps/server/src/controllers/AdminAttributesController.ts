/**
 * @file apps/server/src/controllers/AdminAttributesController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Atributos Base, Atributos de Combate
 *   e da Matriz Procedural de Conversão (`attribute_conversions`) no Estúdio `/admin`.
 *   - Permite visualizar e calibrar a relação de conversão entre Atributos Base e Atributos de Combate.
 *   - Atualiza atributos derivados de combate (incluindo Precisão/Esquiva, Controle e Anomalias).
 *   - Dispara exportação de snapshot para manter paridade no Git.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface UpdateConversionDto {
  baseAttributeCode: string;
  combatAttributeCode: string;
  ratioPerPoint: number;
}

export interface UpdateCombatAttributeDto {
  namePtBr?: string;
  baseDefault?: number;
  isPercentage?: boolean;
}

export class AdminAttributesController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Retorna os 6 Atributos Base, os 21 Atributos de Combate e toda a Matriz de Conversão Procedural.
   */
  public async getAttributesData() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const baseAttributes = (await this.prisma.baseAttribute.findMany({ orderBy: { code: 'asc' } })).map((ba) => ({
      code: ba.code,
      namePtBr: i18nMap.get(ba.nameI18nKey) ?? ba.code,
      descriptionPtBr: i18nMap.get(ba.descriptionI18nKey) ?? '',
    }));

    const combatAttributes = (await this.prisma.combatAttribute.findMany({ orderBy: { code: 'asc' } })).map((ca) => ({
      code: ca.code,
      namePtBr: i18nMap.get(ca.nameI18nKey) ?? ca.code,
      baseDefault: ca.baseDefault,
      isPercentage: ca.isPercentage,
    }));

    const conversions = await this.prisma.attributeConversion.findMany({
      orderBy: [{ baseAttributeCode: 'asc' }, { combatAttributeCode: 'asc' }],
    });

    return {
      baseAttributes,
      combatAttributes,
      attributeConversions: conversions,
    };
  }

  /**
   * Salva ou atualiza a taxa de conversão entre um Atributo Base e um Atributo de Combate.
   */
  public async updateConversion(dto: UpdateConversionDto) {
    const { baseAttributeCode, combatAttributeCode, ratioPerPoint } = dto;
    if (!baseAttributeCode || !combatAttributeCode) {
      throw new Error('Atributo Base e Atributo de Combate são obrigatórios.');
    }

    const updated = await this.prisma.attributeConversion.upsert({
      where: {
        baseAttributeCode_combatAttributeCode: {
          baseAttributeCode,
          combatAttributeCode,
        },
      },
      update: {
        ratioPerPoint: Number(ratioPerPoint) || 0,
      },
      create: {
        baseAttributeCode,
        combatAttributeCode,
        ratioPerPoint: Number(ratioPerPoint) || 0,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  /**
   * Atualiza múltiplas conversões em lote com transação atômica.
   */
  public async batchUpdateConversions(items: UpdateConversionDto[]) {
    if (!Array.isArray(items)) {
      throw new Error('Lista de conversões inválida.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.baseAttributeCode || !item.combatAttributeCode) continue;
        await tx.attributeConversion.upsert({
          where: {
            baseAttributeCode_combatAttributeCode: {
              baseAttributeCode: item.baseAttributeCode,
              combatAttributeCode: item.combatAttributeCode,
            },
          },
          update: {
            ratioPerPoint: Number(item.ratioPerPoint) || 0,
          },
          create: {
            baseAttributeCode: item.baseAttributeCode,
            combatAttributeCode: item.combatAttributeCode,
            ratioPerPoint: Number(item.ratioPerPoint) || 0,
          },
        });
      }
    });

    await this.snapshotManager.exportToDisk();
    return { success: true, count: items.length };
  }

  /**
   * Atualiza a base padrão e o nome traduzido de um Atributo de Combate.
   */
  public async updateCombatAttribute(code: string, dto: UpdateCombatAttributeDto) {
    const existing = await this.prisma.combatAttribute.findUnique({ where: { code } });
    if (!existing) {
      throw new Error(`Atributo de combate ${code} não encontrado.`);
    }

    const nameKey = existing.nameI18nKey;
    if (dto.namePtBr && dto.namePtBr.trim()) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
        update: { text: dto.namePtBr.trim() },
        create: { key: nameKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
      });
    }

    let finalBaseDefault = dto.baseDefault !== undefined ? Number(dto.baseDefault) : existing.baseDefault;

    // Aplica tetos de segurança e normalização para atributos percentuais
    if (code === 'PHYS_EVASION' || code === 'MAG_EVASION') {
      if (finalBaseDefault > 1.0) finalBaseDefault /= 100;
      finalBaseDefault = Math.max(0, Math.min(0.75, finalBaseDefault)); // Teto de 75% (ninguém é inalvejável)
    } else if (code === 'PHYS_ACCURACY' || code === 'MAG_ACCURACY') {
      if (finalBaseDefault > 2.0) finalBaseDefault /= 100;
      finalBaseDefault = Math.max(0.20, Math.min(1.25, finalBaseDefault)); // Teto de 125%
    } else if (code === 'CRIT_RATE') {
      if (finalBaseDefault > 1.0) finalBaseDefault /= 100;
      finalBaseDefault = Math.max(0.01, Math.min(0.80, finalBaseDefault)); // Teto de 80%
    } else if (code === 'CRIT_DMG') {
      if (finalBaseDefault > 5.0) finalBaseDefault /= 100;
      finalBaseDefault = Math.max(1.00, Math.min(3.00, finalBaseDefault)); // Teto de 300%
    }

    const updated = await this.prisma.combatAttribute.update({
      where: { code },
      data: {
        baseDefault: finalBaseDefault,
        isPercentage: dto.isPercentage !== undefined ? Boolean(dto.isPercentage) : existing.isPercentage,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }
}
