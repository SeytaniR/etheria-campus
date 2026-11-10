/**
 * @file apps/server/src/controllers/AdminSkillsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão No-Code Visual de Habilidades (`skill_templates`)
 *   e Buffs/Debuffs (`status_effect_templates`) no Estúdio `/admin`.
 *   - Integração com os catálogos de Ícones (`assets/skills/catalog.json`) e Efeitos Especiais VFX (`assets/effects/catalog.json`) do `mcrework`.
 *   - CRUD completo de Habilidades (Ativas e Passivas) no Modo Visual com blocos de efeito.
 *   - CRUD completo de Buffs e Debuffs com ícone de cabeça em batalha, VFX de acionamento e gatilhos próprios.
 *   - Semeamento inicial automático e exportação para `lowcode.snapshot.json`.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface StatusEffectDto {
  namePtBr: string;
  descriptionPtBr?: string;
  iconKey?: string;
  mcreworkVfxKey?: string;
  isBuff: boolean;
  triggerType: string;
  maxStacks?: number;
  durationSeconds?: number;
  tickIntervalSeconds?: number;
  defaultDurationTurns?: number;
  statModifiersJson?: Record<string, number>;
  dotHotFormulaJson?: any;
  controlFlagsJson?: string[];
  effectBlocksJson?: any[];
  isActive?: boolean;
}

export interface SkillTemplateDto {
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkIconKey?: string;
  castActionId?: number;
  castMovement?: string;
  mcreworkVfxKey?: string;
  skillType: string;
  triggerType: string;
  mpCost?: number;
  apCost?: number;
  cooldownSeconds?: number;
  cooldownTurns?: number;
  castRange?: number;
  aoeRadius?: number;
  targetScope: string;
  hitCount?: number;
  effectBlocksJson?: any[];
  isActive?: boolean;
}

export class AdminSkillsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedSkillAssets: { icons: any[]; vfxList: any[] } | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  /**
   * Busca e cacheia os ícones de habilidades e os 128 efeitos especiais (VFX) animados do `mcrework`.
   */
  public async getMcreworkSkillAssets() {
    if (this.cachedSkillAssets) return this.cachedSkillAssets;

    const [skillsRes, effectsRes] = await Promise.all([
      fetch(`${this.mcreworkRawBaseUrl}/assets/skills/catalog.json`),
      fetch(`${this.mcreworkRawBaseUrl}/assets/effects/catalog.json`),
    ]);

    const rawSkills = skillsRes.ok ? ((await skillsRes.json()) as any[]) : [];
    const rawEffects = effectsRes.ok ? ((await effectsRes.json()) as any[]) : [];

    // Desduplica ícones por icon_path para uma galeria limpa e rápida
    const seenIcons = new Set<string>();
    const icons: any[] = [];
    for (const s of rawSkills) {
      const iconPath = s.icon_path || s.icon;
      if (!iconPath || seenIcons.has(iconPath)) continue;
      seenIcons.add(iconPath);
      icons.push({
        iconKey: iconPath,
        iconNum: s.icon_num || icons.length + 1,
        suggestedName: s.name || s.code_name || `Ícone #${s.icon_num}`,
        typeName: s.type_name || '',
        defaultVfxKey: s.effect_id ? String(s.effect_id) : '',
        iconUrl: `${this.mcreworkPagesBaseUrl}/${iconPath.replace(/^\/+/, '')}`,
      });
    }

    const vfxList = (Array.isArray(rawEffects) ? rawEffects : []).map((e) => {
      const idStr = String(e.id ?? e.num);
      return {
        vfxKey: idStr,
        name: `VFX #${idStr} (${e.frames || 8} frames)`,
        swfName: e.swf || '',
        frames: Number(e.frames) || 8,
        width: Number(e.width) || 140,
        height: Number(e.height) || 140,
        durationMs: Number(e.duration_ms) || 500,
        thumbUrl: `${this.mcreworkPagesBaseUrl}/${(e.thumb || `assets/effects/${idStr}/thumb.png`).replace(/^\/+/, '')}`,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/${(e.atlas || `assets/effects/${idStr}/atlas.json`).replace(/^\/+/, '')}`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/effects/${idStr}/atlas.webp`,
      };
    });

    this.cachedSkillAssets = { icons, vfxList };
    return this.cachedSkillAssets;
  }

  private resolveIconUrl(iconKey?: string | null): string {
    if (!iconKey) return `${this.mcreworkPagesBaseUrl}/assets/skills/icons/100156.png`;
    if (iconKey.startsWith('http://') || iconKey.startsWith('https://')) return iconKey;
    return `${this.mcreworkPagesBaseUrl}/${iconKey.replace(/^\/+/, '')}`;
  }

  private resolveVfxUrls(vfxKey?: string | null) {
    if (!vfxKey) {
      return {
        vfxThumbUrl: '',
        vfxAtlasJsonUrl: '',
        vfxAtlasWebpUrl: '',
      };
    }
    const cleanId = String(vfxKey).trim();
    return {
      vfxThumbUrl: `${this.mcreworkPagesBaseUrl}/assets/effects/${cleanId}/thumb.png`,
      vfxAtlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/effects/${cleanId}/atlas.json`,
      vfxAtlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/effects/${cleanId}/atlas.webp`,
    };
  }

  /**
   * Lista todos os Buffs e Debuffs (`status_effect_templates`) cadastrados.
   */
  public async getStatusEffectTemplates() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const list = await this.prisma.statusEffectTemplate.findMany({
      orderBy: { id: 'asc' },
    });

    return list.map((st) => ({
      ...st,
      namePtBr: i18nMap.get(st.nameI18nKey) ?? st.code,
      descriptionPtBr: st.descriptionI18nKey ? (i18nMap.get(st.descriptionI18nKey) ?? '') : '',
      iconUrl: this.resolveIconUrl(st.iconKey),
      ...this.resolveVfxUrls(st.mcreworkVfxKey),
    }));
  }

  /**
   * Cria um novo Buff ou Debuff na tabela `status_effect_templates`.
   */
  public async createStatusEffectTemplate(dto: StatusEffectDto) {
    const maxItem = await this.prisma.statusEffectTemplate.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextId = (maxItem?.id ?? 0) + 1;
    const code = `status_${nextId}`;
    const nameKey = `status.${code}.name`;
    const descKey = `status.${code}.description`;

    const nameText = dto.namePtBr?.trim() || `Buff/Debuff #${nextId}`;
    const descText = dto.descriptionPtBr?.trim() || '';

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

    const created = await this.prisma.statusEffectTemplate.create({
      data: {
        code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descText ? descKey : null,
        iconKey: dto.iconKey || 'assets/skills/icons/100156.png',
        mcreworkVfxKey: dto.mcreworkVfxKey || null,
        isBuff: dto.isBuff !== false,
        triggerType: dto.triggerType || 'CONTINUOUS_TICK',
        maxStacks: Math.max(1, Number(dto.maxStacks) || 1),
        durationSeconds: dto.durationSeconds !== undefined ? Math.max(0.1, Number(dto.durationSeconds)) : (dto.defaultDurationTurns ? dto.defaultDurationTurns * 2.5 : 5.0),
        tickIntervalSeconds: dto.tickIntervalSeconds !== undefined ? Math.max(0.1, Number(dto.tickIntervalSeconds)) : 1.0,
        defaultDurationTurns: Math.max(1, Number(dto.defaultDurationTurns) || 2),
        statModifiersJson: dto.statModifiersJson ?? {},
        dotHotFormulaJson: dto.dotHotFormulaJson ?? {},
        controlFlagsJson: Array.isArray(dto.controlFlagsJson) ? dto.controlFlagsJson : [],
        effectBlocksJson: Array.isArray(dto.effectBlocksJson) ? dto.effectBlocksJson : [],
        isActive: dto.isActive !== false,
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza um Buff ou Debuff existente.
   */
  public async updateStatusEffectTemplate(id: number, dto: StatusEffectDto) {
    const existing = await this.prisma.statusEffectTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Buff/Debuff #${id} não encontrado.`);
    }

    const nameText = dto.namePtBr?.trim() || existing.code;
    const descText = dto.descriptionPtBr?.trim() || '';
    const descKey = existing.descriptionI18nKey || `status.${existing.code}.description`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: existing.nameI18nKey, locale: 'pt-BR' } },
      update: { text: nameText },
      create: { key: existing.nameI18nKey, locale: 'pt-BR', text: nameText },
    });

    if (descText) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        update: { text: descText },
        create: { key: descKey, locale: 'pt-BR', text: descText },
      });
    }

    const updated = await this.prisma.statusEffectTemplate.update({
      where: { id },
      data: {
        descriptionI18nKey: descText ? descKey : null,
        iconKey: dto.iconKey !== undefined ? dto.iconKey : existing.iconKey,
        mcreworkVfxKey: dto.mcreworkVfxKey !== undefined ? (dto.mcreworkVfxKey || null) : existing.mcreworkVfxKey,
        isBuff: dto.isBuff !== undefined ? Boolean(dto.isBuff) : existing.isBuff,
        triggerType: dto.triggerType || existing.triggerType,
        maxStacks: dto.maxStacks !== undefined ? Math.max(1, Number(dto.maxStacks) || 1) : existing.maxStacks,
        durationSeconds:
          dto.durationSeconds !== undefined
            ? Math.max(0.1, Number(dto.durationSeconds))
            : ((existing as any).durationSeconds ?? (existing.defaultDurationTurns ? existing.defaultDurationTurns * 2.5 : 5.0)),
        tickIntervalSeconds:
          dto.tickIntervalSeconds !== undefined
            ? Math.max(0.1, Number(dto.tickIntervalSeconds))
            : ((existing as any).tickIntervalSeconds ?? 1.0),
        defaultDurationTurns:
          dto.defaultDurationTurns !== undefined
            ? Math.max(1, Number(dto.defaultDurationTurns) || 1)
            : existing.defaultDurationTurns,
        statModifiersJson: dto.statModifiersJson ?? (existing.statModifiersJson as any),
        dotHotFormulaJson: dto.dotHotFormulaJson ?? (existing.dotHotFormulaJson as any),
        controlFlagsJson: Array.isArray(dto.controlFlagsJson)
          ? dto.controlFlagsJson
          : (existing.controlFlagsJson as any),
        effectBlocksJson: Array.isArray(dto.effectBlocksJson)
          ? dto.effectBlocksJson
          : (existing.effectBlocksJson as any),
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  public async deleteStatusEffectTemplate(id: number) {
    const deleted = await this.prisma.statusEffectTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return deleted;
  }

  /**
   * Lista todas as Habilidades (`skill_templates`) cadastradas.
   */
  public async getSkillTemplates() {
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const list = await this.prisma.skillTemplate.findMany({
      orderBy: { id: 'asc' },
    });

    return list.map((sk) => ({
      ...sk,
      namePtBr: i18nMap.get(sk.nameI18nKey) ?? sk.code,
      descriptionPtBr: sk.descriptionI18nKey ? (i18nMap.get(sk.descriptionI18nKey) ?? '') : '',
      iconUrl: this.resolveIconUrl(sk.mcreworkIconKey),
      ...this.resolveVfxUrls(sk.mcreworkVfxKey),
    }));
  }

  /**
   * Cria uma nova Habilidade na tabela `skill_templates`.
   */
  public async createSkillTemplate(dto: SkillTemplateDto) {
    const maxItem = await this.prisma.skillTemplate.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextId = (maxItem?.id ?? 0) + 1;
    const code = `skill_${nextId}`;
    const nameKey = `skill.${code}.name`;
    const descKey = `skill.${code}.description`;

    const nameText = dto.namePtBr?.trim() || `Habilidade #${nextId}`;
    const descText = dto.descriptionPtBr?.trim() || '';

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      update: { text: nameText },
      create: { key: nameKey, locale: 'pt-BR', text: nameText },
    });

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: descKey, locale: 'pt-BR' } },
      update: { text: descText },
      create: { key: descKey, locale: 'pt-BR', text: descText },
    });

    const created = await this.prisma.skillTemplate.create({
      data: {
        code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descKey,
        mcreworkIconKey: dto.mcreworkIconKey || 'assets/skills/icons/100156.png',
        castActionId: Number(dto.castActionId) || 3,
        castMovement: dto.castMovement || 'MELEE_ADVANCE',
        mcreworkVfxKey: dto.mcreworkVfxKey || null,
        skillType: dto.skillType || 'ACTIVE',
        triggerType: dto.triggerType || 'ACTIVE',
        mpCost: Math.max(0, Number(dto.mpCost) ?? 10),
        apCost: 0,
        cooldownSeconds: dto.cooldownSeconds !== undefined ? Math.max(0, Number(dto.cooldownSeconds)) : (dto.cooldownTurns ? dto.cooldownTurns * 3.0 : 0.0),
        cooldownTurns: Math.max(0, Number(dto.cooldownTurns) ?? 0),
        castRange: dto.castRange !== undefined ? Math.max(10, Number(dto.castRange)) : 160,
        aoeRadius: dto.aoeRadius !== undefined ? Math.max(0, Number(dto.aoeRadius)) : 0,
        targetScope: dto.targetScope || 'MELEE_FRONTLINE',
        hitCount: Math.max(1, Number(dto.hitCount) || 1),
        effectBlocksJson: Array.isArray(dto.effectBlocksJson) ? dto.effectBlocksJson : [],
        isActive: dto.isActive !== false,
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza uma Habilidade existente.
   */
  public async updateSkillTemplate(id: number, dto: SkillTemplateDto) {
    const existing = await this.prisma.skillTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Habilidade #${id} não encontrada.`);
    }

    const nameText = dto.namePtBr?.trim() || existing.code;
    const descText = dto.descriptionPtBr?.trim() || '';
    const descKey = existing.descriptionI18nKey || `skill.${existing.code}.description`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: existing.nameI18nKey, locale: 'pt-BR' } },
      update: { text: nameText },
      create: { key: existing.nameI18nKey, locale: 'pt-BR', text: nameText },
    });

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: descKey, locale: 'pt-BR' } },
      update: { text: descText },
      create: { key: descKey, locale: 'pt-BR', text: descText },
    });

    const updated = await this.prisma.skillTemplate.update({
      where: { id },
      data: {
        descriptionI18nKey: descKey,
        mcreworkIconKey: dto.mcreworkIconKey !== undefined ? dto.mcreworkIconKey : existing.mcreworkIconKey,
        castActionId: dto.castActionId !== undefined ? Number(dto.castActionId) : existing.castActionId,
        castMovement: dto.castMovement || existing.castMovement,
        mcreworkVfxKey: dto.mcreworkVfxKey !== undefined ? (dto.mcreworkVfxKey || null) : existing.mcreworkVfxKey,
        skillType: dto.skillType || existing.skillType,
        triggerType: dto.triggerType || existing.triggerType || 'ACTIVE',
        mpCost: dto.mpCost !== undefined ? Math.max(0, Number(dto.mpCost)) : existing.mpCost,
        apCost: 0,
        cooldownSeconds:
          dto.cooldownSeconds !== undefined
            ? Math.max(0, Number(dto.cooldownSeconds))
            : ((existing as any).cooldownSeconds ?? (existing.cooldownTurns ? existing.cooldownTurns * 3.0 : 0.0)),
        cooldownTurns:
          dto.cooldownTurns !== undefined ? Math.max(0, Number(dto.cooldownTurns)) : existing.cooldownTurns,
        castRange: dto.castRange !== undefined ? Math.max(10, Number(dto.castRange)) : ((existing as any).castRange ?? 160),
        aoeRadius: dto.aoeRadius !== undefined ? Math.max(0, Number(dto.aoeRadius)) : ((existing as any).aoeRadius ?? 0),
        targetScope: dto.targetScope || existing.targetScope,
        hitCount: dto.hitCount !== undefined ? Math.max(1, Number(dto.hitCount) || 1) : existing.hitCount,
        effectBlocksJson: Array.isArray(dto.effectBlocksJson)
          ? dto.effectBlocksJson
          : (existing.effectBlocksJson as any),
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    return updated;
  }

  public async deleteSkillTemplate(id: number) {
    const deleted = await this.prisma.skillTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return deleted;
  }

  /**
   * Auto-vincula uma Habilidade a todos os monstros que possuem determinado Elemento Fixo.
   * Se elementCode for 'ALL' ou vazio, vincula a todos os monstros cadastrados.
   */
  public async autoLinkSkillToMonsters(skillId: number, elementCode?: string) {
    const skill = await this.prisma.skillTemplate.findUnique({ where: { id: skillId } });
    if (!skill) {
      throw new Error(`Habilidade #${skillId} não encontrada.`);
    }

    const whereClause: any = {};
    if (elementCode && elementCode !== 'ALL') {
      whereClause.fixedElementCode = elementCode;
    }

    const monsters = await this.prisma.monsterTemplate.findMany({
      where: whereClause,
      select: { id: true, code: true, nameI18nKey: true, fixedElementCode: true, skillIdsJson: true },
      orderBy: { id: 'asc' },
    });

    const i18n = await this.prisma.i18nTranslation.findMany({
      where: { locale: 'pt-BR' },
    });
    const i18nMap = new Map(i18n.map((t) => [t.key, t.text]));

    const updatedMonsterNames: string[] = [];

    for (const mob of monsters) {
      const currentSkills: number[] = Array.isArray(mob.skillIdsJson)
        ? (mob.skillIdsJson as any[]).map(Number).filter((n) => !isNaN(n))
        : [];

      if (!currentSkills.includes(skillId)) {
        currentSkills.push(skillId);
        await this.prisma.monsterTemplate.update({
          where: { id: mob.id },
          data: { skillIdsJson: currentSkills },
        });
        const mobName = i18nMap.get(mob.nameI18nKey) || mob.code;
        updatedMonsterNames.push(mobName);
      }
    }

    await this.snapshotManager.exportToDisk();

    return {
      success: true,
      skillId,
      skillName: i18nMap.get(skill.nameI18nKey) || skill.code,
      elementCode: elementCode || 'ALL',
      totalMonstersFound: monsters.length,
      linkedCount: updatedMonsterNames.length,
      monsterNames: updatedMonsterNames,
    };
  }

  /**
   * Semeia Buffs/Debuffs e Habilidades iniciais caso as tabelas estejam vazias,
   * permitindo testar imediatamente na Arena 2.5D e no Estúdio `/admin`.
   */
  public async ensureInitialSkillsAndBuffs() {
    try {
      const statusCount = await this.prisma.statusEffectTemplate.count();
      if (statusCount === 0) {
        console.log('🧪 [AdminSkillsController] Semeando Buffs e Debuffs iniciais...');
        const initialStatuses: StatusEffectDto[] = [
          {
            namePtBr: 'Queimadura Solar',
            descriptionPtBr: 'Chamas intensas que causam dano de Fogo contínuo por segundo ao alvo (6s).',
            iconKey: 'assets/skills/icons/100156.png',
            mcreworkVfxKey: '10002',
            isBuff: false,
            triggerType: 'CONTINUOUS_TICK',
            maxStacks: 3,
            durationSeconds: 6.0,
            tickIntervalSeconds: 1.0,
            defaultDurationTurns: 3,
            statModifiersJson: { DEF_PCT: -10 },
            dotHotFormulaJson: { mode: 'DAMAGE', scaleStat: 'ATK', scalePct: 35, flatAmount: 10, elementCode: 'FIRE' },
            controlFlagsJson: [],
          },
          {
            namePtBr: 'Toxina Paralisante',
            descriptionPtBr: 'Veneno corrosivo que drena vitalidade por segundo e reduz a velocidade de ataque.',
            iconKey: 'assets/skills/icons/100157.png',
            mcreworkVfxKey: '10004',
            isBuff: false,
            triggerType: 'CONTINUOUS_TICK',
            maxStacks: 2,
            durationSeconds: 6.0,
            tickIntervalSeconds: 1.0,
            defaultDurationTurns: 3,
            statModifiersJson: { SPEED_PCT: -20 },
            dotHotFormulaJson: { mode: 'DAMAGE', scaleStat: 'MAX_HP', scalePct: 8, flatAmount: 8, elementCode: 'EARTH' },
            controlFlagsJson: [],
          },
          {
            namePtBr: 'Fúria de Batalha',
            descriptionPtBr: 'Aumenta o Ataque em +30% e a Velocidade em +15% por 8 segundos.',
            iconKey: 'assets/skills/icons/100158.png',
            mcreworkVfxKey: '10001',
            isBuff: true,
            triggerType: 'WHILE_ACTIVE',
            maxStacks: 1,
            durationSeconds: 8.0,
            tickIntervalSeconds: 1.0,
            defaultDurationTurns: 3,
            statModifiersJson: { ATK_PCT: 30, SPEED_PCT: 15 },
            dotHotFormulaJson: { mode: 'NONE' },
            controlFlagsJson: [],
          },
          {
            namePtBr: 'Bênção Regenerativa',
            descriptionPtBr: 'Aura sagrada que restaura HP continuamente a cada segundo e eleva a Defesa por 6s.',
            iconKey: 'assets/skills/icons/100159.png',
            mcreworkVfxKey: '10005',
            isBuff: true,
            triggerType: 'CONTINUOUS_TICK',
            maxStacks: 1,
            durationSeconds: 6.0,
            tickIntervalSeconds: 1.0,
            defaultDurationTurns: 3,
            statModifiersJson: { DEF_PCT: 25 },
            dotHotFormulaJson: { mode: 'HEAL', scaleStat: 'MAX_HP', scalePct: 12, flatAmount: 15, elementCode: 'WATER' },
            controlFlagsJson: [],
          },
          {
            namePtBr: 'Atordoamento Sísmico',
            descriptionPtBr: 'Alvo atordoado pela onda de choque, ficando impedido de agir por 2.5 segundos.',
            iconKey: 'assets/skills/icons/100160.png',
            mcreworkVfxKey: '10008',
            isBuff: false,
            triggerType: 'WHILE_ACTIVE',
            maxStacks: 1,
            durationSeconds: 2.5,
            tickIntervalSeconds: 1.0,
            defaultDurationTurns: 1,
            statModifiersJson: {},
            dotHotFormulaJson: { mode: 'NONE' },
            controlFlagsJson: ['STUN'],
          },
        ];

        for (const st of initialStatuses) {
          await this.createStatusEffectTemplate(st);
        }
      }

      const skillCount = await this.prisma.skillTemplate.count();
      if (skillCount === 0) {
        console.log('⚡ [AdminSkillsController] Semeando Habilidades iniciais...');
        const initialSkills: SkillTemplateDto[] = [
          {
            namePtBr: 'Corte Fulminante',
            descriptionPtBr: 'Avança contra o inimigo desferindo um golpe físico poderoso (150% do Ataque + 15).',
            mcreworkIconKey: 'assets/skills/icons/100156.png',
            castActionId: 3,
            castMovement: 'MELEE_ADVANCE',
            mcreworkVfxKey: '10008',
            skillType: 'ACTIVE',
            triggerType: 'ACTIVE',
            mpCost: 10,
            apCost: 0,
            cooldownTurns: 0,
            targetScope: 'MELEE_FRONTLINE',
            hitCount: 1,
            effectBlocksJson: [
              {
                blockType: 'DAMAGE',
                damageType: 'PHYSICAL',
                elementCode: 'INHERIT',
                scaleStat: 'ATK',
                scalePct: 150,
                flatAmount: 15,
                critBonusPct: 15,
                lifestealPct: 0,
              },
            ],
          },
          {
            namePtBr: 'Chama Purgatorial',
            descriptionPtBr: 'Conjura uma explosão de fogo à distância (170% do Ataque + 20) e aplica Queimadura Solar.',
            mcreworkIconKey: 'assets/skills/icons/100157.png',
            castActionId: 7,
            castMovement: 'STAND_IN_PLACE',
            mcreworkVfxKey: '10002',
            skillType: 'ACTIVE',
            triggerType: 'ACTIVE',
            mpCost: 18,
            apCost: 0,
            cooldownTurns: 1,
            targetScope: 'RANGED_ANY',
            hitCount: 1,
            effectBlocksJson: [
              {
                blockType: 'DAMAGE',
                damageType: 'MAGICAL',
                elementCode: 'FIRE',
                scaleStat: 'ATK',
                scalePct: 170,
                flatAmount: 20,
                critBonusPct: 20,
                lifestealPct: 0,
              },
              {
                blockType: 'STATUS',
                statusEffectId: 1,
                applyChancePct: 100,
                durationTurns: 3,
                targetSelf: false,
              },
            ],
          },
          {
            namePtBr: 'Espinhos Peçonhentos',
            descriptionPtBr: 'Dispara espinhos tóxicos que causam 130% de dano e aplicam Toxina Paralisante.',
            mcreworkIconKey: 'assets/skills/icons/100158.png',
            castActionId: 7,
            castMovement: 'STAND_IN_PLACE',
            mcreworkVfxKey: '10004',
            skillType: 'ACTIVE',
            triggerType: 'ACTIVE',
            mpCost: 14,
            apCost: 0,
            cooldownTurns: 1,
            targetScope: 'RANGED_ANY',
            hitCount: 1,
            effectBlocksJson: [
              {
                blockType: 'DAMAGE',
                damageType: 'PHYSICAL',
                elementCode: 'EARTH',
                scaleStat: 'ATK',
                scalePct: 130,
                flatAmount: 12,
                critBonusPct: 10,
                lifestealPct: 0,
              },
              {
                blockType: 'STATUS',
                statusEffectId: 2,
                applyChancePct: 100,
                durationSeconds: 6.0,
                durationTurns: 3,
                targetSelf: false,
              },
            ],
          },
          {
            namePtBr: 'Rugido do Guerreiro',
            descriptionPtBr: 'Restaura 18% do HP Máximo e ativa o buff Fúria de Batalha (+30% ATK) por 6 segundos.',
            mcreworkIconKey: 'assets/skills/icons/100159.png',
            castActionId: 7,
            castMovement: 'STAND_IN_PLACE',
            mcreworkVfxKey: '10001',
            skillType: 'ACTIVE',
            triggerType: 'ACTIVE',
            mpCost: 15,
            apCost: 0,
            cooldownSeconds: 6.0,
            cooldownTurns: 2,
            targetScope: 'SELF',
            hitCount: 1,
            effectBlocksJson: [
              {
                blockType: 'HEAL',
                scaleStat: 'MAX_HP',
                scalePct: 18,
                flatAmount: 20,
                targetSelf: true,
              },
              {
                blockType: 'STATUS',
                statusEffectId: 3,
                applyChancePct: 100,
                durationSeconds: 6.0,
                durationTurns: 3,
                targetSelf: true,
              },
            ],
          },
        ];

        for (const sk of initialSkills) {
          await this.createSkillTemplate(sk);
        }
      }
    } catch (err: any) {
      console.warn(`[AdminSkillsController] Aviso ao semear skills/buffs iniciais: ${err?.message || err}`);
    }
  }
}
