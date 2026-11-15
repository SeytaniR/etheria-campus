# -*- coding: utf-8 -*-
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("40.65.63.193", port=22, username="azureuser", password="Dev%95175300")

cmd = """cd /home/azureuser/etheria-campus && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const itemDescs = await prisma.i18nTranslation.findMany({
    where: {
      key: { startsWith: "item_template:" },
      OR: [
        { text: { contains: "(Lendário)" } },
        { text: { contains: "(Épico)" } },
        { text: { contains: "(Raro)" } },
        { text: { contains: "(Comum)" } },
        { text: { contains: "(Legendary)" } },
        { text: { contains: "(Epic)" } },
        { text: { contains: "(Rare)" } }
      ]
    },
    select: { key: true, text: true }
  });
  console.log("ITEM_DESCS_WITH_RARITY_TAG:", itemDescs.length);
  if (itemDescs.length > 0) {
    console.log("SAMPLE:", itemDescs[0]);
  }
}
run().finally(() => prisma.$disconnect());
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8'))
ssh.close()
