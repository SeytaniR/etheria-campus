# -*- coding: utf-8 -*-
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("40.65.63.193", port=22, username="azureuser", password="Dev%95175300")

cmd = """cd /home/azureuser/etheria-campus && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const itemCounts = await prisma.itemTemplate.groupBy({
    by: ["rarityTier"],
    _count: true
  });
  console.log("ITEM_COUNTS_BY_RARITY:", JSON.stringify(itemCounts, null, 2));

  const setCounts = await prisma.equipmentSet.groupBy({
    by: ["rarityTier"],
    _count: true
  });
  console.log("SET_COUNTS_BY_RARITY:", JSON.stringify(setCounts, null, 2));

  // Check sample descriptions of items
  const samples = await prisma.itemTemplate.findMany({
    take: 5,
    where: { itemCategory: "CHARACTER_EQUIPMENT" },
    select: { code: true, rarityTier: true, requiredLevel: true }
  });
  console.log("SAMPLES:", JSON.stringify(samples, null, 2));
}
run().finally(() => prisma.$disconnect());
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8'))
ssh.close()
