import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=30)

cmd = """
cd /home/azureuser/etheria-campus
node --input-type=module -e '
  import { PrismaClient } from "@prisma/client";
  import { SnapshotManager } from "@etheria/database";

  const prisma = new PrismaClient();
  const sm = new SnapshotManager(prisma);

  const equips = await prisma.itemTemplate.findMany({
    where: { itemCategory: { in: ["CHARACTER_EQUIPMENT", "PET_EQUIPMENT"] } }
  });

  console.log("Updating", equips.length, "equipments in DB...");

  for (const eq of equips) {
    await prisma.itemTemplate.update({
      where: { id: eq.id },
      data: {
        priceGold: 0,
        baseStatBonusesJson: {},
      }
    });
  }

  await sm.exportToDisk();
  console.log("All equipments cleaned: priceGold = 0, baseStatBonusesJson = {}, snapshot exported!");
  await prisma.$disconnect();
'
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("OUT:\n", stdout.read().decode('utf-8'))
print("ERR:\n", stderr.read().decode('utf-8'))
ssh.close()
