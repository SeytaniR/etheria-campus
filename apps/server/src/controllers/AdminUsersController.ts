/**
 * @file apps/server/src/controllers/AdminUsersController.ts
 * @module @etheria/server
 * @description Controlador Orientado a Objetos para o CRUD de Contas de Usuários e Permissões (`ADMIN`, `GM`, `PLAYER`).
 * @rules
 *   - Permite criar e editar as contas de banco de dados que têm permissão de acessar a Rota `/admin` fora do `localhost`.
 *   - Nunca retorna o `passwordHash` para o cliente.
 * @dependencies @etheria/database, ../security/AdminAuthService.js
 */

import type { PrismaClient } from '@etheria/database';
import { AdminAuthService } from '../security/AdminAuthService.js';

export interface CreateOrUpdateUserDto {
  username: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'GM' | 'PLAYER';
  locale?: string;
}

export class AdminUsersController {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Lista todas as contas cadastradas no PostgreSQL (sem expor hashes de senha).
   */
  public async listUsers() {
    const users = await this.prisma.userAccount.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        locale: true,
        createdAt: true,
      },
    });
    return users;
  }

  /**
   * Cria uma nova conta de usuário no PostgreSQL com senha criptografada via scrypt.
   */
  public async createUser(dto: CreateOrUpdateUserDto) {
    const username = (dto.username ?? '').trim();
    const email = (dto.email ?? '').trim();
    const password = dto.password ?? '';
    const role = ['ADMIN', 'GM', 'PLAYER'].includes(dto.role) ? dto.role : 'PLAYER';

    if (!username || !email || password.length < 4) {
      throw new Error('Preencha username, email e uma senha de pelo menos 4 caracteres.');
    }

    const passwordHash = AdminAuthService.hashPassword(password);

    const created = await this.prisma.userAccount.create({
      data: {
        username,
        email,
        passwordHash,
        role,
        locale: dto.locale ?? 'pt-BR',
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        locale: true,
        createdAt: true,
      },
    });

    return created;
  }

  /**
   * Atualiza dados, cargo (`ADMIN`, `GM`, `PLAYER`) ou senha de um usuário existente.
   */
  public async updateUser(id: number, dto: Partial<CreateOrUpdateUserDto>) {
    const updateData: Record<string, unknown> = {};

    if (dto.username !== undefined) updateData.username = dto.username.trim();
    if (dto.email !== undefined) updateData.email = dto.email.trim();
    if (dto.role !== undefined && ['ADMIN', 'GM', 'PLAYER'].includes(dto.role)) {
      updateData.role = dto.role;
    }
    if (dto.locale !== undefined) updateData.locale = dto.locale;
    if (dto.password && dto.password.trim().length > 0) {
      if (dto.password.trim().length < 4) {
        throw new Error('A nova senha deve ter pelo menos 4 caracteres.');
      }
      updateData.passwordHash = AdminAuthService.hashPassword(dto.password.trim());
    }

    const updated = await this.prisma.userAccount.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        locale: true,
        createdAt: true,
      },
    });

    return updated;
  }

  /**
   * Remove uma conta de usuário do PostgreSQL.
   */
  public async deleteUser(id: number) {
    await this.prisma.userAccount.delete({
      where: { id },
    });
    return { deletedId: id };
  }
}
