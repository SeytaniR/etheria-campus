/**
 * @file apps/server/src/controllers/AdminUsersController.ts
 * @module @etheria/server
 * @description Controlador Orientado a Objetos para o Gerenciamento de Contas e Permissões por Tabela.
 * @rules
 *   - Hierarquia de Roles: `DEV` (acesso irrestrito e controle total) acima de `ADMIN`.
 *   - Admins só podem visualizar e editar os dados da sua própria conta (username, email, senha).
 *   - Somente o DEV pode criar contas, excluir contas, alterar cargos ou configurar a matriz de permissões por tabela.
 *   - Nunca retorna o `passwordHash` para o cliente.
 * @dependencies @etheria/database, ../security/AdminAuthService.js
 */

import type { PrismaClient } from '@etheria/database';
import {
  AdminAuthService,
  type AdminTokenPayload,
  type TablePermissionLevel,
  ALL_TABLE_CODES,
} from '../security/AdminAuthService.js';

export interface CreateOrUpdateUserDto {
  username: string;
  email: string;
  password?: string;
  role: 'DEV' | 'ADMIN' | 'GM' | 'PLAYER';
  tablePermissionsJson?: Record<string, TablePermissionLevel>;
  locale?: string;
}

export class AdminUsersController {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Lista contas cadastradas.
   * - DEV: lista todas as contas e suas permissões.
   * - ADMIN: lista estritamente a sua própria conta.
   */
  public async listUsers(requester: AdminTokenPayload) {
    if (requester.role === 'DEV') {
      return await this.prisma.userAccount.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          tablePermissionsJson: true,
          locale: true,
          createdAt: true,
        },
      });
    }

    // ADMIN comum: somente a própria conta
    const myId = (requester.userId ?? Number(requester.sub)) || 0;
    return await this.prisma.userAccount.findMany({
      where: {
        OR: [
          ...(myId > 0 ? [{ id: myId }] : []),
          { username: requester.username },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tablePermissionsJson: true,
        locale: true,
        createdAt: true,
      },
    });
  }

  /**
   * Cria uma nova conta no PostgreSQL.
   * Restrição: Somente DEV tem autorização.
   */
  public async createUser(dto: CreateOrUpdateUserDto, requester: AdminTokenPayload) {
    if (requester.role !== 'DEV') {
      throw new Error('Acesso negado: Somente o Desenvolvedor (DEV) pode criar novas contas no sistema.');
    }

    const username = (dto.username ?? '').trim();
    const email = (dto.email ?? '').trim();
    const password = dto.password ?? '';
    const role = ['DEV', 'ADMIN', 'GM', 'PLAYER'].includes(dto.role) ? dto.role : 'ADMIN';

    if (!username || !email || password.length < 4) {
      throw new Error('Preencha username, email e uma senha de pelo menos 4 caracteres.');
    }

    const passwordHash = AdminAuthService.hashPassword(password);

    // Constrói permissões padrão se for ADMIN e não foram informadas
    let permissions = dto.tablePermissionsJson;
    if (role === 'ADMIN' && (!permissions || Object.keys(permissions).length === 0)) {
      const defPerms: Record<string, TablePermissionLevel> = {};
      for (const t of ALL_TABLE_CODES) {
        defPerms[t] = t === 'USERS' ? 'NONE' : 'READ_WRITE';
      }
      permissions = defPerms;
    }

    const created = await this.prisma.userAccount.create({
      data: {
        username,
        email,
        passwordHash,
        role,
        tablePermissionsJson: permissions ? (permissions as any) : undefined,
        locale: dto.locale ?? 'pt-BR',
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tablePermissionsJson: true,
        locale: true,
        createdAt: true,
      },
    });

    return created;
  }

  /**
   * Atualiza dados de uma conta existente.
   * - DEV: pode atualizar qualquer campo de qualquer conta (incluindo cargo e matriz de permissões).
   * - ADMIN: só pode atualizar a sua própria conta e estritamente username, email e senha.
   */
  public async updateUser(id: number, dto: Partial<CreateOrUpdateUserDto>, requester: AdminTokenPayload) {
    const target = await this.prisma.userAccount.findUnique({ where: { id } });
    if (!target) {
      throw new Error(`Conta #${id} não encontrada.`);
    }

    const isSelf = (requester.userId && requester.userId === id) || requester.sub === String(id) || requester.username === target.username;

    if (requester.role !== 'DEV' && !isSelf) {
      throw new Error('Acesso negado: Administradores só podem alterar dados da sua própria conta.');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.username !== undefined) updateData.username = dto.username.trim();
    if (dto.email !== undefined) updateData.email = dto.email.trim();
    if (dto.locale !== undefined) updateData.locale = dto.locale;

    if (dto.password && dto.password.trim().length > 0) {
      if (dto.password.trim().length < 4) {
        throw new Error('A nova senha deve ter pelo menos 4 caracteres.');
      }
      updateData.passwordHash = AdminAuthService.hashPassword(dto.password.trim());
    }

    // Apenas DEV pode alterar Role ou Matriz de Permissões
    if (requester.role === 'DEV') {
      if (dto.role !== undefined && ['DEV', 'ADMIN', 'GM', 'PLAYER'].includes(dto.role)) {
        updateData.role = dto.role;
      }
      if (dto.tablePermissionsJson !== undefined) {
        updateData.tablePermissionsJson = dto.tablePermissionsJson;
      }
    }

    const updated = await this.prisma.userAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tablePermissionsJson: true,
        locale: true,
        createdAt: true,
      },
    });

    return updated;
  }

  /**
   * Atualiza especificamente a Matriz de Permissões de um Administrador.
   * Restrição: Somente DEV pode invocar.
   */
  public async updateTablePermissions(
    id: number,
    permissions: Record<string, TablePermissionLevel>,
    requester: AdminTokenPayload
  ) {
    if (requester.role !== 'DEV') {
      throw new Error('Acesso negado: Somente o Desenvolvedor (DEV) pode configurar permissões de tabelas.');
    }

    const target = await this.prisma.userAccount.findUnique({ where: { id } });
    if (!target) {
      throw new Error(`Conta #${id} não encontrada.`);
    }

    // Valida cada tabela
    const cleanPerms: Record<string, TablePermissionLevel> = {};
    for (const code of ALL_TABLE_CODES) {
      const val = permissions[code];
      if (val === 'NONE' || val === 'READ' || val === 'READ_WRITE') {
        cleanPerms[code] = val;
      } else {
        cleanPerms[code] = 'NONE';
      }
    }

    const updated = await this.prisma.userAccount.update({
      where: { id },
      data: {
        tablePermissionsJson: cleanPerms as any,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        tablePermissionsJson: true,
        locale: true,
        createdAt: true,
      },
    });

    return updated;
  }

  /**
   * Remove uma conta do PostgreSQL.
   * Restrição: Somente DEV pode excluir.
   */
  public async deleteUser(id: number, requester: AdminTokenPayload) {
    if (requester.role !== 'DEV') {
      throw new Error('Acesso negado: Somente o Desenvolvedor (DEV) pode excluir contas.');
    }

    const target = await this.prisma.userAccount.findUnique({ where: { id } });
    if (!target) {
      throw new Error(`Conta #${id} não encontrada.`);
    }

    if (target.role === 'DEV') {
      const devCount = await this.prisma.userAccount.count({ where: { role: 'DEV' } });
      if (devCount <= 1) {
        throw new Error('Não é possível excluir o único Desenvolvedor (DEV) cadastrado no sistema.');
      }
    }

    await this.prisma.userAccount.delete({
      where: { id },
    });

    return { deletedId: id, username: target.username };
  }
}
