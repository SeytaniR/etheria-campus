import { PrismaClient } from '@etheria/database';
import { SnapshotManager } from '@etheria/database';

export interface UiViewportLayoutConfig {
  anchorX: 'DEFAULT' | 'LEFT' | 'CENTER' | 'RIGHT';
  anchorY: 'DEFAULT' | 'TOP' | 'CENTER' | 'BOTTOM';
  offsetX: number;
  offsetY: number;
  scale: number;
  widthPx: number | null;
  heightPx: number | null;
  maxWidthVw: number | null;
  maxHeightVh: number | null;
  opacity: number;
  visible: boolean;
  bgColor?: string | null;
  borderColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
  borderRadiusPx?: number | null;
  iconUrl?: string | null;
  bgImageUrl?: string | null;
  customLabel?: string | null;
  subIcons?: Record<string, string> | null;
}

export interface UpsertClientUiLayoutDto {
  code: string;
  namePtBr: string;
  category: 'EXPLORE_HUD' | 'COMBAT_HUD' | 'MODAL' | 'INTERFACE';
  domSelector: string;
  descriptionPtBr?: string;
  mobilePortrait: UiViewportLayoutConfig;
  mobileLandscape: UiViewportLayoutConfig;
  desktop: UiViewportLayoutConfig;
  isActive?: boolean;
}

const DEFAULT_VIEWPORT_CONFIG: UiViewportLayoutConfig = {
  anchorX: 'DEFAULT',
  anchorY: 'DEFAULT',
  offsetX: 0,
  offsetY: 0,
  scale: 1.0,
  widthPx: null,
  heightPx: null,
  maxWidthVw: null,
  maxHeightVh: null,
  opacity: 1.0,
  visible: true,
};

function normalizeViewportConfig(raw: unknown): UiViewportLayoutConfig {
  let parsed: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  }

  const validX = ['DEFAULT', 'LEFT', 'CENTER', 'RIGHT'];
  const validY = ['DEFAULT', 'TOP', 'CENTER', 'BOTTOM'];
  const anchorX = validX.includes(String(parsed.anchorX || '').toUpperCase())
    ? (String(parsed.anchorX).toUpperCase() as UiViewportLayoutConfig['anchorX'])
    : 'DEFAULT';
  const anchorY = validY.includes(String(parsed.anchorY || '').toUpperCase())
    ? (String(parsed.anchorY).toUpperCase() as UiViewportLayoutConfig['anchorY'])
    : 'DEFAULT';

  const offsetX = Number.isFinite(Number(parsed.offsetX)) ? Math.round(Number(parsed.offsetX)) : 0;
  const offsetY = Number.isFinite(Number(parsed.offsetY)) ? Math.round(Number(parsed.offsetY)) : 0;
  const scaleRaw = Number(parsed.scale);
  const scale = Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.min(2.5, Math.max(0.3, Number(scaleRaw.toFixed(2)))) : 1.0;

  const widthPx =
    parsed.widthPx !== null && parsed.widthPx !== undefined && parsed.widthPx !== '' && Number(parsed.widthPx) > 0
      ? Math.round(Number(parsed.widthPx))
      : null;
  const heightPx =
    parsed.heightPx !== null && parsed.heightPx !== undefined && parsed.heightPx !== '' && Number(parsed.heightPx) > 0
      ? Math.round(Number(parsed.heightPx))
      : null;
  const maxWidthVw =
    parsed.maxWidthVw !== null && parsed.maxWidthVw !== undefined && parsed.maxWidthVw !== '' && Number(parsed.maxWidthVw) > 0
      ? Math.min(100, Math.max(10, Math.round(Number(parsed.maxWidthVw))))
      : null;
  const maxHeightVh =
    parsed.maxHeightVh !== null && parsed.maxHeightVh !== undefined && parsed.maxHeightVh !== '' && Number(parsed.maxHeightVh) > 0
      ? Math.min(100, Math.max(10, Math.round(Number(parsed.maxHeightVh))))
      : null;

  const opacityRaw = Number(parsed.opacity);
  const opacity =
    Number.isFinite(opacityRaw) && opacityRaw >= 0.05 && opacityRaw <= 1
      ? Number(opacityRaw.toFixed(2))
      : 1.0;

  const visible = parsed.visible !== false;

  const strOrNull = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const borderRadiusPx =
    parsed.borderRadiusPx !== null &&
    parsed.borderRadiusPx !== undefined &&
    parsed.borderRadiusPx !== '' &&
    Number.isFinite(Number(parsed.borderRadiusPx)) &&
    Number(parsed.borderRadiusPx) >= 0
      ? Math.round(Number(parsed.borderRadiusPx))
      : null;

  let subIcons: Record<string, string> | null = null;
  if (parsed.subIcons && typeof parsed.subIcons === 'object' && !Array.isArray(parsed.subIcons)) {
    const cleanMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.subIcons as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) {
        cleanMap[k] = v.trim();
      }
    }
    if (Object.keys(cleanMap).length > 0) {
      subIcons = cleanMap;
    }
  }

  return {
    anchorX,
    anchorY,
    offsetX,
    offsetY,
    scale,
    widthPx,
    heightPx,
    maxWidthVw,
    maxHeightVh,
    opacity,
    visible,
    bgColor: strOrNull(parsed.bgColor),
    borderColor: strOrNull(parsed.borderColor),
    textColor: strOrNull(parsed.textColor),
    accentColor: strOrNull(parsed.accentColor),
    borderRadiusPx,
    iconUrl: strOrNull(parsed.iconUrl),
    bgImageUrl: strOrNull(parsed.bgImageUrl),
    customLabel: strOrNull(parsed.customLabel),
    subIcons,
  };
}

