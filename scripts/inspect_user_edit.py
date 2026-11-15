# -*- coding: utf-8 -*-
import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("40.65.63.193", port=22, username="azureuser", password="Dev%95175300")

cmd = """cd /home/azureuser/etheria-campus && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const desc = await prisma.i18nTranslation.findMany({
    where: { key: "item_template:equip_lv60_ghostreaper_weapon1:description" }
  });
  console.log("DESC:", JSON.stringify(desc, null, 2));
}
run().finally(() => prisma.$disconnect());
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8'))
ssh.close()
