/**
 * @file apps/server/src/controllers/AdminFlyingMountsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Montarias Voadoras (`flying_mount_templates`) no Estúdio `/admin`.
 *   - Integração com catálogo de sprites 2.5D animados (`assets/mounts/catalog.json`) do repositório `mcrework`.
 *   - CRUD completo de templates de montarias voadoras no PostgreSQL com i18n em PT-BR.
 *   - Configuração de Tiers de voo (1 a 10), Bônus de Velocidade (%) e Altitude de Voo (px).
 *   - Calibração de distância dos pés ao solo (`groundOffsetY`) e ponto de ancoragem do cavaleiro (`riderOffsetY`).
 *   - Suporte a Bônus de Atributos Base e Atributos de Combate concedidos ao herói montado.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface FlyingMountTemplateDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkMountKey: string;
  tier?: number;
  rarityTier?: string;
  mountType?: string;
  speedBonusPct?: number;
  flightAltitude?: number;
  staminaMax?: number;
  groundOffsetY?: number;
  riderOffsetY?: number;
  requiredLevel?: number;
  priceGold?: number;
  baseAttributesJson?: Record<string, number>;
  combatAttributesJson?: Record<string, number>;
  specialSkillsJson?: any[];
  isActive?: boolean;
}

export class AdminFlyingMountsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkMounts: any[] | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Busca e cacheia o catálogo de montarias e criaturas com spritesheet 2.5D do repositório `mcrework`.
   */
  public async getMcreworkMountsGallery() {
    if (this.cachedMcreworkMounts) return this.cachedMcreworkMounts;

    try {
      const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/mounts/catalog.json`);
      if (!res.ok) {
        throw new Error(`Falha ao ler catálogo de montarias do mcrework (${res.status})`);
      }
      const data: any = await res.json();
      const rawList = Array.isArray(data.mounts) ? data.mounts : [];

      const mapped = rawList.map((m: any) => {
        const cleanId = m.id;
        return {
          id: cleanId,
          name: m.name,
          tier: m.tier || 1,
          type: m.type || 'male_mount',
          feetY: m.feet_y || 100,
          anchor: m.anchor || [0.5, 0.85],
          thumbUrl: `${this.mcreworkPagesBaseUrl}/${(m.thumb || `assets/mounts/${cleanId}/thumb.webp`).replace(/^\/+/, '')}`,
          atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/${(m.json || `assets/mounts/${cleanId}/atlas.json`).replace(/^\/+/, '')}`,
          atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/${(m.atlas || `assets/mounts/${cleanId}/atlas.webp`).replace(/^\/+/, '')}`,
        };
      });

      this.cachedMcreworkMounts = mapped;
      return mapped;
    } catch (err: any) {
      console.error('Erro ao buscar catálogo de montarias do mcrework:', err);
      return [];
    }
  }

  /**
   * Lista todos os templates de montarias voadoras cadastrados no PostgreSQL.
   */
  public async getFlyingMountTemplates(mountType?: string) {
    const whereClause: any = {};
    if (mountType) {
      whereClause.mountType = mountType;
    }
    const mounts = await this.prisma.flyingMountTemplate.findMany({
      where: whereClause,
      orderBy: [{ tier: 'asc' }, { id: 'asc' }],
    });

    const i18nKeys = mounts.flatMap((m) => [m.nameI18nKey, m.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return mounts.map((m) => {
      const key = m.mcreworkMountKey || 'mount_000001';
      return {
        id: m.id,
        code: m.code,
        namePtBr: transMap.get(m.nameI18nKey) || m.code,
        descriptionPtBr: transMap.get(m.descriptionI18nKey) || '',
        mcreworkMountKey: m.mcreworkMountKey,
        tier: m.tier,
        rarityTier: m.rarityTier,
        mountType: m.mountType,
        speedBonusPct: m.speedBonusPct,
        flightAltitude: m.flightAltitude,
        staminaMax: m.staminaMax,
        groundOffsetY: m.groundOffsetY,
        riderOffsetY: m.riderOffsetY,
        requiredLevel: m.requiredLevel,
        priceGold: m.priceGold,
        baseAttributesJson: m.baseAttributesJson,
        combatAttributesJson: m.combatAttributesJson,
        specialSkillsJson: m.specialSkillsJson,
        isActive: m.isActive,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/mounts/${key}/thumb.webp`,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/mounts/${key}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/mounts/${key}/atlas.webp`,
      };
    });
  }

  /**
   * Cadastra um novo template de montaria voadora no PostgreSQL.
   */
  public async createFlyingMountTemplate(dto: FlyingMountTemplateDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) {
      throw new Error('O nome da montaria em português é obrigatório.');
    }
    if (!dto.mcreworkMountKey) {
      throw new Error('O modelo visual da montaria (mcrework) é obrigatório.');
    }

    const cleanName = dto.namePtBr.trim();
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const randSuffix = Math.random().toString(36).substring(2, 7);
    const code = dto.code && dto.code.trim() ? dto.code.trim() : `mount_${slug}_${randSuffix}`;

    const nameI18nKey = `mount.${code}.name`;
    const descI18nKey = `mount.${code}.desc`;

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

    const created = await this.prisma.flyingMountTemplate.create({
      data: {
        code,
        mcreworkMountKey: dto.mcreworkMountKey,
        nameI18nKey,
        descriptionI18nKey: descI18nKey,
        tier: dto.tier ?? 1,
        rarityTier: dto.rarityTier || 'COMMON',
        mountType: dto.mountType || 'FLYING',
        speedBonusPct: dto.speedBonusPct ?? 30.0,
        flightAltitude: dto.flightAltitude ?? 45.0,
        staminaMax: dto.staminaMax ?? 100,
        groundOffsetY: dto.groundOffsetY ?? 0,
        riderOffsetY: dto.riderOffsetY ?? -40,
        requiredLevel: dto.requiredLevel ?? 1,
        priceGold: dto.priceGold ?? 1000,
        baseAttributesJson: dto.baseAttributesJson || {},
        combatAttributesJson: dto.combatAttributesJson || {},
        specialSkillsJson: dto.specialSkillsJson || [],
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza um template de montaria voadora existente.
   */
  public async updateFlyingMountTemplate(id: number, dto: Partial<FlyingMountTemplateDto>) {
    const existing = await this.prisma.flyingMountTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Montaria #${id} não encontrada.`);
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

    const updated = await this.prisma.flyingMountTemplate.update({
      where: { id },
      data: {
        mcreworkMountKey: dto.mcreworkMountKey !== undefined ? dto.mcreworkMountKey : existing.mcreworkMountKey,
        tier: dto.tier !== undefined ? dto.tier : existing.tier,
        rarityTier: dto.rarityTier !== undefined ? dto.rarityTier : existing.rarityTier,
        mountType: dto.mountType !== undefined ? dto.mountType : existing.mountType,
        speedBonusPct: dto.speedBonusPct !== undefined ? dto.speedBonusPct : existing.speedBonusPct,
        flightAltitude: dto.flightAltitude !== undefined ? dto.flightAltitude : existing.flightAltitude,
        staminaMax: dto.staminaMax !== undefined ? dto.staminaMax : existing.staminaMax,
        groundOffsetY: dto.groundOffsetY !== undefined ? dto.groundOffsetY : existing.groundOffsetY,
        riderOffsetY: dto.riderOffsetY !== undefined ? dto.riderOffsetY : existing.riderOffsetY,
        requiredLevel: dto.requiredLevel !== undefined ? dto.requiredLevel : existing.requiredLevel,
        priceGold: dto.priceGold !== undefined ? dto.priceGold : existing.priceGold,
        baseAttributesJson: dto.baseAttributesJson !== undefined ? (dto.baseAttributesJson as any) : existing.baseAttributesJson,
        combatAttributesJson: dto.combatAttributesJson !== undefined ? (dto.combatAttributesJson as any) : existing.combatAttributesJson,
        specialSkillsJson: dto.specialSkillsJson !== undefined ? (dto.specialSkillsJson as any) : existing.specialSkillsJson,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  /**
   * Exclui um template de montaria e suas traduções.
   */
  public async deleteFlyingMountTemplate(id: number) {
    const existing = await this.prisma.flyingMountTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Montaria #${id} não encontrada.`);
    }

    await this.prisma.flyingMountTemplate.delete({ where: { id } });
    await this.prisma.i18nTranslation.deleteMany({
      where: { key: { in: [existing.nameI18nKey, existing.descriptionI18nKey] } },
    });

    await this.snapshotManager.exportToDisk();
    return { success: true, message: `Montaria #${id} excluída com sucesso.` };
  }

  /**
   * Semeia 5 montarias voadoras clássicas quando a tabela estiver vazia.
   */
  public async seedInitialFlyingMountsIfEmpty() {
    try {
      const count = await this.prisma.flyingMountTemplate.count();
      if (count > 0) return;

      const seeds: FlyingMountTemplateDto[] = [
        {
          code: 'mount_passaro_alado_sangue',
          namePtBr: 'Pássaro Alado de Sangue',
          descriptionPtBr: 'Criatura alada de penas rubras, sobrevoa rios e terrenos acidentados com agilidade.',
          mcreworkMountKey: 'mount_000003',
          tier: 3,
          rarityTier: 'B',
          mountType: 'FLYING',
          speedBonusPct: 35.0,
          flightAltitude: 38.0,
          staminaMax: 120,
          groundOffsetY: 0,
          riderOffsetY: -45,
          requiredLevel: 10,
          priceGold: 1200,
          baseAttributesJson: { AGI: 8, DEX: 5 },
          combatAttributesJson: { BATTLE_MOVE_SPEED: 15, PHYS_EVASION: 8 },
        },
        {
          code: 'mount_leao_dragao_celeste',
          namePtBr: 'Leão Dragão Celeste',
          descriptionPtBr: 'Fera majestosa com crina de nuvens celestiais capaz de planar sobre obstáculos.',
          mcreworkMountKey: 'mount_000005',
          tier: 5,
          rarityTier: 'A',
          mountType: 'DIVINE',
          speedBonusPct: 50.0,
          flightAltitude: 45.0,
          staminaMax: 150,
          groundOffsetY: 0,
          riderOffsetY: -50,
          requiredLevel: 20,
          priceGold: 3500,
          baseAttributesJson: { STR: 12, VIT: 10 },
          combatAttributesJson: { BATTLE_MOVE_SPEED: 25, PHYS_DEF: 20, MAG_DEF: 15 },
        },
        {
          code: 'mount_raposa_espectral_alada',
          namePtBr: 'Raposa Espectral Fantasma',
          descriptionPtBr: 'Espírito translúcido que flutua graciosamente nas brisas etéreas.',
          mcreworkMountKey: 'mount_dress_010016',
          tier: 8,
          rarityTier: 'S',
          mountType: 'DIVINE',
          speedBonusPct: 75.0,
          flightAltitude: 55.0,
          staminaMax: 200,
          groundOffsetY: 0,
          riderOffsetY: -55,
          requiredLevel: 30,
          priceGold: 8000,
          baseAttributesJson: { INT: 16, WIS: 14, AGI: 12 },
          combatAttributesJson: { BATTLE_MOVE_SPEED: 35, MAG_ACCURACY: 15, MAG_EVASION: 18 },
        },
        {
          code: 'mount_dragao_sagrado_soberano',
          namePtBr: 'Dragão Sagrado Soberano',
          descriptionPtBr: 'Dragão lendário que corta os céus em alta velocidade, dominando o espaço aéreo.',
          mcreworkMountKey: 'mount_dress_010019',
          tier: 10,
          rarityTier: 'SS',
          mountType: 'MYTHIC',
          speedBonusPct: 100.0,
          flightAltitude: 70.0,
          staminaMax: 300,
          groundOffsetY: 0,
          riderOffsetY: -65,
          requiredLevel: 40,
          priceGold: 25000,
          baseAttributesJson: { STR: 20, INT: 20, VIT: 20, AGI: 20 },
          combatAttributesJson: { BATTLE_MOVE_SPEED: 45, ATTACK_SPEED: 0.15, PHYS_ATK: 35, MAG_ATK: 35 },
        },
        {
          code: 'mount_suprema_eternidade',
          namePtBr: 'Montaria Suprema da Eternidade',
          descriptionPtBr: 'A montaria mítica definitiva, forjada com luz estelar infinita e asas reluzentes.',
          mcreworkMountKey: 'mount_dress_010020',
          tier: 10,
          rarityTier: 'SS',
          mountType: 'MYTHIC',
          speedBonusPct: 120.0,
          flightAltitude: 85.0,
          staminaMax: 500,
          groundOffsetY: 0,
          riderOffsetY: -75,
          requiredLevel: 50,
          priceGold: 50000,
          baseAttributesJson: { VIT: 30, STR: 25, INT: 25, WIS: 25, AGI: 25, DEX: 25 },
          combatAttributesJson: { BATTLE_MOVE_SPEED: 55, ATTACK_SPEED: 0.25, PHYS_DEF: 50, MAG_DEF: 50 },
        },
      ];

      for (const s of seeds) {
        await this.createFlyingMountTemplate(s);
      }
      console.log('✅ [AdminFlyingMountsController] 5 montarias voadoras iniciais semeadas com sucesso.');
    } catch (err: any) {
      console.warn('Aviso ao semear montarias voadoras:', err?.message || err);
    }
  }
}
