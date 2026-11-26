/**
 * @file apps/server/src/controllers/CrystalCurrencyService.ts
 * @module @etheria/server
 * @description Serviço Autoritário da Moeda Premium (Cristais) vinculada à Conta (`UserAccount.crystals`),
 *   com histórico imutável de auditoria em `crystal_transactions` e débito atômico CAS contra saldo negativo.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Cláusula 0 de Segurança).
 * @dependencies @prisma/client
 */

export interface CrystalLedgerOptions {
  characterId?: number | null;
  referenceCode?: string | null;
  metadataJson?: Record<string, unknown>;
}

export class CrystalCurrencyService {
  /**
   * Consulta o saldo real atual de Cristais da conta no PostgreSQL.
   */
  public static async getAccountCrystals(prismaOrTx: any, userAccountId: number): Promise<number> {
    const safeAccountId = Number(userAccountId) || 0;
    if (safeAccountId <= 0) return 0;
    const acc = await prismaOrTx.userAccount.findUnique({
      where: { id: safeAccountId },
      select: { crystals: true },
    });
    return Math.max(0, Number(acc?.crystals ?? 0));
  }

  /**
   * Credita Cristais na conta do jogador e registra a movimentação no ledger de auditoria.
   */
  public static async creditCrystals(
    prismaOrTx: any,
    userAccountId: number,
    amount: number,
    reason: string,
    opts?: CrystalLedgerOptions
  ): Promise<{ delta: number; balanceAfter: number }> {
    const safeAccountId = Number(userAccountId) || 0;
    const safeAmount = Math.round(Number(amount) || 0);
    if (safeAccountId <= 0) {
      throw new Error('Conta de usuário inválida para crédito de Cristais.');
    }
    if (safeAmount <= 0) {
      throw new Error('A quantidade de Cristais para crédito deve ser maior que zero.');
    }

    const updated = await prismaOrTx.userAccount.update({
      where: { id: safeAccountId },
      data: {
        crystals: { increment: BigInt(safeAmount) },
      },
      select: { crystals: true },
    });

    const balanceAfter = Math.max(0, Number(updated?.crystals ?? 0));
    await prismaOrTx.crystalTransaction.create({
      data: {
        userAccountId: safeAccountId,
        characterId: opts?.characterId ? Number(opts.characterId) : null,
        deltaCrystals: BigInt(safeAmount),
        balanceAfter: BigInt(balanceAfter),
        reason: String(reason || 'CREDIT').slice(0, 80),
        referenceCode: opts?.referenceCode ? String(opts.referenceCode).slice(0, 80) : null,
        metadataJson: opts?.metadataJson ?? {},
      },
    });

    return { delta: safeAmount, balanceAfter };
  }

  /**
   * Debita Cristais atomicamente usando lock condicional (`crystals >= amount`) para impedir saldo negativo
   * mesmo sob requisições simultâneas, registrando a operação em `crystal_transactions`.
   */
  public static async debitCrystalsAtomic(
    prismaOrTx: any,
    userAccountId: number,
    amount: number,
    reason: string,
    opts?: CrystalLedgerOptions
  ): Promise<{ delta: number; balanceAfter: number }> {
    const safeAccountId = Number(userAccountId) || 0;
    const safeAmount = Math.round(Number(amount) || 0);
    if (safeAccountId <= 0) {
      throw new Error('Conta de usuário inválida para débito de Cristais.');
    }
    if (safeAmount <= 0) {
      throw new Error('O valor de cobrança em Cristais deve ser maior que zero.');
    }

    const cas = await prismaOrTx.userAccount.updateMany({
      where: {
        id: safeAccountId,
        crystals: { gte: BigInt(safeAmount) },
      },
      data: {
        crystals: { decrement: BigInt(safeAmount) },
      },
    });

    if (cas.count === 0) {
      const current = await this.getAccountCrystals(prismaOrTx, safeAccountId);
      throw new Error(`Cristais insuficientes! Necessário ${safeAmount} Cristais (saldo atual: ${current}).`);
    }

    const balanceAfter = await this.getAccountCrystals(prismaOrTx, safeAccountId);
    await prismaOrTx.crystalTransaction.create({
      data: {
        userAccountId: safeAccountId,
        characterId: opts?.characterId ? Number(opts.characterId) : null,
        deltaCrystals: BigInt(-safeAmount),
        balanceAfter: BigInt(balanceAfter),
        reason: String(reason || 'DEBIT').slice(0, 80),
        referenceCode: opts?.referenceCode ? String(opts.referenceCode).slice(0, 80) : null,
        metadataJson: opts?.metadataJson ?? {},
      },
    });

    return { delta: -safeAmount, balanceAfter };
  }
}
