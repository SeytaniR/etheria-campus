/**
 * @file apps/server/src/controllers/AdminCrystalShopController.ts
 * @module @etheria/server
 * @description Controlador CRUD administrativo da Loja Cristal (`/api/admin/crystal-shop`),
 *   com gestão de ofertas (item, quantidade, preço em Cristais, Carrossel vs Grid, vigência)
 *   e upload/listagem de imagens locais em `apps/server/public/play/assets/shop/`.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Regra #10 Zero URLs externas).
 * @dependencies node:fs/promises, node:fs, node:path, node:http, @prisma/client, @etheria/database (I18nCache), ./CrystalShopService.js, ./EventDateAndRewardHelper.js
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CrystalShopService } from './CrystalShopService.js';
import { EventDateAndRewardHelper } from './EventDateAndRewardHelper.js';

export interface SaveCrystalOfferDto {
  code: string;
  itemTemplateId: number;
  quantity?: number;
  priceCrystals: number;
  titlePtBr?: string | null;
  descriptionPtBr?: string | null;
  bannerImageUrl?: string;
  iconImageUrl?: string;
  isFeatured?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export class AdminCrystalShopController {
  private readonly shopAssetsDir: string;
  private readonly shopUploadDir: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly publicDir: string
  ) {
    this.shopAssetsDir = path.join(this.publicDir, 'play/assets/shop');
    this.shopUploadDir = path.join(this.shopAssetsDir, 'uploaded');
  }

  private detectImageFormat(buf: Buffer): string {
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return 'webp';
    }
    if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
    return '';
  }

  private parseOptionalDate(val: string | null | undefined, label: string): Date | null {
    const raw = String(val ?? '').trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Data inválida informada em ${label}.`);
    }
    return d;
  }

  private async sanitizeOfferPayload(dto: SaveCrystalOfferDto, isCreate: boolean) {
    const itemTemplateId = Math.round(Number(dto.itemTemplateId) || 0);
    if (itemTemplateId <= 0) {
      throw new Error('Selecione um item válido do catálogo para a oferta.');
    }
    const itemExists = await this.prisma.itemTemplate.findUnique({
      where: { id: itemTemplateId },
      select: { id: true },
    });
    if (!itemExists) {
      throw new Error(`Item #${itemTemplateId} não encontrado no catálogo.`);
    }

    const code = String(dto.code ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    if (isCreate && !/^[a-z0-9_-]{3,48}$/.test(code)) {
      throw new Error('Código da oferta inválido (use 3 a 48 caracteres: a-z, 0-9, _ ou -).');
    }

    const quantity = Math.min(999, Math.max(1, Math.round(Number(dto.quantity) || 1)));
    const priceCrystals = Math.max(1, Math.round(Number(dto.priceCrystals) || 0));
    if (priceCrystals <= 0) {
      throw new Error('O preço em Cristais deve ser maior que zero.');
    }

    const bannerImageUrl = EventDateAndRewardHelper.validateLocalEventAssetUrl(dto.bannerImageUrl);
    const iconImageUrl = EventDateAndRewardHelper.validateLocalEventAssetUrl(dto.iconImageUrl);
    const startsAt = this.parseOptionalDate(dto.startsAt, 'Início da Vigência');
    const endsAt = this.parseOptionalDate(dto.endsAt, 'Término da Vigência');
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new Error('A data de término não pode ser anterior à data de início.');
    }

    const rawTitle = String(dto.titlePtBr ?? '').trim();
    const rawDesc = String(dto.descriptionPtBr ?? '').trim();

    return {
      code,
      itemTemplateId,
      quantity,
      priceCrystals,
      titlePtBr: rawTitle ? rawTitle.slice(0, 120) : null,
      descriptionPtBr: rawDesc ? rawDesc.slice(0, 500) : null,
      bannerImageUrl,
      iconImageUrl,
      isFeatured: Boolean(dto.isFeatured),
      sortOrder: Math.round(Number(dto.sortOrder) || 0),
      isActive: dto.isActive === undefined ? true : Boolean(dto.isActive),
      startsAt,
      endsAt,
    };
  }

  public async listOffers() {
    const [rows, i18nMap] = await Promise.all([
      this.prisma.crystalShopOffer.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          itemTemplate: {
            include: {
              equipmentSlot: true,
              equipmentSet: true,
            },
          },
        },
      }),
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
    ]);

    return rows.map((row) => ({
      ...CrystalShopService.enrichOfferDto(row, i18nMap),
      isActive: row.isActive,
      rawTitlePtBr: row.titlePtBr ?? '',
      rawDescriptionPtBr: row.descriptionPtBr ?? '',
      rawIconImageUrl: row.iconImageUrl ?? '',
      scheduleStatus: EventDateAndRewardHelper.getEventScheduleStatus(row),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  public async createOffer(dto: SaveCrystalOfferDto) {
    const clean = await this.sanitizeOfferPayload(dto, true);
    const existing = await this.prisma.crystalShopOffer.findUnique({ where: { code: clean.code } });
    if (existing) {
      throw new Error(`Já existe uma oferta com o código "${clean.code}".`);
    }
    return this.prisma.crystalShopOffer.create({ data: clean });
  }

  public async updateOffer(id: number, dto: SaveCrystalOfferDto) {
    const safeId = Number(id);
    const existing = await this.prisma.crystalShopOffer.findUnique({ where: { id: safeId } });
    if (!existing) {
      throw new Error(`Oferta #${safeId} não encontrada.`);
    }
    const clean = await this.sanitizeOfferPayload({ ...dto, code: dto.code || existing.code }, false);
    if (clean.code && clean.code !== existing.code) {
      const conflict = await this.prisma.crystalShopOffer.findUnique({ where: { code: clean.code } });
      if (conflict && conflict.id !== safeId) {
        throw new Error(`Código "${clean.code}" já está em uso por outra oferta.`);
      }
    }
    return this.prisma.crystalShopOffer.update({
      where: { id: safeId },
      data: {
        ...clean,
        code: clean.code || existing.code,
      },
    });
  }

  public async deleteOffer(id: number) {
    await this.prisma.crystalShopOffer.delete({ where: { id: Number(id) } });
    return { deleted: true, id: Number(id) };
  }

  public async listLocalAssets() {
    const result: Array<{ url: string; filename: string; group: 'preset' | 'uploaded' | 'events' }> = [];
    const scanDir = async (dir: string, urlPrefix: string, group: 'preset' | 'uploaded' | 'events') => {
      if (!fsSync.existsSync(dir)) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(e.name)) continue;
        result.push({ url: `${urlPrefix}/${e.name}`, filename: e.name, group });
      }
    };
    await scanDir(this.shopAssetsDir, '/play/assets/shop', 'preset');
    await scanDir(this.shopUploadDir, '/play/assets/shop/uploaded', 'uploaded');
    await scanDir(path.join(this.publicDir, 'play/assets/events'), '/play/assets/events', 'events');
    return result;
  }

  public async uploadAsset(dto: { filename?: string; dataBase64?: string; kind?: string }) {
    const rawData = String(dto.dataBase64 || '').trim();
    if (!rawData) throw new Error('Nenhum arquivo enviado.');
    const base64Data = rawData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) throw new Error('Arquivo de imagem vazio.');
    if (buffer.length > 8 * 1024 * 1024) {
      throw new Error('A imagem excede o limite máximo de 8 MB.');
    }

    const ext = this.detectImageFormat(buffer);
    if (!ext) {
      throw new Error('Formato não suportado. Envie PNG, JPG, WEBP ou GIF.');
    }

    if (!fsSync.existsSync(this.shopUploadDir)) {
      await fs.mkdir(this.shopUploadDir, { recursive: true });
    }

    const kindPrefix = dto.kind === 'banner' ? 'shop_banner' : 'shop_icon';
    const rawBase = path.basename(dto.filename || kindPrefix, path.extname(dto.filename || ''));
    const cleanSlug = rawBase
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .slice(0, 28) || kindPrefix;

    const finalName = `${kindPrefix}_${cleanSlug}_${Date.now()}.${ext}`;
    const destPath = path.join(this.shopUploadDir, finalName);
    await fs.writeFile(destPath, buffer);

    return {
      url: `/play/assets/shop/uploaded/${finalName}`,
      filename: finalName,
      sizeBytes: buffer.length,
    };
  }

  public async handleAdminRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void,
    readJsonBody: <T = any>(req: http.IncomingMessage, maxBytes?: number) => Promise<T>,
    enforcePermission: (mode: 'READ' | 'READ_WRITE') => boolean
  ): Promise<boolean> {
    if (pathname === '/api/admin/crystal-shop' && method === 'GET') {
      if (enforcePermission('READ')) {
        sendJson(res, 200, await this.listOffers());
      }
      return true;
    }

    if (pathname === '/api/admin/crystal-shop/assets' && method === 'GET') {
      if (enforcePermission('READ')) {
        sendJson(res, 200, await this.listLocalAssets());
      }
      return true;
    }

    if (pathname === '/api/admin/crystal-shop/upload-asset' && method === 'POST') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<{ filename?: string; dataBase64?: string; kind?: string }>(req, 12 * 1024 * 1024);
          sendJson(res, 201, await this.uploadAsset(body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Falha no upload de imagem da Loja Cristal.' });
        }
      }
      return true;
    }

    if (pathname === '/api/admin/crystal-shop' && method === 'POST') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<SaveCrystalOfferDto>(req);
          sendJson(res, 201, await this.createOffer(body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao criar oferta da Loja Cristal.' });
        }
      }
      return true;
    }

    const idMatch = pathname.match(/^\/api\/admin\/crystal-shop\/(\d+)$/);
    if (idMatch && method === 'PUT') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<SaveCrystalOfferDto>(req);
          sendJson(res, 200, await this.updateOffer(Number(idMatch[1]), body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao atualizar oferta da Loja Cristal.' });
        }
      }
      return true;
    }

    if (idMatch && method === 'DELETE') {
      if (enforcePermission('READ_WRITE')) {
        try {
          sendJson(res, 200, await this.deleteOffer(Number(idMatch[1])));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao excluir oferta da Loja Cristal.' });
        }
      }
      return true;
    }

    return false;
  }
}
