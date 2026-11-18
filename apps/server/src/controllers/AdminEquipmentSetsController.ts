/**
 * @file apps/server/src/controllers/AdminEquipmentSetsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Conjuntos de Equipamentos (`equipment_sets`) no Estúdio `/admin`.
 *   - Gerenciamento dos Conjuntos de Equipamentos do jogo.
 *   - Regra Canônica de Bônus:
 *     * 100% de Peças Equipadas (12 peças) = Concede 100% do bônus de combate do conjunto.
 *     * 50% de Peças Equipadas (6 peças) = Concede 40% do bônus de combate, permitindo ao jogador
 *       combinar 2 conjuntos (6 + 6) abrindo mão de 20% do bônus máximo pela versatilidade híbrida.
 *   - CRUD completo de conjuntos no PostgreSQL com suporte a i18n (`pt-BR`).
 *   - Sincronização automática com snapshots JSON (`lowcode.snapshot.json`).
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, SRP, Cláusula 0).
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface EquipmentSetDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  requiredLevel?: number;
  rarityTier?: string; // COMMON, RARE, EPIC, LEGENDARY, MYTHIC
  minPiecesFull?: number; // Padrão: 12
  minPiecesHalf?: number; // Padrão: 6
  halfBonusRatioPct?: number; // Padrão: 40.0 (%)
  fullBonusRatioPct?: number; // Padrão: 100.0 (%)
  bonusCombatStatsJson?: Record<string, number>;
  bonusSpecialEffectsJson?: Record<string, any>;
  isActive?: boolean;
}

export class AdminEquipmentSetsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Lista todos os conjuntos de equipamentos cadastrados no PostgreSQL.
   */
  public async getEquipmentSets() {
    const sets = await (this.prisma as any).equipmentSet.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
    });

    const i18nKeys = sets.flatMap((s: any) => [s.nameI18nKey, s.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return sets.map((s: any) => ({
      id: s.id,
      code: s.code,
      namePtBr: transMap.get(s.nameI18nKey) || s.code,
      descriptionPtBr: transMap.get(s.descriptionI18nKey) || '',
      requiredLevel: s.requiredLevel,
      rarityTier: s.rarityTier,
      minPiecesFull: s.minPiecesFull,
      minPiecesHalf: s.minPiecesHalf,
      halfBonusRatioPct: s.halfBonusRatioPct,
      fullBonusRatioPct: s.fullBonusRatioPct,
      bonusCombatStatsJson: s.bonusCombatStatsJson || {},
      bonusSpecialEffectsJson: s.bonusSpecialEffectsJson || {},
      piecesCount: s._count?.items || 0,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Obtém detalhes de um conjunto específico, incluindo a lista de peças vinculadas.
   */
  public async getEquipmentSetById(id: number) {
    const s = await (this.prisma as any).equipmentSet.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          select: {
            id: true,
            code: true,
            nameI18nKey: true,
            equipmentSlotCode: true,
            mcreworkIconKey: true,
            rarityTier: true,
            requiredLevel: true,
          },
        },
      },
    });

    if (!s) {
      throw new Error(`Conjunto de equipamentos #${id} não encontrado.`);
    }

    const itemKeys = s.items.map((it: any) => it.nameI18nKey);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: [s.nameI18nKey, s.descriptionI18nKey, ...itemKeys] }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return {
      id: s.id,
      code: s.code,
      namePtBr: transMap.get(s.nameI18nKey) || s.code,
      descriptionPtBr: transMap.get(s.descriptionI18nKey) || '',
      requiredLevel: s.requiredLevel,
      rarityTier: s.rarityTier,
      minPiecesFull: s.minPiecesFull,
      minPiecesHalf: s.minPiecesHalf,
      halfBonusRatioPct: s.halfBonusRatioPct,
      fullBonusRatioPct: s.fullBonusRatioPct,
      bonusCombatStatsJson: s.bonusCombatStatsJson || {},
      bonusSpecialEffectsJson: s.bonusSpecialEffectsJson || {},
      isActive: s.isActive,
      items: s.items.map((it: any) => ({
        id: it.id,
        code: it.code,
        namePtBr: transMap.get(it.nameI18nKey) || it.code,
        equipmentSlotCode: it.equipmentSlotCode,
        mcreworkIconKey: it.mcreworkIconKey,
        rarityTier: it.rarityTier,
        requiredLevel: it.requiredLevel,
      })),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  /**
   * Cadastra um novo conjunto de equipamentos.
   */
  public async createEquipmentSet(dto: EquipmentSetDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) {
      throw new Error('O nome do conjunto em português é obrigatório.');
    }

    await SnapshotManager.syncTableSequence(this.prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(this.prisma, 'equipment_sets');

    const cleanName = dto.namePtBr.trim();
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'set';

    let code = dto.code && dto.code.trim() ? dto.code.trim() : `set_${slug}_${Math.random().toString(36).substring(2, 6)}`;
    while (await (this.prisma as any).equipmentSet.findUnique({ where: { code }, select: { id: true } })) {
      code = `set_${slug}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const nameI18nKey = `equipment_set.${code}.name`;
    const descI18nKey = `equipment_set.${code}.desc`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameI18nKey, locale: 'pt-BR' } },
      update: { text: cleanName },
      create: { key: nameI18nKey, locale: 'pt-BR', text: cleanName },
    });

    if (dto.descriptionPtBr) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descI18nKey, locale: 'pt-BR' } },
        update: { text: dto.descriptionPtBr.trim() },
        create: { key: descI18nKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
      });
    }

    const created = await (this.prisma as any).equipmentSet.create({
      data: {
        code,
        nameI18nKey,
        descriptionI18nKey: descI18nKey,
        requiredLevel: dto.requiredLevel ?? 1,
        rarityTier: dto.rarityTier || 'COMMON',
        minPiecesFull: dto.minPiecesFull ?? 12,
        minPiecesHalf: dto.minPiecesHalf ?? 6,
        halfBonusRatioPct: dto.halfBonusRatioPct ?? 40.0,
        fullBonusRatioPct: dto.fullBonusRatioPct ?? 100.0,
        bonusCombatStatsJson: dto.bonusCombatStatsJson || {},
        bonusSpecialEffectsJson: dto.bonusSpecialEffectsJson || {},
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza um conjunto existente.
   */
  public async updateEquipmentSet(id: number, dto: Partial<EquipmentSetDto>) {
    const existing = await (this.prisma as any).equipmentSet.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      throw new Error(`Conjunto de equipamentos #${id} não encontrado.`);
    }

    if (dto.namePtBr && dto.namePtBr.trim()) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: existing.nameI18nKey, locale: 'pt-BR' } },
        update: { text: dto.namePtBr.trim() },
        create: { key: existing.nameI18nKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
      });
    }

    if (dto.descriptionPtBr !== undefined) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: existing.descriptionI18nKey, locale: 'pt-BR' } },
        update: { text: dto.descriptionPtBr.trim() },
        create: { key: existing.descriptionI18nKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
      });
    }

    const updated = await (this.prisma as any).equipmentSet.update({
      where: { id: Number(id) },
      data: {
        requiredLevel: dto.requiredLevel !== undefined ? dto.requiredLevel : existing.requiredLevel,
        rarityTier: dto.rarityTier !== undefined ? dto.rarityTier : existing.rarityTier,
        minPiecesFull: dto.minPiecesFull !== undefined ? dto.minPiecesFull : existing.minPiecesFull,
        minPiecesHalf: dto.minPiecesHalf !== undefined ? dto.minPiecesHalf : existing.minPiecesHalf,
        halfBonusRatioPct: dto.halfBonusRatioPct !== undefined ? dto.halfBonusRatioPct : existing.halfBonusRatioPct,
        fullBonusRatioPct: dto.fullBonusRatioPct !== undefined ? dto.fullBonusRatioPct : existing.fullBonusRatioPct,
        bonusCombatStatsJson: dto.bonusCombatStatsJson !== undefined ? dto.bonusCombatStatsJson : existing.bonusCombatStatsJson,
        bonusSpecialEffectsJson: dto.bonusSpecialEffectsJson !== undefined ? dto.bonusSpecialEffectsJson : existing.bonusSpecialEffectsJson,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  /**
   * Exclui um conjunto de equipamentos, desvinculando os itens que pertenciam a ele.
   */
  public async deleteEquipmentSet(id: number) {
    const existing = await (this.prisma as any).equipmentSet.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      throw new Error(`Conjunto de equipamentos #${id} não encontrado.`);
    }

    // Desvincula os itens vinculados a este conjunto (não os apaga!)
    await this.prisma.itemTemplate.updateMany({
      where: { equipmentSetId: Number(id) },
      data: { equipmentSetId: null },
    });

    await (this.prisma as any).equipmentSet.delete({
      where: { id: Number(id) },
    });

    await this.prisma.i18nTranslation.deleteMany({
      where: { key: { in: [existing.nameI18nKey, existing.descriptionI18nKey] } },
    });

    await this.snapshotManager.exportToDisk();
    return { success: true, message: `Conjunto #${id} excluído e itens desvinculados com sucesso.` };
  }
}
