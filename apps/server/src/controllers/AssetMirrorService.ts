/**
 * @file apps/server/src/controllers/AssetMirrorService.ts
 * @module @etheria/server
 * @description Espelho e Cache Persistente em Disco (`apps/server/cache/mcrework/`) para todos os
 *   assets curados do jogo (mapas, personagens, NPCs, monstros, pets, montarias, itens, ícones e VFX).
 *   Garante autonomia total frente a instabilidades ou rate-limits externos do GitHub, e expõe o
 *   manifesto de download offline/local (`/api/play/assets-manifest`) para o client `/play`.
 * @rules
 *   1. O repositório `mcrework` é usado apenas no `/admin` para descoberta de assets novos; após salvamento,
 *      todos os assets são baixados localmente e servidos em mesma origem (`/api/assets/mcrework/*`).
 *   2. Bloqueia qualquer tentativa de path traversal (`..` ou `\`) garantindo resolução estrita dentro de `cache/mcrework/`.
 * @dependencies node:fs/promises, node:fs, node:path, node:url, @etheria/database
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@etheria/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AssetMirrorService {
  private readonly cacheRootDir: string;
  private readonly publicRootDir: string;
  private readonly remoteBaseUrl: string;
  private readonly inFlight = new Map<string, Promise<Buffer | null>>();

  private static readonly MIME_BY_EXT: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json; charset=utf-8',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  constructor(cacheRootDir?: string, remoteBaseUrl?: string) {
    this.cacheRootDir = cacheRootDir ?? path.resolve(__dirname, '../../cache/mcrework');
    this.publicRootDir = path.resolve(__dirname, '../../public');
    this.remoteBaseUrl = (
      remoteBaseUrl ??
      process.env.MCREWORK_PAGES_URL ??
      'https://seytanir.github.io/mcrework'
    ).replace(/\/+$/, '');
  }

  public normalizeRelPath(inputPath: string): string | null {
    const trimmed = String(inputPath || '').trim();
    if (!trimmed) return null;

    let rel = trimmed;
    if (rel.startsWith('http://') || rel.startsWith('https://')) {
      try {
        const u = new URL(rel);
        const assetMatch = u.pathname.match(/\/(assets\/.+)$/i);
        rel = assetMatch ? assetMatch[1] : u.pathname.replace(/^\/mcrework\//i, '').replace(/^\/+/, '');
      } catch {
        return null;
      }
    } else {
      rel = rel.replace(/^\/api\/assets\/mcrework\//i, '').replace(/^\/+/, '');
    }

    if (rel.includes('..') || rel.includes('\\')) {
      return null;
    }

    const safe = path.posix.normalize(rel).replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
    if (!safe || safe.includes('..') || !safe.startsWith('assets/')) {
      return null;
    }
    return safe;
  }

  public static toSameOriginUrl(relOrRemote: string | null | undefined): string {
    if (!relOrRemote) return '';
    const trimmed = String(relOrRemote).trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/api/assets/mcrework/') || trimmed.startsWith('/api/')) return trimmed;
    if (trimmed.startsWith('/assets/worldmap/') || trimmed.startsWith('/assets/maps/') || trimmed.startsWith('/play/') || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const m = trimmed.match(/\/(assets\/.+)$/i);
      if (m) return `/api/assets/mcrework/${m[1]}`;
      return trimmed;
    }
    return `/api/assets/mcrework/${trimmed.replace(/^\/+/, '')}`;
  }

  public getContentType(relPath: string): string {
    const ext = path.posix.extname(relPath).toLowerCase();
    return AssetMirrorService.MIME_BY_EXT[ext] || 'application/octet-stream';
  }

  /**
   * Lê as dimensões reais (width x height) diretamente do cabeçalho PNG, JPEG ou WEBP em memória.
   */
  public static getImageDimensions(buf: Buffer): { width: number; height: number } | null {
    if (!buf || buf.length < 24) return null;
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buf.length) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        if (marker === 0x00 || marker === 0xff) {
          offset++;
          continue;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
          offset += 2;
          continue;
        }
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          return {
            height: buf.readUInt16BE(offset + 5),
            width: buf.readUInt16BE(offset + 7),
          };
        }
        const segLen = buf.readUInt16BE(offset + 2);
        if (segLen < 2) break;
        offset += 2 + segLen;
      }
    }
    // WEBP (VP8X / VP8 / VP8L)
    if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        return { width: w, height: h };
      }
      if (chunk === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L' && buf[20] === 0x2f) {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    return null;
  }

  private getDiskPath(relPath: string): string | null {
    const resolvedRoot = path.resolve(this.cacheRootDir);
    const full = path.resolve(resolvedRoot, relPath);
    if (!full.startsWith(resolvedRoot + path.sep)) return null;
    return full;
  }

  private getPublicDiskPath(relPath: string): string | null {
    const full = path.resolve(this.publicRootDir, relPath);
    if (!full.startsWith(this.publicRootDir + path.sep)) return null;
    return full;
  }

  /**
   * Obtém o buffer do arquivo diretamente do disco local (`public/` para mapas enviados por upload ou
   * `cache/mcrework/` para assets curados) ou baixa do GitHub Pages gravando em cache persistente.
   */
  public async getOrFetchAsset(rawRelOrUrl: string): Promise<{ buffer: Buffer; contentType: string; relPath: string } | null> {
    const relPath = this.normalizeRelPath(rawRelOrUrl);
    if (!relPath) return null;

    // 1. Verifica primeiro arquivos locais em `apps/server/public/` (ex: `/assets/maps/uploaded/*`, `/assets/worldmap/*`)
    const publicPath = this.getPublicDiskPath(relPath);
    if (publicPath && fsSync.existsSync(publicPath)) {
      try {
        const buffer = await fs.readFile(publicPath);
        if (buffer.length > 0) {
          return { buffer, contentType: this.getContentType(relPath), relPath };
        }
      } catch {
        // Continua para cache/remoto se leitura falhar
      }
    }

    const diskPath = this.getDiskPath(relPath);
    if (!diskPath) return null;

    if (fsSync.existsSync(diskPath)) {
      try {
        const buffer = await fs.readFile(diskPath);
        if (buffer.length > 0) {
          return { buffer, contentType: this.getContentType(relPath), relPath };
        }
      } catch {
        // Rebaixa se leitura falhar
      }
    }

    let pending = this.inFlight.get(relPath);
    if (!pending) {
      pending = (async () => {
        try {
          const upstreamUrl = `${this.remoteBaseUrl}/${relPath}`;
          const res = await globalThis.fetch(upstreamUrl);
          if (!res.ok) return null;
          const arrBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          if (buf.length === 0) return null;

          await fs.mkdir(path.dirname(diskPath), { recursive: true });
          const tmpPath = `${diskPath}.tmp.${process.pid}`;
          await fs.writeFile(tmpPath, buf);
          await fs.rename(tmpPath, diskPath);
          return buf;
        } catch {
          return null;
        } finally {
          this.inFlight.delete(relPath);
        }
      })();
      this.inFlight.set(relPath, pending);
    }

    const buffer = await pending;
    if (!buffer) return null;
    return { buffer, contentType: this.getContentType(relPath), relPath };
  }

  /**
   * Lista todos os caminhos relativos `assets/...` utilizados pelas entidades curadas no PostgreSQL.
   */
  public async collectCuratedRelPaths(prisma: PrismaClient): Promise<{
    mapEntries: Array<{ id: number; relPath: string }>;
    relPaths: string[];
  }> {
    const [maps, classes, npcs, monsters, skills, statuses, items] = await Promise.all([
      prisma.gameMap.findMany({ select: { id: true, mcreworkMapImage: true } }),
      prisma.classTemplate.findMany({ select: { mcreworkCharKey: true, rebornMcreworkCharKey: true } }),
      prisma.npcTemplate.findMany({ select: { mcreworkNpcKey: true } }),
      prisma.monsterTemplate.findMany({ select: { mcreworkMonsterKey: true } }),
      prisma.skillTemplate.findMany({ select: { mcreworkIconKey: true, mcreworkVfxKey: true } }),
      prisma.statusEffectTemplate.findMany({ select: { iconKey: true, mcreworkVfxKey: true } }),
      prisma.itemTemplate.findMany({ select: { mcreworkIconKey: true, specialEffectJson: true } }),
    ]);

    const set = new Set<string>();
    const addRel = (val: string | null | undefined) => {
      const norm = val ? this.normalizeRelPath(val) : null;
      if (norm) set.add(norm);
    };

    const mapEntries: Array<{ id: number; relPath: string }> = [];
    for (const m of maps) {
      const norm = this.normalizeRelPath(m.mcreworkMapImage);
      if (norm) {
        set.add(norm);
        mapEntries.push({ id: m.id, relPath: norm });
      }
    }

    for (const c of classes) {
      for (const k of [c.mcreworkCharKey, c.rebornMcreworkCharKey]) {
        if (!k) continue;
        addRel(`assets/characters/${k}/atlas.json`);
        addRel(`assets/characters/${k}/atlas.webp`);
        addRel(`assets/characters/${k}/thumb.webp`);
      }
    }

    for (const n of npcs) {
      if (!n.mcreworkNpcKey) continue;
      addRel(`assets/npcs/${n.mcreworkNpcKey}/atlas.json`);
      addRel(`assets/npcs/${n.mcreworkNpcKey}/atlas.webp`);
      addRel(`assets/npcs/${n.mcreworkNpcKey}/thumb.png`);
    }

    for (const mo of monsters) {
      if (!mo.mcreworkMonsterKey) continue;
      addRel(`assets/monsters/${mo.mcreworkMonsterKey}/atlas.json`);
      addRel(`assets/monsters/${mo.mcreworkMonsterKey}/atlas.webp`);
      addRel(`assets/monsters/${mo.mcreworkMonsterKey}/thumb.webp`);
    }

    for (const sk of skills) {
      addRel(sk.mcreworkIconKey);
      if (sk.mcreworkVfxKey) {
        const vk = String(sk.mcreworkVfxKey).trim();
        addRel(`assets/effects/${vk}/atlas.json`);
        addRel(`assets/effects/${vk}/atlas.webp`);
        addRel(`assets/effects/${vk}/thumb.png`);
      }
    }

    for (const st of statuses) {
      addRel(st.iconKey);
      if (st.mcreworkVfxKey) {
        const vk = String(st.mcreworkVfxKey).trim();
        addRel(`assets/effects/${vk}/atlas.json`);
        addRel(`assets/effects/${vk}/atlas.webp`);
        addRel(`assets/effects/${vk}/thumb.png`);
      }
    }

    // Ícones fallback utilizados pelo motor de combate
    addRel('assets/skills/icons/100156.png');
    addRel('assets/skills/icons/100180.png');
    addRel('assets/skills/icons/100150.png');

    for (const it of items) {
      addRel(it.mcreworkIconKey);
      const fx = (it.specialEffectJson && typeof it.specialEffectJson === 'object' ? it.specialEffectJson : {}) as any;
      const modelId = String(fx.wingModelId || fx.mountModelId || '').trim();
      if (modelId && (modelId.startsWith('equip_wing_') || modelId.startsWith('equip_fly_'))) {
        addRel(`assets/wings/${modelId}/char_manifest.json`);
        addRel(`assets/wings/${modelId}/thumb.png`);
      } else if (modelId && modelId.startsWith('mount_')) {
        addRel(`assets/mounts/${modelId}/atlas.json`);
        addRel(`assets/mounts/${modelId}/atlas.webp`);
        addRel(`assets/mounts/${modelId}/thumb.webp`);
      }
      const weaponModelId = String(fx.weaponModelId || '').trim();
      const weaponFemaleModelId = String(fx.weaponFemaleModelId || '').trim();
      if (weaponModelId) addRel(`assets/weapons/${weaponModelId}/char_manifest.json`);
      if (weaponFemaleModelId) addRel(`assets/weapons/${weaponFemaleModelId}/char_manifest.json`);
    }

    return { mapEntries, relPaths: Array.from(set) };
  }

  /**
   * Pré-aquece o cache persistente em disco na VPS para todos os assets curados ativos no banco.
   */
  public async prewarmCuratedAssets(prisma: PrismaClient): Promise<number> {
    try {
      const { relPaths } = await this.collectCuratedRelPaths(prisma);
      let okCount = 0;
      const concurrency = 6;
      for (let i = 0; i < relPaths.length; i += concurrency) {
        const batch = relPaths.slice(i, i + concurrency);
        const results = await Promise.all(batch.map((rel) => this.getOrFetchAsset(rel)));
        for (const r of results) {
          if (r) okCount++;
        }
      }
      // Pré-aquece também todos os frames individuais (bmp_*.png) de asas, planadores e armas já salvos (sem duplicatas)
      const visualItems = await prisma.itemTemplate.findMany({
        select: { specialEffectJson: true },
      });
      const seenWingOrMount = new Set<string>();
      const seenWeapons = new Set<string>();
      for (const it of visualItems) {
        if (!it.specialEffectJson || typeof it.specialEffectJson !== 'object') continue;
        const fx = it.specialEffectJson as Record<string, unknown>;
        const wingId = typeof fx.wingModelId === 'string' ? fx.wingModelId.trim() : '';
        const mountId = typeof fx.mountModelId === 'string' ? fx.mountModelId.trim() : '';
        const wMaleId = typeof fx.weaponModelId === 'string' ? fx.weaponModelId.trim() : '';
        const wFemaleId = typeof fx.weaponFemaleModelId === 'string' ? fx.weaponFemaleModelId.trim() : '';
        if (wingId && !seenWingOrMount.has(wingId)) {
          seenWingOrMount.add(wingId);
          await this.mirrorMountAssets(wingId);
        }
        if (mountId && !seenWingOrMount.has(mountId)) {
          seenWingOrMount.add(mountId);
          await this.mirrorMountAssets(mountId);
        }
        if (wMaleId && !seenWeapons.has(wMaleId)) {
          seenWeapons.add(wMaleId);
          await this.mirrorWeaponAssets(wMaleId);
        }
        if (wFemaleId && !seenWeapons.has(wFemaleId)) {
          seenWeapons.add(wFemaleId);
          await this.mirrorWeaponAssets(wFemaleId);
        }
      }
      console.log(`📦 [AssetMirrorService] ${okCount}/${relPaths.length} assets curados prontos no disco local da VPS.`);
      return okCount;
    } catch (err: any) {
      console.warn(`[AssetMirrorService] Falha parcial no pré-aquecimento em disco: ${err?.message || err}`);
      return 0;
    }
  }

  /**
   * Gera a lista completa de URLs same-origin para o client `/play` baixar em cache local (Cache Storage).
   */
  public async buildPlayAssetsManifest(prisma: PrismaClient) {
    const { mapEntries, relPaths } = await this.collectCuratedRelPaths(prisma);
    const urls = new Set<string>();

    // Mapas via endpoint dedicado e direto
    for (const me of mapEntries) {
      urls.add(`/api/assets/map-image/${me.id}`);
    }
    for (const rel of relPaths) {
      urls.add(`/api/assets/mcrework/${rel}`);
    }

    // Ícones customizados locais sob `/play/assets/` (ex: ícones de pesca recortados localmente)
    const customLocalItems = await prisma.itemTemplate.findMany({
      where: { mcreworkIconKey: { startsWith: '/play/assets/' } },
      select: { mcreworkIconKey: true },
    });
    for (const ci of customLocalItems) {
      if (ci.mcreworkIconKey) urls.add(ci.mcreworkIconKey);
    }

    // Imagens dos mapas gerais e logo já hospedados na VPS
    urls.add('/assets/worldmap/world_map_1_base.png');
    urls.add('/assets/worldmap/world_map_2_base.png');
    urls.add('/assets/worldmap/etheria_campus_logo.png');

    // Assets Visuais da HUD Principal Mobile
    const hudFiles = [
      '/play/assets/hud/player_avatar_frame.png',
      '/play/assets/hud/minimap_frame.png',
      '/play/assets/hud/settings_gear_icon.png',
      '/play/assets/hud/gold_coin_icon.png',
      '/play/assets/hud/crystal_gem_icon.png',
      '/play/assets/hud/joystick_center_interact.png',
      '/play/assets/hud/joystick_outer_ring.png',
      '/play/assets/hud/pet_avatar_frame.png',
      '/play/assets/hud/shortcut_slot_bg.png',
      '/play/assets/hud/menu_shop.png',
      '/play/assets/hud/menu_pets.png',
      '/play/assets/hud/menu_character.png',
      '/play/assets/hud/menu_inventory.png',
      '/play/assets/hud/menu_quests.png',
      '/play/assets/hud/menu_events.png',
      '/play/assets/hud/shortcut_potion_hp.png',
      '/play/assets/hud/shortcut_potion_mp.png',
      '/play/assets/hud/shortcut_food_bread.png',
      '/play/assets/hud/shortcut_scroll_teleport.png',
      '/play/assets/hud/shortcut_potion_antidote.png',
      '/play/assets/hud/shortcut_potion_buff.png',
    ];
    for (const h of hudFiles) urls.add(h);

    return {
      version: 'v0.15.0',
      totalCount: urls.size,
      assets: Array.from(urls),
    };
  }

  /**
   * Baixa e instala imediatamente no disco da VPS (`apps/server/cache/mcrework/`) o arquivo de imagem do mapa.
   */
  public async mirrorMapImage(mapImagePath: string | null | undefined): Promise<void> {
    if (!mapImagePath) return;
    const rel = this.normalizeRelPath(mapImagePath);
    if (rel) {
      await this.getOrFetchAsset(rel);
    }
  }

  /**
   * Baixa e instala no disco da VPS o pacote completo de sprites de uma Classe de Personagem (atlas.json, atlas.webp, thumb.webp).
   */
  public async mirrorClassAssets(charKey: string | null | undefined, rebornCharKey?: string | null | undefined): Promise<void> {
    const keys = [charKey, rebornCharKey].filter(Boolean) as string[];
    const tasks: Promise<unknown>[] = [];
    for (const k of keys) {
      tasks.push(
        this.getOrFetchAsset(`assets/characters/${k}/atlas.json`),
        this.getOrFetchAsset(`assets/characters/${k}/atlas.webp`),
        this.getOrFetchAsset(`assets/characters/${k}/thumb.webp`)
      );
    }
    await Promise.allSettled(tasks);
  }

  /**
   * Baixa e instala no disco da VPS o pacote completo de sprites de um NPC (atlas.json, atlas.webp, thumb.png).
   */
  public async mirrorNpcAssets(npcKey: string | null | undefined): Promise<void> {
    if (!npcKey) return;
    await Promise.allSettled([
      this.getOrFetchAsset(`assets/npcs/${npcKey}/atlas.json`),
      this.getOrFetchAsset(`assets/npcs/${npcKey}/atlas.webp`),
      this.getOrFetchAsset(`assets/npcs/${npcKey}/thumb.png`),
    ]);
  }

  /**
   * Baixa e instala no disco da VPS o pacote completo de sprites de um Monstro (atlas.json, atlas.webp, thumb.webp).
   */
  public async mirrorMonsterAssets(monsterKey: string | null | undefined): Promise<void> {
    if (!monsterKey) return;
    await Promise.allSettled([
      this.getOrFetchAsset(`assets/monsters/${monsterKey}/atlas.json`),
      this.getOrFetchAsset(`assets/monsters/${monsterKey}/atlas.webp`),
      this.getOrFetchAsset(`assets/monsters/${monsterKey}/thumb.webp`),
    ]);
  }

  /**
   * Baixa e instala no disco da VPS todos os frames listados dentro de um `char_manifest.json`.
   */
  private async mirrorManifestFrames(manifestRelPath: string, concurrency: number = 8): Promise<void> {
    const manifestAsset = await this.getOrFetchAsset(manifestRelPath);
    if (!manifestAsset?.buffer) return;
    try {
      const manifestData = JSON.parse(manifestAsset.buffer.toString('utf-8')) as Record<string, any>;
      const frameFiles = new Set<string>();
      for (const seq of Object.values(manifestData)) {
        if (!Array.isArray(seq)) continue;
        for (const entry of seq) {
          if (entry && typeof entry.file === 'string' && entry.file.trim()) {
            frameFiles.add(entry.file.replace(/^\/+/, ''));
          }
        }
      }
      const list = Array.from(frameFiles);
      for (let i = 0; i < list.length; i += concurrency) {
        await Promise.allSettled(list.slice(i, i + concurrency).map((rel) => this.getOrFetchAsset(rel)));
      }
    } catch {
      // Ignora manifesto inválido
    }
  }

  /**
   * Baixa e instala no disco da VPS o `char_manifest.json`, thumbs e todos os frames `bmp_*.png`
   * de uma Asa Celestial ou Planador (`equip_wing_*` / `equip_fly_*`).
   */
  public async mirrorWingAssets(modelId: string | null | undefined): Promise<void> {
    if (!modelId) return;
    const cleanId = String(modelId).trim();
    if (!cleanId) return;

    await Promise.allSettled([
      this.mirrorManifestFrames(`assets/wings/${cleanId}/char_manifest.json`, 6),
      this.getOrFetchAsset(`assets/wings/${cleanId}/thumb.png`),
      this.getOrFetchAsset(`assets/wings/${cleanId}/thumb.webp`),
    ]);
  }

  /**
   * Baixa e instala no disco da VPS o `char_manifest.json` e todos os frames `bmp_*.png` de uma Arma 2.5D (`equip_mc*` / `equip_fc*`).
   */
  public async mirrorWeaponAssets(modelId: string | null | undefined): Promise<void> {
    if (!modelId) return;
    const cleanId = String(modelId).trim();
    if (!cleanId) return;
    await this.mirrorManifestFrames(`assets/weapons/${cleanId}/char_manifest.json`, 12);
  }

  /**
   * Baixa e instala no disco da VPS o pacote completo de sprites de uma Montaria ou Asa/Planador.
   */
  public async mirrorMountAssets(mountKey: string | null | undefined): Promise<void> {
    if (!mountKey) return;
    const cleanKey = String(mountKey).trim();
    if (!cleanKey) return;
    if (cleanKey.startsWith('equip_wing_') || cleanKey.startsWith('equip_fly_')) {
      await this.mirrorWingAssets(cleanKey);
      return;
    }
    await Promise.allSettled([
      this.getOrFetchAsset(`assets/mounts/${cleanKey}/atlas.json`),
      this.getOrFetchAsset(`assets/mounts/${cleanKey}/atlas.webp`),
      this.getOrFetchAsset(`assets/mounts/${cleanKey}/thumb.webp`),
      this.getOrFetchAsset(`assets/mounts/${cleanKey}/thumb.png`),
    ]);
  }

  /**
   * Espelha automaticamente quaisquer modelos visuais configurados em `specialEffectJson` (`wingModelId`, `mountModelId`, `weaponModelId`, `weaponFemaleModelId`).
   */
  public async mirrorVisualModelAssets(specialEffectJson: unknown): Promise<void> {
    if (!specialEffectJson || typeof specialEffectJson !== 'object') return;
    const fx = specialEffectJson as Record<string, unknown>;
    const wingId = typeof fx.wingModelId === 'string' ? fx.wingModelId.trim() : '';
    const mountId = typeof fx.mountModelId === 'string' ? fx.mountModelId.trim() : '';
    const weaponId = typeof fx.weaponModelId === 'string' ? fx.weaponModelId.trim() : '';
    const weaponFemaleId = typeof fx.weaponFemaleModelId === 'string' ? fx.weaponFemaleModelId.trim() : '';
    if (wingId) await this.mirrorMountAssets(wingId);
    if (mountId && mountId !== wingId) await this.mirrorMountAssets(mountId);
    if (weaponId) await this.mirrorWeaponAssets(weaponId);
    if (weaponFemaleId && weaponFemaleId !== weaponId) await this.mirrorWeaponAssets(weaponFemaleId);
  }

  /**
   * Baixa e instala no disco da VPS o ícone de um Item ou Equipamento.
   */
  public async mirrorItemIcon(iconKey: string | null | undefined): Promise<void> {
    if (!iconKey) return;
    const rel = this.normalizeRelPath(iconKey);
    if (rel) {
      await this.getOrFetchAsset(rel);
    }
  }

  /**
   * Baixa e instala no disco da VPS o ícone e o pacote VFX (atlas.json, atlas.webp, thumb.png) de uma Habilidade ou Efeito de Status.
   */
  public async mirrorSkillOrEffectAssets(iconKey?: string | null, vfxKey?: string | null): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    if (iconKey) {
      const rel = this.normalizeRelPath(iconKey);
      if (rel) tasks.push(this.getOrFetchAsset(rel));
    }
    if (vfxKey && String(vfxKey).trim()) {
      const vk = String(vfxKey).trim();
      tasks.push(
        this.getOrFetchAsset(`assets/effects/${vk}/atlas.json`),
        this.getOrFetchAsset(`assets/effects/${vk}/atlas.webp`),
        this.getOrFetchAsset(`assets/effects/${vk}/thumb.png`)
      );
    }
    await Promise.allSettled(tasks);
  }
}
