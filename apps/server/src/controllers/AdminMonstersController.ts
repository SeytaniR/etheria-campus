/**
 * @file apps/server/src/controllers/AdminMonstersController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Monstros / Mobs (`monster_templates`)
 *   no Estúdio `/admin`.
 *   - Integração com catálogo de centenas de monstros do repositório `mcrework`.
 *   - CRUD completo de templates de monstros no PostgreSQL com i18n em PT-BR.
 *   - Associação procedural com Biomas, Atributos Base, Raridade e Elemento Fixo.
 *   - Calibração de distância dos pés ao solo (`groundOffsetY`).
 *   - Auto-atualização de Snapshots JSON para sincronização no Git.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface MonsterTemplateDto {
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkMonsterKey: string;
  groundOffsetY?: number;
  raceCode: string;
  fixedElementCode: string;
  rarityTier?: string;
  combatStyle?: string;
  attackRange?: number;
  damageType?: string;
  isTamableAsPet: boolean;
  isActive?: boolean;
  biomeIds?: number[];
  skillIdsJson?: number[];
  baseAttributesJson: {
    VIT: number;
    STR: number;
    INT: number;
    WIS: number;
    AGI: number;
    DEX: number;
  };
}

export class AdminMonstersController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkMonsters: any[] | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Busca e cacheia o catálogo de monstros do repositório `mcrework`.
   * Desduplica por chave de monstro (`m.id`) e retorna metadados completos.
   */
  public async getMcreworkMonsterGallery() {
    if (this.cachedMcreworkMonsters) return this.cachedMcreworkMonsters;

    const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/monsters/catalog.json`);
    if (!res.ok) {
      throw new Error(`Falha ao ler catálogo de monstros do mcrework (${res.status})`);
    }

    const data = (await res.json()) as { monsters?: any[] };
    const rawList = data.monsters || [];
    const seenKeys = new Set<string>();
    const cleanList: any[] = [];

    for (const m of rawList) {
      if (!m || !m.id || seenKeys.has(m.id)) continue;
      seenKeys.add(m.id);

      cleanList.push({
        mcreworkMonsterKey: m.id,
        suggestedName: m.real_name || m.name || m.id,
        category: m.category || 'monster',
        isPet: !!m.is_pet,
        width: m.width || 100,
        height: m.height || 100,
        feetY: m.feet_y || Math.round(m.height * 0.9),
        anchor: Array.isArray(m.anchor) ? m.anchor : [0.5, 0.95],
        thumbUrl: `${this.mcreworkPagesBaseUrl}/${m.thumb}`,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/${m.path}`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${m.id}/atlas.webp`,
      });
    }

    this.cachedMcreworkMonsters = cleanList;
    return cleanList;
  }

  /**
   * Retorna todos os templates de monstros cadastrados no PostgreSQL,
   * resolvendo traduções em português (i18n), raças, elementos, raridade e biomas vinculados.
   */
  public async getMonsterTemplates() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const templates = await this.prisma.monsterTemplate.findMany({
      orderBy: { id: 'asc' },
      include: {
        race: true,
        fixedElement: true,
      },
    });

    return templates.map((mt) => ({
      ...mt,
      rarityTier: mt.rarityTier || 'F',
      namePtBr: i18nMap.get(mt.nameI18nKey) ?? mt.code,
      descriptionPtBr: mt.descriptionI18nKey ? (i18nMap.get(mt.descriptionI18nKey) ?? '') : '',
      raceNamePtBr: mt.race ? (i18nMap.get(mt.race.nameI18nKey) ?? mt.race.code) : mt.raceCode,
      elementNamePtBr: mt.fixedElement ? (i18nMap.get(mt.fixedElement.nameI18nKey) ?? mt.fixedElement.code) : mt.fixedElementCode,
      thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/thumb.webp`,
      atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/atlas.json`,
      atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${mt.mcreworkMonsterKey}/atlas.webp`,
      biomesList: [],
    }));
  }

  private normalizeRarityTier(raw?: string): string {
    const valid = ['SS', 'S', 'A', 'B', 'C', 'D', 'F'];
    const upper = String(raw || 'F').trim().toUpperCase();
    return valid.includes(upper) ? upper : 'F';
  }

  /**
   * Cria um novo template de monstro com ID auto-incremental e chaves i18n automáticas.
   */
  public async createMonsterTemplate(dto: MonsterTemplateDto) {
    if (!dto.mcreworkMonsterKey) {
      throw new Error('A chave do monstro no mcrework é obrigatória.');
    }

    const maxTemplate = await this.prisma.monsterTemplate.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextId = (maxTemplate?.id ?? 0) + 1;
    const code = `monster_${nextId}`;
    const nameKey = `monster.${code}.name`;
    const descKey = `monster.${code}.description`;

    const nameText = dto.namePtBr?.trim() || `Monstro #${nextId}`;
    const descText = dto.descriptionPtBr?.trim() || '';

    // Salva traduções no banco
    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      update: { text: nameText },
      create: { key: nameKey, locale: 'pt-BR', text: nameText },
    });

    if (descText) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        update: { text: descText },
        create: { key: descKey, locale: 'pt-BR', text: descText },
      });
    }

    const combatStyle = dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE';
    const attackRange = Math.max(10, Math.min(1000, Number(dto.attackRange) || (combatStyle === 'RANGED' ? 220 : 60)));
    const damageType = dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';

    const created = await this.prisma.monsterTemplate.create({
      data: {
        code,
        mcreworkMonsterKey: dto.mcreworkMonsterKey.trim(),
        nameI18nKey: nameKey,
        descriptionI18nKey: descText ? descKey : null,
        groundOffsetY: Number(dto.groundOffsetY) || 0,
        raceCode: dto.raceCode || 'BEAST',
        fixedElementCode: dto.fixedElementCode || 'NEUTRAL',
        rarityTier: this.normalizeRarityTier(dto.rarityTier),
        combatStyle,
        attackRange,
        damageType,
        isTamableAsPet: dto.isTamableAsPet !== false,
        isActive: dto.isActive !== false,
        skillIdsJson: Array.isArray(dto.skillIdsJson) ? (dto.skillIdsJson as any) : ([1] as any),
        baseAttributesJson: dto.baseAttributesJson ?? {
          VIT: 12,
          STR: 12,
          INT: 10,
          WIS: 10,
          AGI: 10,
          DEX: 10,
        },
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza um template de monstro existente e seus biomas de spawn.
   */
  public async updateMonsterTemplate(id: number, dto: MonsterTemplateDto) {
    const existing = await this.prisma.monsterTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`Template de monstro #${id} não encontrado.`);
    }

    const nameText = dto.namePtBr?.trim() || existing.code;
    const descText = dto.descriptionPtBr?.trim() || '';

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: existing.nameI18nKey, locale: 'pt-BR' } },
      update: { text: nameText },
      create: { key: existing.nameI18nKey, locale: 'pt-BR', text: nameText },
    });

    const descKey = existing.descriptionI18nKey || `monster.${existing.code}.description`;
    if (descText) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        update: { text: descText },
        create: { key: descKey, locale: 'pt-BR', text: descText },
      });
    }

    const updated = await this.prisma.monsterTemplate.update({
      where: { id },
      data: {
        mcreworkMonsterKey: dto.mcreworkMonsterKey?.trim() || existing.mcreworkMonsterKey,
        descriptionI18nKey: descText ? descKey : null,
        groundOffsetY: dto.groundOffsetY !== undefined ? Number(dto.groundOffsetY) : existing.groundOffsetY,
        raceCode: dto.raceCode || existing.raceCode,
        fixedElementCode: dto.fixedElementCode || existing.fixedElementCode,
        rarityTier: dto.rarityTier ? this.normalizeRarityTier(dto.rarityTier) : existing.rarityTier,
        combatStyle: dto.combatStyle ? (dto.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE') : existing.combatStyle,
        attackRange: dto.attackRange !== undefined ? Math.max(10, Math.min(1000, Number(dto.attackRange))) : existing.attackRange,
        damageType: dto.damageType ? (dto.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL') : existing.damageType,
        isTamableAsPet: dto.isTamableAsPet !== undefined ? !!dto.isTamableAsPet : existing.isTamableAsPet,
        isActive: dto.isActive !== undefined ? !!dto.isActive : existing.isActive,
        skillIdsJson: Array.isArray(dto.skillIdsJson) ? (dto.skillIdsJson as any) : (existing.skillIdsJson as any),
        baseAttributesJson: dto.baseAttributesJson ?? (existing.baseAttributesJson as any),
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  /**
   * Remove um template de monstro do banco de dados.
   */
  public async deleteMonsterTemplate(id: number) {
    const deleted = await this.prisma.monsterTemplate.delete({
      where: { id },
    });
    await this.snapshotManager.exportToDisk();
    return deleted;
  }

  /**
   * Popula monstros iniciais caso a tabela esteja vazia,
   * garantindo que o usuário tenha monstros jogáveis e visíveis de imediato.
   */
  public async ensureInitialMonsters() {
    try {
      const count = await this.prisma.monsterTemplate.count();
      if (count > 0) return;

      console.log('🐉 [AdminMonstersController] Semeando monstros iniciais do mcrework...');

      const initialMobs = [
        {
          namePtBr: 'Sa Tặc da Areia',
          desc: 'Bandido nômade que ronda as dunas e desfiladeiros áridos atacando caravanas.',
          key: 'creature_000001',
          race: 'BEAST',
          element: 'AIR',
          rarityTier: 'F',
          offset: 0,
          stats: { VIT: 14, STR: 13, INT: 8, WIS: 9, AGI: 12, DEX: 11 },
        },
        {
          namePtBr: 'Peru Selvagem da Sorte',
          desc: 'Criatura veloz e espalhafatosa das pradarias. Dizem que traz sorte a quem a doma.',
          key: 'creature_000002',
          race: 'BEAST',
          element: 'NEUTRAL',
          rarityTier: 'F',
          offset: 0,
          stats: { VIT: 12, STR: 10, INT: 10, WIS: 10, AGI: 15, DEX: 14 },
        },
        {
          namePtBr: 'Cacto Venenoso',
          desc: 'Vegetal animado e agressivo capaz de disparar espinhos com toxina paralisante.',
          key: 'creature_000003',
          race: 'PLANT',
          element: 'EARTH',
          rarityTier: 'D',
          offset: 0,
          stats: { VIT: 16, STR: 11, INT: 12, WIS: 11, AGI: 8, DEX: 10 },
        },
        {
          namePtBr: 'Guardião Arbóreo',
          desc: 'Espírito ancestral da floresta mística em forma de árvore frondosa.',
          key: 'creature_000004',
          race: 'PLANT',
          element: 'WATER',
          rarityTier: 'C',
          offset: 0,
          stats: { VIT: 18, STR: 14, INT: 11, WIS: 12, AGI: 7, DEX: 9 },
        },
        {
          namePtBr: 'Polvo Esmeralda',
          desc: 'Criatura anfíbia curiosa com tentáculos elásticos e pele verde fluorescente.',
          key: 'creature_000006',
          race: 'AQUATIC',
          element: 'WATER',
          rarityTier: 'D',
          offset: 0,
          stats: { VIT: 13, STR: 11, INT: 14, WIS: 13, AGI: 12, DEX: 13 },
        },
      ];

      for (const mob of initialMobs) {
        await this.createMonsterTemplate({
          namePtBr: mob.namePtBr,
          descriptionPtBr: mob.desc,
          mcreworkMonsterKey: mob.key,
          groundOffsetY: mob.offset,
          raceCode: mob.race,
          fixedElementCode: mob.element,
          rarityTier: mob.rarityTier,
          isTamableAsPet: true,
          baseAttributesJson: mob.stats,
        });
      }

      console.log(`✅ ${initialMobs.length} monstros iniciais cadastrados com sucesso!`);
    } catch (err: any) {
      console.warn(`[AdminMonstersController] Aviso ao semear monstros iniciais: ${err?.message || err}`);
    }
  }
}
