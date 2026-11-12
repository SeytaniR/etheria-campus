/**
 * @file apps/server/src/controllers/AdminPetsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Pets (`pet_templates`) no Estúdio `/admin`.
 *   - Integração com catálogo de criaturas/pets do repositório `mcrework` (106 pets curados ou 543 criaturas).
 *   - CRUD completo de templates de pets no PostgreSQL com i18n em PT-BR.
 *   - Associação com Raça, Elemento Recomendado, Raridade, Função Tática de Combate (Role).
 *   - Atributos Base e Atributos de Combate em Tempo Real (Vel. Batalha, Vel. Ataque, Precisão, Desvio).
 *   - Calibração de distância dos pés ao solo (`groundOffsetY`).
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import type { AssetMirrorService } from './AssetMirrorService.js';

export interface PetTemplateDto {
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkPetKey: string;
  groundOffsetY?: number;
  raceCode: string;
  recommendedElementCode?: string;
  rarityTier?: string;
  role?: string;
  combatStyle?: string;
  attackRange?: number;
  damageType?: string;
  catchRatePct?: number;
  isActive?: boolean;
  skillIdsJson?: number[];
  baseAttributesJson: {
    VIT: number;
    STR: number;
    INT: number;
    WIS: number;
    AGI: number;
    DEX: number;
  };
  baseCombatAttributesJson?: {
    BATTLE_MOVE_SPEED?: number;
    ATTACK_SPEED?: number;
    PHYS_ACCURACY?: number;
    PHYS_EVASION?: number;
    MAG_ACCURACY?: number;
    MAG_EVASION?: number;
    CRIT_RATE?: number;
    CRIT_DMG?: number;
  };
}

export class AdminPetsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkPets: any[] | null = null;
  private readonly assetMirrorService?: AssetMirrorService;

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService;
  }

  /**
   * Busca e cacheia o catálogo de pets e criaturas do repositório `mcrework`.
   */
  public async getMcreworkPetsGallery() {
    if (this.cachedMcreworkPets) return this.cachedMcreworkPets;

    const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/monsters/catalog.json`);
    if (!res.ok) {
      throw new Error(`Falha ao ler catálogo de pets do mcrework (${res.status})`);
    }

    const data = (await res.json()) as { monsters?: any[] };
    const rawList = data.monsters || [];
    const seenKeys = new Set<string>();
    const cleanList: any[] = [];

    for (const m of rawList) {
      if (!m || !m.id || seenKeys.has(m.id)) continue;
      seenKeys.add(m.id);

      cleanList.push({
        mcreworkPetKey: m.id,
        suggestedName: m.real_name || m.name || m.id,
        category: m.category || (m.is_pet ? 'pet' : 'monster'),
        isOfficialPet: !!(m.is_pet || m.category === 'pet'),
        width: m.width || 100,
        height: m.height || 100,
        feetY: m.feet_y || Math.round(m.height * 0.9),
        anchor: Array.isArray(m.anchor) ? m.anchor : [0.5, 0.95],
        thumbUrl: `${this.mcreworkPagesBaseUrl}/${m.thumb}`,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/${m.path}`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${m.id}/atlas.webp`,
      });
    }

    this.cachedMcreworkPets = cleanList;
    return cleanList;
  }

  /**
   * Retorna todos os templates de pets cadastrados no banco com nomes traduzidos e metadados.
   */
  public async getPetTemplates() {
    await this.seedInitialPetsIfEmpty();

    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const pets = await this.prisma.petTemplate.findMany({
      orderBy: { id: 'asc' },
      include: {
        race: true,
        recommendedElement: true,
      },
    });

    return pets.map((p) => {
      const name = i18nMap.get(p.nameI18nKey) || p.code;
      const desc = p.descriptionI18nKey ? i18nMap.get(p.descriptionI18nKey) || '' : '';
      const thumbUrl = `${this.mcreworkPagesBaseUrl}/assets/monsters/${p.mcreworkPetKey}/thumb.webp`;
      const atlasJsonUrl = `${this.mcreworkPagesBaseUrl}/assets/monsters/${p.mcreworkPetKey}/atlas.json`;
      const atlasWebpUrl = `${this.mcreworkPagesBaseUrl}/assets/monsters/${p.mcreworkPetKey}/atlas.webp`;

      return {
        id: p.id,
        code: p.code,
        namePtBr: name,
        descriptionPtBr: desc,
        mcreworkPetKey: p.mcreworkPetKey,
        groundOffsetY: p.groundOffsetY,
        raceCode: p.raceCode,
        raceNamePtBr: i18nMap.get(p.race.nameI18nKey) || p.raceCode,
        recommendedElementCode: p.recommendedElementCode,
        recommendedElementNamePtBr: i18nMap.get(p.recommendedElement.nameI18nKey) || p.recommendedElementCode,
        rarityTier: p.rarityTier,
        role: p.role,
        catchRatePct: p.catchRatePct,
        baseAttributesJson: p.baseAttributesJson,
        baseCombatAttributesJson: p.baseCombatAttributesJson || {},
        skillIdsJson: p.skillIdsJson,
        isActive: p.isActive,
        thumbUrl,
        atlasJsonUrl,
        atlasWebpUrl,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
  }

  /**
   * Cria um novo template de Pet.
   */
  public async createPetTemplate(dto: PetTemplateDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) throw new Error('O nome do pet em português é obrigatório.');
    if (!dto.mcreworkPetKey || !dto.mcreworkPetKey.trim()) throw new Error('Selecione um asset do mcrework.');
    if (!dto.raceCode) throw new Error('A raça do pet é obrigatória.');

    const cleanName = dto.namePtBr.trim();
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const code = `pet_${slug}_${Date.now().toString(36)}`;
    const nameKey = `pet.${code}.name`;
    const descKey = `pet.${code}.desc`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      create: { key: nameKey, locale: 'pt-BR', text: cleanName },
      update: { text: cleanName },
    });

    if (dto.descriptionPtBr && dto.descriptionPtBr.trim()) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: { key: descKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
        update: { text: dto.descriptionPtBr.trim() },
      });
    }

    const created = await this.prisma.petTemplate.create({
      data: {
        code,
        mcreworkPetKey: dto.mcreworkPetKey.trim(),
        nameI18nKey: nameKey,
        descriptionI18nKey: dto.descriptionPtBr ? descKey : null,
        groundOffsetY: Number(dto.groundOffsetY) || 0,
        raceCode: dto.raceCode,
        recommendedElementCode: dto.recommendedElementCode || 'NEUTRAL',
        rarityTier: dto.rarityTier || 'COMMON',
        role: dto.role || 'BALANCED',
        combatStyle: dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE',
        attackRange: Math.max(10, Math.min(1000, Number(dto.attackRange) || (dto.combatStyle === 'RANGED' ? 220 : 60))),
        damageType: dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL',
        catchRatePct: dto.catchRatePct !== undefined ? Number(dto.catchRatePct) : 25.0,
        baseAttributesJson: dto.baseAttributesJson || { VIT: 12, STR: 12, INT: 10, WIS: 10, AGI: 10, DEX: 10 },
        baseCombatAttributesJson: (dto.baseCombatAttributesJson as any) || {},
        skillIdsJson: (dto.skillIdsJson as any) || [],
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      },
    });

    try { await this.snapshotManager.exportToDisk(); } catch (_) {}
    if (this.assetMirrorService && created.mcreworkPetKey) {
      await this.assetMirrorService.mirrorPetAssets(created.mcreworkPetKey);
    }
    return created;
  }

  /**
   * Atualiza um template de Pet existente.
   */
  public async updatePetTemplate(id: number, dto: PetTemplateDto) {
    const pet = await this.prisma.petTemplate.findUnique({ where: { id: Number(id) } });
    if (!pet) throw new Error(`Pet #${id} não encontrado.`);

    if (dto.namePtBr && dto.namePtBr.trim()) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: pet.nameI18nKey, locale: 'pt-BR' } },
        create: { key: pet.nameI18nKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
        update: { text: dto.namePtBr.trim() },
      });
    }

    const descKey = pet.descriptionI18nKey || `pet.${pet.code}.desc`;
    if (dto.descriptionPtBr !== undefined) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: { key: descKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
        update: { text: dto.descriptionPtBr.trim() },
      });
    }

    const updated = await this.prisma.petTemplate.update({
      where: { id: Number(id) },
      data: {
        mcreworkPetKey: dto.mcreworkPetKey ? dto.mcreworkPetKey.trim() : pet.mcreworkPetKey,
        descriptionI18nKey: dto.descriptionPtBr ? descKey : pet.descriptionI18nKey,
        groundOffsetY: dto.groundOffsetY !== undefined ? Number(dto.groundOffsetY) : pet.groundOffsetY,
        raceCode: dto.raceCode || pet.raceCode,
        recommendedElementCode: dto.recommendedElementCode || pet.recommendedElementCode,
        rarityTier: dto.rarityTier || pet.rarityTier,
        role: dto.role || pet.role,
        combatStyle: dto.combatStyle ? (dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE') : pet.combatStyle,
        attackRange: dto.attackRange !== undefined ? Math.max(10, Math.min(1000, Number(dto.attackRange))) : pet.attackRange,
        damageType: dto.damageType ? (dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL') : pet.damageType,
        catchRatePct: dto.catchRatePct !== undefined ? Number(dto.catchRatePct) : pet.catchRatePct,
        baseAttributesJson: dto.baseAttributesJson ? (dto.baseAttributesJson as any) : pet.baseAttributesJson,
        baseCombatAttributesJson: dto.baseCombatAttributesJson ? (dto.baseCombatAttributesJson as any) : pet.baseCombatAttributesJson,
        skillIdsJson: dto.skillIdsJson ? (dto.skillIdsJson as any) : pet.skillIdsJson,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : pet.isActive,
      },
    });

    try { await this.snapshotManager.exportToDisk(); } catch (_) {}
    if (this.assetMirrorService && updated.mcreworkPetKey) {
      await this.assetMirrorService.mirrorPetAssets(updated.mcreworkPetKey);
    }
    return updated;
  }

  /**
   * Exclui um template de Pet.
   */
  public async deletePetTemplate(id: number) {
    const pet = await this.prisma.petTemplate.findUnique({ where: { id: Number(id) } });
    if (!pet) throw new Error(`Pet #${id} não encontrado.`);

    await this.prisma.characterPet.deleteMany({ where: { petTemplateId: Number(id) } });
    await this.prisma.petTemplate.delete({ where: { id: Number(id) } });

    try { await this.snapshotManager.exportToDisk(); } catch (_) {}
    return { success: true, message: `Pet #${id} excluído com sucesso.` };
  }

  /**
   * Semeia pets iniciais caso a tabela esteja vazia no primeiro carregamento.
   */
  public async seedInitialPetsIfEmpty() {
    try {
      const count = await this.prisma.petTemplate.count();
      if (count > 0) return;

      const starters = [
        {
          code: 'pet_lobo_guardiao',
          namePtBr: 'Lobo Guardião',
          descPtBr: 'Um companheiro leal da floresta que protege seu herói com instinto protetor.',
          key: 'creature_000001',
          race: 'BEAST',
          element: 'EARTH',
          rarity: 'B',
          role: 'TANK',
          catchRate: 35.0,
          stats: { VIT: 16, STR: 13, INT: 8, WIS: 9, AGI: 12, DEX: 10 },
          combatStats: { BATTLE_MOVE_SPEED: 175, ATTACK_SPEED: 1.1, PHYS_ACCURACY: 95, PHYS_EVASION: 12 },
        },
        {
          code: 'pet_grifo_protetor',
          namePtBr: 'Grifo Protetor',
          descPtBr: 'Criatura mística dos céus que desfere ataques rápidos e oferece suporte tático.',
          key: 'creature_000002',
          race: 'CELESTIAL',
          element: 'AIR',
          rarity: 'A',
          role: 'SUPPORT',
          catchRate: 25.0,
          stats: { VIT: 12, STR: 14, INT: 12, WIS: 11, AGI: 15, DEX: 13 },
          combatStats: { BATTLE_MOVE_SPEED: 185, ATTACK_SPEED: 1.25, PHYS_ACCURACY: 100, PHYS_EVASION: 18 },
        },
        {
          code: 'pet_raposa_mistica',
          namePtBr: 'Raposa Mística',
          descPtBr: 'Espírito ardente com caudas flamejantes capaz de conjurar bolas de fogo teleguiadas.',
          key: 'creature_000003',
          race: 'SPIRIT',
          element: 'FIRE',
          rarity: 'S',
          role: 'MAG_DPS',
          catchRate: 15.0,
          stats: { VIT: 10, STR: 8, INT: 18, WIS: 14, AGI: 14, DEX: 14 },
          combatStats: { BATTLE_MOVE_SPEED: 180, ATTACK_SPEED: 1.15, MAG_ACCURACY: 105, MAG_EVASION: 15, CRIT_RATE: 12 },
        },
      ];

      for (const s of starters) {
        const nameKey = `pet.${s.code}.name`;
        const descKey = `pet.${s.code}.desc`;
        await this.prisma.i18nTranslation.upsert({
          where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
          create: { key: nameKey, locale: 'pt-BR', text: s.namePtBr },
          update: { text: s.namePtBr },
        });
        await this.prisma.i18nTranslation.upsert({
          where: { key_locale: { key: descKey, locale: 'pt-BR' } },
          create: { key: descKey, locale: 'pt-BR', text: s.descPtBr },
          update: { text: s.descPtBr },
        });
        await this.prisma.petTemplate.upsert({
          where: { code: s.code },
          create: {
            code: s.code,
            mcreworkPetKey: s.key,
            nameI18nKey: nameKey,
            descriptionI18nKey: descKey,
            groundOffsetY: 0,
            raceCode: s.race,
            recommendedElementCode: s.element,
            rarityTier: s.rarity,
            role: s.role,
            catchRatePct: s.catchRate,
            baseAttributesJson: s.stats,
            baseCombatAttributesJson: s.combatStats,
            skillIdsJson: [],
            isActive: true,
          },
          update: {},
        });
      }
    } catch (err) {
      console.warn('Falha no seed de pets iniciais:', err);
    }
  }
}
