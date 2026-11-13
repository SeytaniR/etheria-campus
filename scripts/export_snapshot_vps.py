import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=20)

cmd = """
cd /home/azureuser/etheria-campus
node --input-type=module -e "
import { PrismaClient, SnapshotManager } from '@etheria/database';
const prisma = new PrismaClient();
const sm = new SnapshotManager(prisma);
sm.exportToDisk()
  .then(() => { console.log('SNAPSHOT_EXPORTED_OK'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma['$disconnect']());
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