export class AdminUiLayoutsController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly snapshotManager: SnapshotManager
  ) {}

  public static getDefaultSeeds(): UpsertClientUiLayoutDto[] {
    const mk = (
      code: string,
      namePtBr: string,
      category: UpsertClientUiLayoutDto['category'],
      domSelector: string,
      descriptionPtBr: string,
      mp: Partial<UiViewportLayoutConfig> = {},
      ml: Partial<UiViewportLayoutConfig> = {},
      dk: Partial<UiViewportLayoutConfig> = {}
    ): UpsertClientUiLayoutDto => ({
      code,
      namePtBr,
      category,
      domSelector,
      descriptionPtBr,
      mobilePortrait: { ...DEFAULT_VIEWPORT_CONFIG, ...mp },
      mobileLandscape: { ...DEFAULT_VIEWPORT_CONFIG, ...ml },
      desktop: { ...DEFAULT_VIEWPORT_CONFIG, ...dk },
      isActive: true,
    });

    return [
      // 1. EXPLORE_HUD (HUDs de Exploração)
      mk(
        'HUD_PLAYER_PROFILE',
        'HUD Perfil do Jogador (Avatar, HP, MP, XP)',
        'EXPLORE_HUD',
        '#hudPlayerSection',
        'Painel superior esquerdo com retrato do personagem, nível, barras de HP/MP/XP e moedas.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_MINIMAP',
        'HUD Minimapa & Coordenadas',
        'EXPLORE_HUD',
        '#hudMinimapSection',
        'Minimapa interativo no canto superior direito com botões de Mapa Local e Mapa Mundo.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.92 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_SETTINGS_BTN',
        'Botão de Configurações (Engrenagem)',
        'EXPLORE_HUD',
        '#hudSettingsBtn',
        'Botão flutuante da engrenagem de configurações e fuga em batalha.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_SHORTCUTS_DOCK',
        'Barra de Atalhos Rápidos (4 Slots)',
        'EXPLORE_HUD',
        '#hudShortcutsSection',
        'Dock de 4 slots de consumíveis e montaria rápida na tela de exploração.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_PETS_PANEL',
        'HUD Companheiros / Pets Equipados',
        'EXPLORE_HUD',
        '#hudPetsSection',
        'Painel lateral listando até 3 pets equipados com barras de vida na exploração.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.92 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_JOYSTICK_EXPLORE',
        'Joystick Virtual (Modo Exploração)',
        'EXPLORE_HUD',
        '#hudJoystickSection',
        'Controle analógico virtual na tela de exploração para dispositivos touch.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_BOTTOM_MENU',
        'Menu Inferior Principal (6 Botões)',
        'EXPLORE_HUD',
        '#hudBottomMenuSection',
        'Barra de navegação inferior: Personagem, Mochila, Pets, Missões, Loja e Eventos.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_CHAT',
        'HUD de Chat Multi-Canal (Geral, Mapa, Grupo, Sistema)',
        'EXPLORE_HUD',
        '#hudChatSection',
        'Caixa de bate-papo interativa com abas de canais, histórico de mensagens, campo de texto e botão de minimizar.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'HUD_INTERACTION_PROMPT',
        'Botão Contextual de Interação (NPC / Portal)',
        'EXPLORE_HUD',
        '#interactionPrompt',
        'Prompt central exibido quando o jogador se aproxima de um NPC ou portal de teleporte.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),

      // 2. COMBAT_HUD (HUDs de Batalha no Véu)
      mk(
        'COMBAT_JOYSTICK',
        'Joystick Virtual (Modo Batalha no Véu)',
        'COMBAT_HUD',
        '#actionJoystickZone',
        'Analógico de movimentação em combate posicionado à esquerda no modo batalha.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'COMBAT_SKILLS_CLUSTER',
        'Cluster de Ataque & Habilidades (Estilo Wild Rift)',
        'COMBAT_HUD',
        '#actionButtonsCluster',
        'Conjunto radial no canto inferior direito com Ataque Básico, 5 Skills e 2 Atalhos em batalha.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'COMBAT_PREP_BANNER',
        'Banner de Preparação Tática (Contagem do Véu)',
        'COMBAT_HUD',
        '#actionPrepBanner',
        'Painel superior exibido durante os segundos de preparação antes do combate iniciar.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.92 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'COMBAT_TOP_COUNTER',
        'Placar Superior da Arena (Inimigos Restantes)',
        'COMBAT_HUD',
        '.action-hud-top',
        'Barra superior da arena de combate exibindo nome do encontro e contagem de inimigos vivos.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
      mk(
        'COMBAT_RESULT_BANNER',
        'Modal de Resultado de Combate (Vitória / Derrota)',
        'COMBAT_HUD',
        '#actionResultBanner',
        'Janela central exibida ao final da batalha no Véu com XP, Ouro e Espólios obtidos.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),

      // 3. MODAL (Janelas e Modais do Jogador)
      mk(
        'MODAL_CHARACTER',
        'Modal de Ficha do Personagem & Equipamentos',
        'MODAL',
        '#playCharacterModal > div',
        'Janela de equipamentos (12 slots), distribuição de atributos base e status de combate.',
        { maxWidthVw: 96, maxHeightVh: 90, scale: 1.0 },
        { maxWidthVw: 92, maxHeightVh: 90, scale: 0.96 },
        { widthPx: 880, maxWidthVw: 92, maxHeightVh: 88, scale: 1.0 }
      ),
      mk(
        'MODAL_INVENTORY',
        'Modal de Mochila & Inventário',
        'MODAL',
        '#playBagModal > div',
        'Janela da mochila com abas de Equipamentos, Consumíveis e Materiais de Caça.',
        { maxWidthVw: 96, maxHeightVh: 88, scale: 1.0 },
        { maxWidthVw: 90, maxHeightVh: 88, scale: 0.96 },
        { widthPx: 720, maxWidthVw: 90, maxHeightVh: 86, scale: 1.0 }
      ),
      mk(
        'MODAL_QUEST_LOG',
        'Modal de Diário de Missões (Quests)',
        'MODAL',
        '#playQuestLogModal > div',
        'Janela listando missões em andamento, disponíveis no mapa e concluídas.',
        { maxWidthVw: 95, maxHeightVh: 86, scale: 1.0 },
        { maxWidthVw: 88, maxHeightVh: 86, scale: 0.96 },
        { widthPx: 540, maxWidthVw: 90, maxHeightVh: 84, scale: 1.0 }
      ),
      mk(
        'MODAL_NPC_DIALOGUE',
        'Modal de Diálogo de NPC & Recompensas',
        'MODAL',
        '#playNpcQuestModal > div',
        'Janela de conversa com NPCs, narrativa da Ordem do Véu e entrega de missões.',
        { maxWidthVw: 95, maxHeightVh: 86, scale: 1.0 },
        { maxWidthVw: 88, maxHeightVh: 86, scale: 0.96 },
        { widthPx: 520, maxWidthVw: 90, maxHeightVh: 84, scale: 1.0 }
      ),
      mk(
        'MODAL_LOCAL_MAP',
        'Modal de Mapa Local & Radar Territorial',
        'MODAL',
        '#playLocalMapModal > div',
        'Mapa tático da região atual exibindo NPCs, portais e posição do jogador.',
        { maxWidthVw: 96, maxHeightVh: 88, scale: 1.0 },
        { maxWidthVw: 90, maxHeightVh: 88, scale: 0.96 },
        { widthPx: 760, maxWidthVw: 92, maxHeightVh: 86, scale: 1.0 }
      ),
      mk(
        'MODAL_WORLD_MAP',
        'Modal de Mapa Mundo (Continentes Drag & Zoom)',
        'MODAL',
        '#playWorldMapModal > div',
        'Atlas interativo dos continentes com suporte a arrastar (pan), zoom e pinos de mapas.',
        { maxWidthVw: 96, maxHeightVh: 90, scale: 1.0 },
        { maxWidthVw: 92, maxHeightVh: 90, scale: 0.96 },
        { widthPx: 920, maxWidthVw: 94, maxHeightVh: 88, scale: 1.0 }
      ),
      mk(
        'MODAL_PETS',
        'Modal de Companheiros & Pets',
        'MODAL',
        '#hudPetsModal .hud-modal-dialog',
        'Janela para visualizar a formação de pets e catálogo de monstros disponíveis como pet.',
        { maxWidthVw: 94, maxHeightVh: 86, scale: 1.0 },
        { maxWidthVw: 86, maxHeightVh: 86, scale: 0.96 },
        { widthPx: 560, maxWidthVw: 90, maxHeightVh: 84, scale: 1.0 }
      ),
      mk(
        'MODAL_SHOP',
        'Modal de Loja & Mercador',
        'MODAL',
        '#hudShopModal .hud-modal-dialog',
        'Janela de comércio de itens, consumíveis e pacotes da loja.',
        { maxWidthVw: 94, maxHeightVh: 86, scale: 1.0 },
        { maxWidthVw: 86, maxHeightVh: 86, scale: 0.96 },
        { widthPx: 560, maxWidthVw: 90, maxHeightVh: 84, scale: 1.0 }
      ),
      mk(
        'MODAL_EVENTS',
        'Modal de Eventos do Continente',
        'MODAL',
        '#hudEventsModal .hud-modal-dialog',
        'Janela de eventos ativos, chefes mundiais e calendário de recompensas.',
        { maxWidthVw: 94, maxHeightVh: 86, scale: 1.0 },
        { maxWidthVw: 86, maxHeightVh: 86, scale: 0.96 },
        { widthPx: 560, maxWidthVw: 90, maxHeightVh: 84, scale: 1.0 }
      ),
      mk(
        'MODAL_SETTINGS',
        'Modal de Configurações & Fuga da Batalha',
        'MODAL',
        '#hudSettingsModal .hud-modal-dialog',
        'Janela de opções gráficas, troca de personagem, logout e botão de Fuga durante combates.',
        { maxWidthVw: 92, maxHeightVh: 84, scale: 1.0 },
        { maxWidthVw: 82, maxHeightVh: 84, scale: 0.96 },
        { widthPx: 460, maxWidthVw: 88, maxHeightVh: 82, scale: 1.0 }
      ),

      // 4. INTERFACE (Interfaces Especiais)
      mk(
        'INTERFACE_GM_DRAWER',
        'Gaveta de Ferramentas GM / Dev (Painel Lateral)',
        'INTERFACE',
        '#gmDrawer',
        'Painel de comando e teleporte rápido exclusivo para contas DEV/GM dentro do /play.',
        { offsetX: 0, offsetY: 0, scale: 1.0 },
        { offsetX: 0, offsetY: 0, scale: 0.95 },
        { offsetX: 0, offsetY: 0, scale: 1.0 }
      ),
    ];
  }

  public async seedInitialUiLayoutsIfEmpty(): Promise<void> {
    try {
      const defaults = AdminUiLayoutsController.getDefaultSeeds();
      let createdAny = false;

      for (const seed of defaults) {
        const existing = await this.prisma.clientUiLayoutTemplate.findUnique({
          where: { code: seed.code },
        });
        if (!existing) {
          await this.prisma.clientUiLayoutTemplate.create({
            data: {
              code: seed.code,
              namePtBr: seed.namePtBr,
              category: seed.category,
              domSelector: seed.domSelector,
              descriptionPtBr: seed.descriptionPtBr || '',
              mobilePortraitJson: seed.mobilePortrait as any,
              mobileLandscapeJson: seed.mobileLandscape as any,
              desktopJson: seed.desktop as any,
              isActive: seed.isActive !== false,
            },
          });
          createdAny = true;
        }
      }

      if (createdAny) {
        await this.snapshotManager.exportToDisk();
      }
    } catch (err) {
      console.error('⚠️ Erro ao semear layouts de interface iniciais:', err);
    }
  }

  private formatRow(row: {
    id: number;
    code: string;
    namePtBr: string;
    category: string;
    domSelector: string;
    descriptionPtBr: string | null;
    mobilePortraitJson: unknown;
    mobileLandscapeJson: unknown;
    desktopJson: unknown;
    isActive: boolean;
  }) {
    return {
      id: row.id,
      code: row.code,
      namePtBr: row.namePtBr,
      category: row.category,
      domSelector: row.domSelector,
      descriptionPtBr: row.descriptionPtBr || '',
      mobilePortrait: normalizeViewportConfig(row.mobilePortraitJson),
      mobileLandscape: normalizeViewportConfig(row.mobileLandscapeJson),
      desktop: normalizeViewportConfig(row.desktopJson),
      isActive: row.isActive,
    };
  }

  public async getUiLayouts() {
    await this.seedInitialUiLayoutsIfEmpty();
    const rows = await this.prisma.clientUiLayoutTemplate.findMany({
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.formatRow(r));
  }

  public async createUiLayout(dto: UpsertClientUiLayoutDto) {
    const code = String(dto.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    const namePtBr = String(dto.namePtBr || '').trim();
    const domSelector = String(dto.domSelector || '').trim();

    if (!code || !namePtBr || !domSelector) {
      throw new Error('Código, Nome em Português e Seletor DOM são obrigatórios.');
    }

    const validCategories = ['EXPLORE_HUD', 'COMBAT_HUD', 'MODAL', 'INTERFACE'];
    const category = validCategories.includes(dto.category) ? dto.category : 'EXPLORE_HUD';

    const created = await this.prisma.clientUiLayoutTemplate.create({
      data: {
        code,
        namePtBr,
        category,
        domSelector,
        descriptionPtBr: String(dto.descriptionPtBr || '').trim(),
        mobilePortraitJson: normalizeViewportConfig(dto.mobilePortrait) as any,
        mobileLandscapeJson: normalizeViewportConfig(dto.mobileLandscape) as any,
        desktopJson: normalizeViewportConfig(dto.desktop) as any,
        isActive: dto.isActive !== false,
      },
    });

    await this.snapshotManager.exportToDisk();
    return this.formatRow(created);
  }

  public async updateUiLayout(id: number, dto: Partial<UpsertClientUiLayoutDto>) {
    const existing = await this.prisma.clientUiLayoutTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Layout de UI #${id} não encontrado.`);
    }

    const validCategories = ['EXPLORE_HUD', 'COMBAT_HUD', 'MODAL', 'INTERFACE'];
    const category =
      dto.category && validCategories.includes(dto.category) ? dto.category : existing.category;

    const updated = await this.prisma.clientUiLayoutTemplate.update({
      where: { id },
      data: {
        code: dto.code
          ? String(dto.code)
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9_]/g, '_')
          : existing.code,
        namePtBr: dto.namePtBr !== undefined ? String(dto.namePtBr).trim() : existing.namePtBr,
        category,
        domSelector:
          dto.domSelector !== undefined ? String(dto.domSelector).trim() : existing.domSelector,
        descriptionPtBr:
          dto.descriptionPtBr !== undefined
            ? String(dto.descriptionPtBr).trim()
            : existing.descriptionPtBr,
        mobilePortraitJson:
          dto.mobilePortrait !== undefined
            ? (normalizeViewportConfig(dto.mobilePortrait) as any)
            : (existing.mobilePortraitJson as any),
        mobileLandscapeJson:
          dto.mobileLandscape !== undefined
            ? (normalizeViewportConfig(dto.mobileLandscape) as any)
            : (existing.mobileLandscapeJson as any),
        desktopJson:
          dto.desktop !== undefined
            ? (normalizeViewportConfig(dto.desktop) as any)
            : (existing.desktopJson as any),
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    return this.formatRow(updated);
  }

  public async deleteUiLayout(id: number) {
    await this.prisma.clientUiLayoutTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deleted: true, id };
  }

  public async resetDefaultUiLayouts() {
    const defaults = AdminUiLayoutsController.getDefaultSeeds();
    for (const seed of defaults) {
      await this.prisma.clientUiLayoutTemplate.upsert({
        where: { code: seed.code },
        update: {
          namePtBr: seed.namePtBr,
          category: seed.category,
          domSelector: seed.domSelector,
          descriptionPtBr: seed.descriptionPtBr || '',
          mobilePortraitJson: seed.mobilePortrait as any,
          mobileLandscapeJson: seed.mobileLandscape as any,
          desktopJson: seed.desktop as any,
          isActive: true,
        },
        create: {
          code: seed.code,
          namePtBr: seed.namePtBr,
          category: seed.category,
          domSelector: seed.domSelector,
          descriptionPtBr: seed.descriptionPtBr || '',
          mobilePortraitJson: seed.mobilePortrait as any,
          mobileLandscapeJson: seed.mobileLandscape as any,
          desktopJson: seed.desktop as any,
          isActive: true,
        },
      });
    }
    await this.snapshotManager.exportToDisk();
    return this.getUiLayouts();
  }

  public async bulkUpdateUiLayouts(
    items: Array<{
      id: number;
      mobilePortrait?: Partial<UiViewportLayoutConfig>;
      mobileLandscape?: Partial<UiViewportLayoutConfig>;
      desktop?: Partial<UiViewportLayoutConfig>;
      isActive?: boolean;
    }>
  ) {
    if (!Array.isArray(items)) {
      throw new Error('Lista de layouts inválida para salvamento em lote.');
    }
    for (const item of items) {
      const id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const existing = await this.prisma.clientUiLayoutTemplate.findUnique({ where: { id } });
      if (!existing) continue;

      await this.prisma.clientUiLayoutTemplate.update({
        where: { id },
        data: {
          mobilePortraitJson:
            item.mobilePortrait !== undefined
              ? (normalizeViewportConfig(item.mobilePortrait) as any)
              : (existing.mobilePortraitJson as any),
          mobileLandscapeJson:
            item.mobileLandscape !== undefined
              ? (normalizeViewportConfig(item.mobileLandscape) as any)
              : (existing.mobileLandscapeJson as any),
          desktopJson:
            item.desktop !== undefined
              ? (normalizeViewportConfig(item.desktop) as any)
              : (existing.desktopJson as any),
          isActive: item.isActive !== undefined ? Boolean(item.isActive) : existing.isActive,
        },
      });
    }
    await this.snapshotManager.exportToDisk();
    return this.getUiLayouts();
  }
}
