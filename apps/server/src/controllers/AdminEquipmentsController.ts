/**
 * @file apps/server/src/controllers/AdminEquipmentsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Equipamentos e Itens (`item_templates`) no Estúdio `/admin`.
 *   - Gerenciamento dos 16 Slots de Personagem + 6 Slots de Pet (`equipment_slots`).
 *   - Integração com catálogo oficial de 1.865 equipamentos (`assets/equipment/catalog.json`) do repositório `mcrework`.
 *   - CRUD completo de templates de equipamentos no PostgreSQL com i18n em PT-BR.
 *   - Suporte a Bônus de Atributos Base (VIT, STR, INT, WIS, AGI, DEX) e Atributos de Combate da Arena Action
 *     (ATK, MATK, DEF, MDEF, Vel. Batalha, Aspd, Precisão, Desvio, Crítico e Alcance).
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import type { AssetMirrorService } from './AssetMirrorService.js';

export interface EquipmentTemplateDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkIconKey?: string;
  itemCategory?: string; // CHARACTER_EQUIPMENT | PET_EQUIPMENT
  equipmentSlotCode: string;
  rarityTier?: string; // SS, S, A, B, C, D, F, COMMON
  requiredLevel?: number;
  priceGold?: number;
  reqClassCodesJson?: string[];
  baseStatBonusesJson?: Record<string, number>;
  combatStatBonusesJson?: Record<string, number>;
  specialEffectJson?: any;
  isActive?: boolean;
}

export class AdminEquipmentsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkEquipment: any[] | null = null;
  private readonly assetMirrorService?: AssetMirrorService;

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService;
  }

  /**
   * Retorna os 22 slots de equipamento disponíveis no sistema (16 Personagem + 6 Pet)
   * enriquecidos com descrições amigáveis em português.
   */
  public async getEquipmentSlots() {
    const slots = await this.prisma.equipmentSlot.findMany({
      orderBy: [{ ownerType: 'asc' }, { slotIndex: 'asc' }],
    });

    const slotLabels: Record<string, string> = {
      HEAD: 'Elmo / Tiara / Chapéu',
      CHEST: 'Peitoral / Túnica / Armadura',
      SHOULDER: 'Ombreiras',
      BELT: 'Cinto / Faixa',
      LEGS: 'Calças / Perneiras',
      FEET: 'Botas / Sapatos',
      WEAPON_1: 'Arma Principal (Mão Primária)',
      WEAPON_2: 'Escudo / Secundária (Offhand)',
      NECKLACE: 'Colar / Amuleto',
      RING: 'Anel',
      ORNAMENT_1: 'Ornamento / Talismã I',
      ORNAMENT_2: 'Ornamento / Talismã II',
      WINGS: 'Asas Celestiais',
      FASHION: 'Traje Visual / Roupa Social',
      FISHING_ROD: 'Vara de Pesca',
      FLYING_MOUNT: 'Montaria Voadora',
      PET_EQUIP_1: 'Chifre / Elmo do Pet',
      PET_EQUIP_2: 'Sino / Orbe de Batalha do Pet',
      PET_EQUIP_3: 'Coleira Protetora do Pet',
      PET_EQUIP_4: 'Armadura de Combate do Pet',
      PET_EQUIP_5: 'Ombreiras de Fera do Pet',
      PET_EQUIP_6: 'Asas Protetoras do Pet',
    };

    return slots.map((s) => ({
      code: s.code,
      ownerType: s.ownerType,
      slotIndex: s.slotIndex,
      nameI18nKey: s.nameI18nKey,
      labelPtBr: slotLabels[s.code] || s.code,
    }));
  }

  /**
   * Busca e cacheia os 1.865 equipamentos do catálogo do `mcrework`.
   */
  public async getMcreworkEquipmentGallery() {
    if (this.cachedMcreworkEquipment) return this.cachedMcreworkEquipment;

    try {
      const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/equipment/catalog.json`);
      if (!res.ok) {
        throw new Error(`Falha ao ler catálogo de equipamentos do mcrework (${res.status})`);
      }
      const data: any = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      const positionToSlot: Record<string, string> = {
        'Elmo / Tiara': 'HEAD',
        'Peitoral / Túnica': 'CHEST',
        'Calças / Perneiras': 'LEGS',
        'Cinto': 'BELT',
        'Botas': 'FEET',
        'Ombreiras': 'SHOULDER',
        'Anel': 'RING',
        'Colar / Amuleto': 'NECKLACE',
        'Acessório I': 'ORNAMENT_1',
        'Acessório II': 'ORNAMENT_2',
        'Arma Principal': 'WEAPON_1',
        'Relíquia Divina Principal': 'WEAPON_1',
        'Arma Secundária (Offhand)': 'WEAPON_2',
        'Asas Celestiais': 'WINGS',
        'Traje Visual / Costume': 'FASHION',
        'Montaria Alada / Voo': 'FLYING_MOUNT',
        'Selo de Chifre (Pet)': 'PET_EQUIP_1',
        'Sino de Batalha (Pet)': 'PET_EQUIP_2',
        'Coleira Protetora (Pet)': 'PET_EQUIP_3',
        'Armadura de Combate (Pet)': 'PET_EQUIP_4',
        'Ombreiras de Fera (Pet)': 'PET_EQUIP_5',
        'Asas Protetoras (Pet)': 'PET_EQUIP_6',
      };

      const mapped = items.map((item: any) => {
        const rawIcon = item.icon || 'assets/equipment/icons/equip_normal_200001.png';
        const cleanIcon = rawIcon.replace(/^\/+/, '');
        const suggestedSlot = positionToSlot[item.position_name] || (item.category_group === 'pet' ? 'PET_EQUIP_1' : 'CHEST');
        const isPet = item.category_group === 'pet';

        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          categoryGroup: item.category_group,
          positionName: item.position_name,
          typeName: item.type_name,
          reqLevel: item.req_level || 1,
          quality: item.quality || 'Comum',
          stats: Array.isArray(item.stats) ? item.stats : [],
          mcreworkIconKey: cleanIcon,
          iconUrl: `${this.mcreworkPagesBaseUrl}/${cleanIcon}`,
          suggestedSlot,
          suggestedCategory: isPet ? 'PET_EQUIPMENT' : 'CHARACTER_EQUIPMENT',
        };
      });

      this.cachedMcreworkEquipment = mapped;
      return mapped;
    } catch (err: any) {
      console.error('Erro ao buscar catálogo de equipamentos do mcrework:', err);
      return [];
    }
  }

  /**
   * Lista todos os templates de itens e equipamentos cadastrados no PostgreSQL.
   */
  public async getEquipmentTemplates(categoryFilter?: string) {
    const where: any = {};
    if (categoryFilter && categoryFilter !== 'ALL') {
      where.itemCategory = categoryFilter;
    } else {
      where.itemCategory = { in: ['CHARACTER_EQUIPMENT', 'PET_EQUIPMENT'] };
    }

    const items = await this.prisma.itemTemplate.findMany({
      where,
      include: { equipmentSlot: true },
      orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
    });

    const i18nKeys = items.flatMap((i) => [i.nameI18nKey, i.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return items.map((item) => {
      const iconKey = item.mcreworkIconKey || 'assets/equipment/icons/equip_normal_200001.png';
      return {
        id: item.id,
        code: item.code,
        namePtBr: transMap.get(item.nameI18nKey) || item.code,
        descriptionPtBr: transMap.get(item.descriptionI18nKey) || '',
        mcreworkIconKey: item.mcreworkIconKey,
        iconUrl: `${this.mcreworkPagesBaseUrl}/${iconKey.replace(/^\/+/, '')}`,
        itemCategory: item.itemCategory,
        equipmentSlotCode: item.equipmentSlotCode,
        slotNamePtBr: item.equipmentSlot?.code || item.equipmentSlotCode || '',
        slotOwnerType: item.equipmentSlot?.ownerType || (item.itemCategory === 'PET_EQUIPMENT' ? 'PET' : 'CHARACTER'),
        rarityTier: item.rarityTier,
        requiredLevel: item.requiredLevel,
        priceGold: item.priceGold,
        reqClassCodesJson: item.reqClassCodesJson,
        baseStatBonusesJson: item.baseStatBonusesJson,
        combatStatBonusesJson: item.combatStatBonusesJson,
        specialEffectJson: item.specialEffectJson,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  /**
   * Cadastra um novo template de equipamento no PostgreSQL e atualiza snapshots.
   */
  public async createEquipmentTemplate(dto: EquipmentTemplateDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) {
      throw new Error('O nome do equipamento em português é obrigatório.');
    }
    if (!dto.equipmentSlotCode) {
      throw new Error('O slot de equipamento é obrigatório.');
    }

    const cleanName = dto.namePtBr.trim();
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const randSuffix = Math.random().toString(36).substring(2, 7);
    const code = dto.code && dto.code.trim() ? dto.code.trim() : `equip_${slug}_${randSuffix}`;

    const nameI18nKey = `item.${code}.name`;
    const descI18nKey = `item.${code}.desc`;

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

    const slot = await this.prisma.equipmentSlot.findUnique({ where: { code: dto.equipmentSlotCode } });
    const isPetSlot = slot?.ownerType === 'PET' || dto.equipmentSlotCode.startsWith('PET_');
    const category = dto.itemCategory || (isPetSlot ? 'PET_EQUIPMENT' : 'CHARACTER_EQUIPMENT');

    const created = await this.prisma.itemTemplate.create({
      data: {
        code,
        nameI18nKey,
        descriptionI18nKey: descI18nKey,
        mcreworkIconKey: dto.mcreworkIconKey || null,
        itemCategory: category,
        equipmentSlotCode: dto.equipmentSlotCode,
        rarityTier: dto.rarityTier || 'COMMON',
        requiredLevel: dto.requiredLevel ?? 1,
        priceGold: 0,
        reqClassCodesJson: dto.reqClassCodesJson || [],
        baseStatBonusesJson: {},
        combatStatBonusesJson: dto.combatStatBonusesJson || {},
        specialEffectJson: dto.specialEffectJson || {},
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && created.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(created.mcreworkIconKey);
    }
    return created;
  }

  /**
   * Atualiza um template de equipamento existente.
   */
  public async updateEquipmentTemplate(id: number, dto: Partial<EquipmentTemplateDto>) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Equipamento #${id} não encontrado.`);
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

    const updated = await this.prisma.itemTemplate.update({
      where: { id },
      data: {
        mcreworkIconKey: dto.mcreworkIconKey !== undefined ? dto.mcreworkIconKey : existing.mcreworkIconKey,
        itemCategory: dto.itemCategory !== undefined ? dto.itemCategory : existing.itemCategory,
        equipmentSlotCode: dto.equipmentSlotCode !== undefined ? dto.equipmentSlotCode : existing.equipmentSlotCode,
        rarityTier: dto.rarityTier !== undefined ? dto.rarityTier : existing.rarityTier,
        requiredLevel: dto.requiredLevel !== undefined ? dto.requiredLevel : existing.requiredLevel,
        priceGold: 0,
        reqClassCodesJson: dto.reqClassCodesJson !== undefined ? (dto.reqClassCodesJson as any) : existing.reqClassCodesJson,
        baseStatBonusesJson: {},
        combatStatBonusesJson: dto.combatStatBonusesJson !== undefined ? (dto.combatStatBonusesJson as any) : existing.combatStatBonusesJson,
        specialEffectJson: dto.specialEffectJson !== undefined ? (dto.specialEffectJson as any) : existing.specialEffectJson,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && updated.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(updated.mcreworkIconKey);
    }
    return updated;
  }

  /**
   * Exclui um template de equipamento e remove suas chaves de tradução.
   */
  public async deleteEquipmentTemplate(id: number) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Equipamento #${id} não encontrado.`);
    }

    await this.prisma.itemTemplate.delete({ where: { id } });
    await this.prisma.i18nTranslation.deleteMany({
      where: { key: { in: [existing.nameI18nKey, existing.descriptionI18nKey] } },
    });

    await this.snapshotManager.exportToDisk();
    return { success: true, message: `Equipamento #${id} excluído com sucesso.` };
  }

  /**
   * Semeia um catálogo inicial diversificado de 10 equipamentos emblemáticos caso a tabela esteja vazia.
   */
  public async seedInitialEquipmentsIfEmpty() {
    try {
      const count = await this.prisma.itemTemplate.count({
        where: { itemCategory: { in: ['CHARACTER_EQUIPMENT', 'PET_EQUIPMENT'] } },
      });
      if (count > 0) return;

      const seeds: EquipmentTemplateDto[] = [
        {
          code: 'equip_espada_ferro_recruta',
          namePtBr: 'Espada de Ferro do Recruta',
          descriptionPtBr: 'Lâmina afiada forjada para novos aventureiros de Etheria.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_100001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'WEAPON_1',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 50,
          reqClassCodesJson: [],
          baseStatBonusesJson: { STR: 3 },
          combatStatBonusesJson: { PHYS_ATK: 15, ATTACK_SPEED: 0.05, ATTACK_RANGE: 65 },
        },
        {
          code: 'equip_cajado_ventos_misticos',
          namePtBr: 'Cajado dos Ventos Místicos',
          descriptionPtBr: 'Canaliza correntes arcanas velozes para acelerar conjurações.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_100005.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'WEAPON_1',
          rarityTier: 'B',
          requiredLevel: 10,
          priceGold: 350,
          reqClassCodesJson: ['MAGE', 'CLERIC'],
          baseStatBonusesJson: { INT: 8, WIS: 5 },
          combatStatBonusesJson: { MAG_ATK: 35, MAG_ACCURACY: 10, ATTACK_RANGE: 220 },
        },
        {
          code: 'equip_escudo_carvalho_reforcado',
          namePtBr: 'Escudo de Carvalho Reforçado',
          descriptionPtBr: 'Madeira densa revestida em aros de ferro, bloqueia golpes físicos pesados.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_110001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'WEAPON_2',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 60,
          reqClassCodesJson: ['WARRIOR', 'PALADIN'],
          baseStatBonusesJson: { VIT: 4 },
          combatStatBonusesJson: { PHYS_DEF: 12, MAG_DEF: 8, PHYS_EVASION: 5 },
        },
        {
          code: 'equip_peitoral_malha_protetora',
          namePtBr: 'Peitoral de Malha Protetora',
          descriptionPtBr: 'Elos entrelaçados que oferecem sólida proteção corporal em escaramuças.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_210001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'CHEST',
          rarityTier: 'COMMON',
          requiredLevel: 5,
          priceGold: 120,
          baseStatBonusesJson: { VIT: 5 },
          combatStatBonusesJson: { PHYS_DEF: 25, MAG_DEF: 10, BATTLE_MOVE_SPEED: -5 },
        },
        {
          code: 'equip_tunica_seda_fadas',
          namePtBr: 'Túnica de Seda das Fadas',
          descriptionPtBr: 'Tecido encantado leve como o ar, amplia a resistência mágica e a mobilidade.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_210003.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'CHEST',
          rarityTier: 'B',
          requiredLevel: 10,
          priceGold: 400,
          baseStatBonusesJson: { INT: 6, WIS: 6 },
          combatStatBonusesJson: { MAG_DEF: 30, PHYS_DEF: 12, BATTLE_MOVE_SPEED: 10 },
        },
        {
          code: 'equip_elmo_cavaleiro_bronze',
          namePtBr: 'Elmo do Cavaleiro de Bronze',
          descriptionPtBr: 'Capacete robusto com viseira reforçada contra ataques contundentes.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_200001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'HEAD',
          rarityTier: 'C',
          requiredLevel: 8,
          priceGold: 180,
          baseStatBonusesJson: { VIT: 4, STR: 2 },
          combatStatBonusesJson: { PHYS_DEF: 15, MAG_DEF: 6 },
        },
        {
          code: 'equip_botas_aladas_mensageiro',
          namePtBr: 'Botas Aladas do Mensageiro',
          descriptionPtBr: 'Botas encantadas que conferem passadas ligeiras e velocidade de esquiva na arena.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_230001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'FEET',
          rarityTier: 'A',
          requiredLevel: 15,
          priceGold: 850,
          baseStatBonusesJson: { AGI: 10, DEX: 6 },
          combatStatBonusesJson: { BATTLE_MOVE_SPEED: 25, ATTACK_SPEED: 0.1, PHYS_EVASION: 12 },
        },
        {
          code: 'equip_anel_rubi_flamejante',
          namePtBr: 'Anel de Rubi Flamejante',
          descriptionPtBr: 'Jóia incrustada com essência do fogo que faz cada golpe pulsar com poder crítico.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_400001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'RING',
          rarityTier: 'A',
          requiredLevel: 12,
          priceGold: 700,
          baseStatBonusesJson: { STR: 6 },
          combatStatBonusesJson: { PHYS_ATK: 12, CRIT_CHANCE_PCT: 5, CRIT_DAMAGE_PCT: 15 },
        },
        {
          code: 'equip_asas_celestiais_aurora',
          namePtBr: 'Asas Celestiais da Aurora',
          descriptionPtBr: 'Plumas místicas que elevam o herói e aumentam dramaticamente a presença em combate.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_500001.png',
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: 'WINGS',
          rarityTier: 'S',
          requiredLevel: 20,
          priceGold: 2500,
          baseStatBonusesJson: { VIT: 12, AGI: 12, DEX: 8 },
          combatStatBonusesJson: { BATTLE_MOVE_SPEED: 35, ATTACK_SPEED: 0.15, PHYS_EVASION: 15, MAG_EVASION: 15 },
        },
        {
          code: 'equip_selo_batalha_pet',
          namePtBr: 'Selo de Batalha do Pet Guardião',
          descriptionPtBr: 'Amuleto energizado que potencializa o vigor e a força de ataque do pet companheiro.',
          mcreworkIconKey: 'assets/equipment/icons/equip_normal_600001.png',
          itemCategory: 'PET_EQUIPMENT',
          equipmentSlotCode: 'PET_EQUIP_2',
          rarityTier: 'C',
          requiredLevel: 1,
          priceGold: 200,
          baseStatBonusesJson: { STR: 5, VIT: 5 },
          combatStatBonusesJson: { PHYS_ATK: 18, PHYS_DEF: 14, BATTLE_MOVE_SPEED: 10 },
        },
      ];

      for (const s of seeds) {
        await this.createEquipmentTemplate(s);
      }
      console.log('✅ [AdminEquipmentsController] 10 equipamentos iniciais semeados com sucesso.');
    } catch (err: any) {
      console.warn('Aviso ao semear equipamentos iniciais:', err?.message || err);
    }
  }
}
