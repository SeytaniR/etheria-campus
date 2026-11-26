/**
 * @file apps/server/src/controllers/AdminEventsController.ts
 * @module @etheria/server
 * @description Controlador CRUD administrativo de Eventos (`/api/admin/events`), incluindo
 *   upload de banners/ícones locais, listagem de assets sob `/play/assets/events/`
 *   e configuração dos dias/recompensas de eventos `DAILY_LOGIN`.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Regra #10 Zero URLs externas).
 * @dependencies node:fs/promises, node:fs, node:path, node:http, @prisma/client, ./EventDateAndRewardHelper.js, ./GameEventsService.js
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { EventDateAndRewardHelper } from './EventDateAndRewardHelper.js';
import { GameEventsService } from './GameEventsService.js';

export interface SaveEventDto {
  code: string;
  eventType?: string;
  titlePtBr: string;
  descriptionPtBr?: string;
  bannerImageUrl?: string;
  iconImageUrl?: string;
  isFeatured?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  configJson?: any;
}

export class AdminEventsController {
  private readonly eventsAssetsDir: string;
  private readonly eventsUploadDir: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly publicDir: string
  ) {
    this.eventsAssetsDir = path.join(this.publicDir, 'play/assets/events');
    this.eventsUploadDir = path.join(this.eventsAssetsDir, 'uploaded');
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

  private sanitizeEventPayload(dto: SaveEventDto, isCreate: boolean) {
    const titlePtBr = String(dto.titlePtBr ?? '').trim();
    if (!titlePtBr) {
      throw new Error('Informe o título do evento.');
    }

    const code = String(dto.code ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    if (isCreate && !/^[a-z0-9_-]{3,48}$/.test(code)) {
      throw new Error('Código do evento inválido (use 3 a 48 caracteres: a-z, 0-9, _ ou -).');
    }

    const eventType = String(dto.eventType ?? 'DAILY_LOGIN').trim().toUpperCase() || 'DAILY_LOGIN';
    const bannerImageUrl = EventDateAndRewardHelper.validateLocalEventAssetUrl(dto.bannerImageUrl);
    const iconImageUrl = EventDateAndRewardHelper.validateLocalEventAssetUrl(dto.iconImageUrl);
    const startsAt = this.parseOptionalDate(dto.startsAt, 'Início da Vigência');
    const endsAt = this.parseOptionalDate(dto.endsAt, 'Término da Vigência');
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new Error('A data de término não pode ser anterior à data de início.');
    }

    const configJson =
      eventType === 'DAILY_LOGIN'
        ? EventDateAndRewardHelper.normalizeDailyLoginConfig(dto.configJson)
        : (dto.configJson && typeof dto.configJson === 'object' ? dto.configJson : {});

    return {
      code,
      eventType,
      titlePtBr: titlePtBr.slice(0, 120),
      descriptionPtBr: String(dto.descriptionPtBr ?? '').trim().slice(0, 500),
      bannerImageUrl,
      iconImageUrl,
      isFeatured: Boolean(dto.isFeatured),
      sortOrder: Math.round(Number(dto.sortOrder) || 0),
      isActive: dto.isActive === undefined ? true : Boolean(dto.isActive),
      startsAt,
      endsAt,
      configJson,
    };
  }

  public async listEvents() {
    await GameEventsService.ensureDefaultEventsSeed(this.prisma);
    const rows = await this.prisma.gameEventTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const itemIds = new Set<number>();
    for (const ev of rows) {
      if (ev.eventType === 'DAILY_LOGIN') {
        const cfg = EventDateAndRewardHelper.normalizeDailyLoginConfig(ev.configJson);
        for (const day of cfg.days) {
          for (const it of day.items) itemIds.add(it.itemTemplateId);
        }
      }
    }
    const itemLookup = await GameEventsService.buildItemLookup(this.prisma, Array.from(itemIds));

    return rows.map((ev) => {
      const config =
        ev.eventType === 'DAILY_LOGIN'
          ? EventDateAndRewardHelper.normalizeDailyLoginConfig(ev.configJson)
          : ev.configJson;
      return {
        id: ev.id,
        code: ev.code,
        eventType: ev.eventType,
        titlePtBr: ev.titlePtBr,
        descriptionPtBr: ev.descriptionPtBr,
        bannerImageUrl: ev.bannerImageUrl,
        iconImageUrl: ev.iconImageUrl,
        isFeatured: ev.isFeatured,
        sortOrder: ev.sortOrder,
        isActive: ev.isActive,
        startsAt: ev.startsAt ? ev.startsAt.toISOString() : null,
        endsAt: ev.endsAt ? ev.endsAt.toISOString() : null,
        scheduleStatus: EventDateAndRewardHelper.getEventScheduleStatus(ev),
        configJson: config,
        itemCatalogPreview: Object.fromEntries(itemLookup.entries()),
        updatedAt: ev.updatedAt.toISOString(),
      };
    });
  }

  public async createEvent(dto: SaveEventDto) {
    const clean = this.sanitizeEventPayload(dto, true);
    const existing = await this.prisma.gameEventTemplate.findUnique({ where: { code: clean.code } });
    if (existing) {
      throw new Error(`Já existe um evento cadastrado com o código "${clean.code}".`);
    }
    return this.prisma.gameEventTemplate.create({
      data: {
        ...clean,
        configJson: clean.configJson as any,
      },
    });
  }

  public async updateEvent(id: number, dto: SaveEventDto) {
    const safeId = Number(id);
    const existing = await this.prisma.gameEventTemplate.findUnique({ where: { id: safeId } });
    if (!existing) {
      throw new Error(`Evento #${safeId} não encontrado.`);
    }
    const clean = this.sanitizeEventPayload({ ...dto, code: dto.code || existing.code }, false);
    if (clean.code && clean.code !== existing.code) {
      const conflict = await this.prisma.gameEventTemplate.findUnique({ where: { code: clean.code } });
      if (conflict && conflict.id !== safeId) {
        throw new Error(`Código "${clean.code}" já está em uso por outro evento.`);
      }
    }
    return this.prisma.gameEventTemplate.update({
      where: { id: safeId },
      data: {
        code: clean.code || existing.code,
        eventType: clean.eventType,
        titlePtBr: clean.titlePtBr,
        descriptionPtBr: clean.descriptionPtBr,
        bannerImageUrl: clean.bannerImageUrl,
        iconImageUrl: clean.iconImageUrl,
        isFeatured: clean.isFeatured,
        sortOrder: clean.sortOrder,
        isActive: clean.isActive,
        startsAt: clean.startsAt,
        endsAt: clean.endsAt,
        configJson: clean.configJson as any,
      },
    });
  }

  public async deleteEvent(id: number) {
    await this.prisma.gameEventTemplate.delete({ where: { id: Number(id) } });
    return { deleted: true, id: Number(id) };
  }

  public async listLocalAssets() {
    const result: Array<{ url: string; filename: string; group: 'preset' | 'uploaded' }> = [];
    const scanDir = async (dir: string, urlPrefix: string, group: 'preset' | 'uploaded') => {
      if (!fsSync.existsSync(dir)) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(e.name)) continue;
        result.push({ url: `${urlPrefix}/${e.name}`, filename: e.name, group });
      }
    };
    await scanDir(this.eventsAssetsDir, '/play/assets/events', 'preset');
    await scanDir(this.eventsUploadDir, '/play/assets/events/uploaded', 'uploaded');
    return result;
  }

  public async uploadAsset(dto: { filename?: string; dataBase64?: string; kind?: string }) {
    const rawData = String(dto.dataBase64 || '').trim();
    if (!rawData) throw new Error('Nenhum arquivo enviado.');
    const base64Data = rawData.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) throw new Error('Arquivo de imagem vazio.');
    if (buffer.length > 8 * 1024 * 1024) {
      throw new Error('A imagem do evento excede o limite máximo de 8 MB.');
    }

    const ext = this.detectImageFormat(buffer);
    if (!ext) {
      throw new Error('Formato não suportado. Envie PNG, JPG, WEBP ou GIF.');
    }

    if (!fsSync.existsSync(this.eventsUploadDir)) {
      await fs.mkdir(this.eventsUploadDir, { recursive: true });
    }

    const kindPrefix = dto.kind === 'banner' ? 'banner' : 'icon';
    const rawBase = path.basename(dto.filename || kindPrefix, path.extname(dto.filename || ''));
    const cleanSlug = rawBase
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .slice(0, 28) || kindPrefix;

    const finalName = `${kindPrefix}_${cleanSlug}_${Date.now()}.${ext}`;
    const destPath = path.join(this.eventsUploadDir, finalName);
    await fs.writeFile(destPath, buffer);

    return {
      url: `/play/assets/events/uploaded/${finalName}`,
      filename: finalName,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Roteia requisições `/api/admin/events*` com verificação RBAC de permissão `EVENTS`.
   */
  public async handleAdminRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void,
    readJsonBody: <T = any>(req: http.IncomingMessage, maxBytes?: number) => Promise<T>,
    enforcePermission: (mode: 'READ' | 'READ_WRITE') => boolean
  ): Promise<boolean> {
    if (pathname === '/api/admin/events' && method === 'GET') {
      if (enforcePermission('READ')) {
        sendJson(res, 200, await this.listEvents());
      }
      return true;
    }

    if (pathname === '/api/admin/events/assets' && method === 'GET') {
      if (enforcePermission('READ')) {
        sendJson(res, 200, await this.listLocalAssets());
      }
      return true;
    }

    if (pathname === '/api/admin/events/upload-asset' && method === 'POST') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<{ filename?: string; dataBase64?: string; kind?: string }>(req, 12 * 1024 * 1024);
          sendJson(res, 201, await this.uploadAsset(body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Falha no upload de imagem do evento.' });
        }
      }
      return true;
    }

    if (pathname === '/api/admin/events' && method === 'POST') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<SaveEventDto>(req);
          sendJson(res, 201, await this.createEvent(body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao criar evento.' });
        }
      }
      return true;
    }

    const eventIdMatch = pathname.match(/^\/api\/admin\/events\/(\d+)$/);
    if (eventIdMatch && method === 'PUT') {
      if (enforcePermission('READ_WRITE')) {
        try {
          const body = await readJsonBody<SaveEventDto>(req);
          sendJson(res, 200, await this.updateEvent(Number(eventIdMatch[1]), body));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao atualizar evento.' });
        }
      }
      return true;
    }

    if (eventIdMatch && method === 'DELETE') {
      if (enforcePermission('READ_WRITE')) {
        try {
          sendJson(res, 200, await this.deleteEvent(Number(eventIdMatch[1])));
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao excluir evento.' });
        }
      }
      return true;
    }

    return false;
  }
}
