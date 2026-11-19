/**
 * @file apps/server/src/controllers/AdminMapUploadController.ts
 * @module @etheria/server/controllers/AdminMapUploadController
 * @description Controlador dedicado ao upload e gerenciamento de imagens customizadas de mapas.
 *   Salva imagens em `apps/server/public/assets/maps/uploaded/`, calcula dimensões reais
 *   e entrega URLs relativas no mesmo domínio (`/assets/maps/uploaded/*`).
 * @rules Segue estritamente AGENTS.md (Regra #7 de modularidade e arquivos < 1.000 linhas).
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { AssetMirrorService } from './AssetMirrorService.js';

export interface UploadMapImageDto {
  filename?: string;
  dataBase64?: string;
  namePtBr?: string;
}

export interface UploadedMapInfo {
  url: string;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
}

export class AdminMapUploadController {
  private readonly uploadDir: string;

  constructor(private readonly publicDir: string) {
    this.uploadDir = path.join(this.publicDir, 'assets/maps/uploaded');
  }

  /**
   * Garante que o diretório de uploads de mapas existe no disco.
   */
  private async ensureUploadDir(): Promise<void> {
    if (!fsSync.existsSync(this.uploadDir)) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Detecta a extensão do arquivo a partir dos magic bytes da imagem.
   */
  private detectImageFormat(buf: Buffer): string {
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return 'png';
    }
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
      return 'jpg';
    }
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return 'webp';
    }
    if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return 'gif';
    }
    return '';
  }

  /**
   * Processa o upload de uma imagem de mapa enviada via Base64.
   */
  public async uploadMapImage(dto: UploadMapImageDto): Promise<UploadedMapInfo> {
    const rawData = String(dto.dataBase64 || '').trim();
    if (!rawData) {
      throw new Error('Nenhum dado de imagem recebido para upload.');
    }

    // Remove prefixo Data URL se presente (ex: "data:image/png;base64,")
    const base64Data = rawData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      throw new Error('Falha ao decodificar imagem enviada.');
    }
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error('A imagem do mapa excede o tamanho máximo permitido de 25 MB.');
    }

    let ext = this.detectImageFormat(buffer);
    if (!ext) {
      const origExt = (path.extname(dto.filename || '') || '').replace(/^\./, '').toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(origExt)) {
        ext = origExt === 'jpeg' ? 'jpg' : origExt;
      } else {
        throw new Error('Formato de imagem não suportado. Por favor, envie uma imagem PNG, JPG ou WEBP.');
      }
    }

    // Calcula dimensões reais em pixels
    const dims = AssetMirrorService.getImageDimensions(buffer);
    const width = dims?.width && dims.width > 0 ? dims.width : 2000;
    const height = dims?.height && dims.height > 0 ? dims.height : 1500;

    await this.ensureUploadDir();

    // Gera nome de arquivo seguro e único
    const rawName = path.basename(dto.filename || dto.namePtBr || 'mapa', path.extname(dto.filename || ''));
    const cleanSlug = rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .slice(0, 32);

    const filename = `map_${Date.now()}_${cleanSlug || 'custom'}.${ext}`;
    const destPath = path.join(this.uploadDir, filename);

    await fs.writeFile(destPath, buffer);

    const url = `/assets/maps/uploaded/${filename}`;
    return {
      url,
      filename,
      width,
      height,
      sizeBytes: buffer.length,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retorna a lista de todas as imagens de mapas já enviadas por upload.
   */
  public async listUploadedMaps(): Promise<UploadedMapInfo[]> {
    await this.ensureUploadDir();
    try {
      const entries = await fs.readdir(this.uploadDir);
      const validExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
      const results: UploadedMapInfo[] = [];

      for (const file of entries) {
        const ext = path.extname(file).toLowerCase();
        if (!validExts.has(ext)) continue;

        const filePath = path.join(this.uploadDir, file);
        try {
          const stats = await fs.stat(filePath);
          let width = 2000;
          let height = 1500;

          // Lê cabeçalho para capturar dimensões reais
          try {
            const fd = await fs.open(filePath, 'r');
            const headBuf = Buffer.alloc(128);
            await fd.read(headBuf, 0, 128, 0);
            await fd.close();
            const dims = AssetMirrorService.getImageDimensions(headBuf);
            if (dims && dims.width > 0 && dims.height > 0) {
              width = dims.width;
              height = dims.height;
            }
          } catch {
            // mantém fallback de resolução
          }

          results.push({
            url: `/assets/maps/uploaded/${file}`,
            filename: file,
            width,
            height,
            sizeBytes: stats.size,
            createdAt: stats.mtime.toISOString(),
          });
        } catch {
          // ignora arquivo inacessível
        }
      }

      // Ordena pelos mais recentes primeiro
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return results;
    } catch (err) {
      console.warn('[AdminMapUploadController] Falha ao listar uploads:', err);
      return [];
    }
  }
}
