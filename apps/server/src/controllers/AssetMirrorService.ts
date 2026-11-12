/**
 * @file apps/server/src/controllers/AssetMirrorService.ts
 * @module @etheria/server
 * @description Espelho e Cache Persistente em Disco (`apps/server/cache/mcrework/`) para todos os
 *   assets curados do jogo (mapas, personagens, NPCs, monstros, pets, montarias, itens, ícones e VFX).
 *   Garante autonomia total frente a instabilidades ou rate-limits externos do GitHub, e expõe o
 *   manifesto de download offline/local (`/api/play/assets-manifest`) para o client `/play`.
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
        rel = u.pathname.replace(/^\/mcrework\//i, '').replace(/^\/+/, '');
      } catch {
        return null;
      }
    } else {
      rel = rel.replace(/^\/api\/assets\/mcrework\//i, '').replace(/^\/+/, '');
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
    if (trimmed.startsWith('/api/assets/mcrework/')) return trimmed;
    if (trimmed.startsWith('/assets/worldmap/') || trimmed.startsWith('/play/')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const m = trimmed.match(/\/mcrework\/(assets\/.+)$/i);
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
    return null;
  }

  private getDiskPath(relPath: string): string | null {
    const full = path.resolve(this.cacheRootDir, relPath);
    if (!full.startsWith(this.cacheRootDir)) return null;
    return full;
  }

  /**
   * Obtém o buffer do arquivo diretamente do disco da VPS ou baixa do GitHub Pages
   * gravando de forma persistente em `apps/server/cache/mcrework/` para os próximos acessos.
   */
  public async getOrFetchAsset(rawRelOrUrl: string): Promise<{ buffer: Buffer; contentType: string; relPath: string } | null> {
    const relPath = this.normalizeRelPath(rawRelOrUrl);
    if (!relPath) return null;
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
    const [maps, classes, npcs, monsters, pets, mounts, skills, statuses, items] = await Promise.all([
      prisma.gameMap.findMany({ select: { id: true, mcreworkMapImage: true } }),
      prisma.classTemplate.findMany({ select: { mcreworkCharKey: true, rebornMcreworkCharKey: true } }),
      prisma.npcTemplate.findMany({ select: { mcreworkNpcKey: true } }),
      prisma.monsterTemplate.findMany({ select: { mcreworkMonsterKey: true } }),
      prisma.petTemplate.findMany({ select: { mcreworkPetKey: true } }),
      prisma.flyingMountTemplate.findMany({ select: { mcreworkMountKey: true } }),
      prisma.skillTemplate.findMany({ select: { mcreworkIconKey: true, mcreworkVfxKey: true } }),
      prisma.statusEffectTemplate.findMany({ select: { iconKey: true, mcreworkVfxKey: true } }),
      prisma.itemTemplate.findMany({ select: { mcreworkIconKey: true } }),
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
      addRel(`assets/monsters/${mo.mcreworkMonsterKey}/thumb.png`);
    }

    for (const p of pets) {
      if (!p.mcreworkPetKey) continue;
      addRel(`assets/pets/${p.mcreworkPetKey}/atlas.json`);
      addRel(`assets/pets/${p.mcreworkPetKey}/atlas.webp`);
      addRel(`assets/pets/${p.mcreworkPetKey}/thumb.png`);
    }

    for (const mt of mounts) {
      if (!mt.mcreworkMountKey) continue;
      addRel(`assets/mounts/${mt.mcreworkMountKey}/atlas.json`);
      addRel(`assets/mounts/${mt.mcreworkMountKey}/atlas.webp`);
      addRel(`assets/mounts/${mt.mcreworkMountKey}/thumb.png`);
    }

    for (const sk of skills) {
      addRel(sk.mcreworkIconKey);
      if (sk.mcreworkVfxKey) {
        const vk = String(sk.mcreworkVfxKey).trim();
        addRel(`assets/effects/${vk}/atlas.json`);
        addRel(`assets/effects/${vk}/atlas.webp`);
      }
    }

    for (const st of statuses) {
      addRel(st.iconKey);
      if (st.mcreworkVfxKey) {
        const vk = String(st.mcreworkVfxKey).trim();
        addRel(`assets/effects/${vk}/atlas.json`);
        addRel(`assets/effects/${vk}/atlas.webp`);
      }
    }

    for (const it of items) {
      addRel(it.mcreworkIconKey);
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

    // Imagens dos mapas gerais e logo já hospedados na VPS
    urls.add('/assets/worldmap/world_map_1_base.png');
    urls.add('/assets/worldmap/world_map_2_base.png');
    urls.add('/assets/worldmap/etheria_campus_logo.png');

    return {
      version: 'v0.14.0',
      totalCount: urls.size,
      assets: Array.from(urls),
    };
  }
}
