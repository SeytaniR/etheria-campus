import { PrismaClient } from '@etheria/database';
import { MonsterMetaQuestService } from '../apps/server/src/controllers/MonsterMetaQuestService.js';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('🌱 Sincronizando Sistema Procedural de Quests Meta (Monstros e Raças)...');
    const result = await MonsterMetaQuestService.syncAllMetaQuests(prisma);
    console.log(`✅ Quests Meta sincronizadas com sucesso! (${result.mobQuestsCount} monstros, ${result.raceQuestsCount} raças)`);

    // Sincroniza personagens existentes
    const characters = await prisma.playerCharacter.findMany({ select: { id: true, name: true } });
    let totalEnrolled = 0;
    for (const c of characters) {
      const added = await MonsterMetaQuestService.ensurePlayerMetaQuests(prisma, c.id);
      totalEnrolled += added;
    }
    console.log(`✅ ${totalEnrolled} inscrições automáticas de Quests Meta para ${characters.length} personagens existentes.`);
  } catch (err) {
    console.error('❌ Erro ao sincronizar Quests Meta:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
