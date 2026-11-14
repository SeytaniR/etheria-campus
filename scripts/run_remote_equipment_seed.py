import paramiko
import os

print("🚀 Conectando à VPS Azure (40.65.63.193) via Paramiko...")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=30)
print("✅ Conectado via SSH!")

sftp = ssh.open_sftp()
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

local_script = os.path.join(project_root, 'scripts', 'seed_level40_equipment_sets.mjs')
remote_script = '/home/azureuser/etheria-campus/scripts/seed_level40_equipment_sets.mjs'

local_snapshot = os.path.join(project_root, 'packages', 'database', 'snapshots', 'lowcode.snapshot.json')
remote_snapshot = '/home/azureuser/etheria-campus/packages/database/snapshots/lowcode.snapshot.json'

print(f"📤 Enviando {local_script} para {remote_script}...")
sftp.put(local_script, remote_script)
print("✅ Upload do script concluído!")

exec_cmd = """
set -e
cd /home/azureuser/etheria-campus
node scripts/seed_level40_equipment_sets.mjs
sudo systemctl restart etheria-campus.service
sleep 2
systemctl is-active etheria-campus.service
curl -s -o /dev/null -w "HTTP_STATUS=%{http_code}\\n" https://40-65-63-193.sslip.io/admin
"""

print("⚙️ Executando seed de equipamentos na VPS...")
stdin, stdout, stderr = ssh.exec_command(exec_cmd)

for line in iter(stdout.readline, ""):
    print(line, end="")

err = stderr.read().decode('utf-8')
if err:
    print("STDERR:\n", err)

print(f"\n📥 Baixando snapshot atualizado de {remote_snapshot} para {local_snapshot}...")
sftp.get(remote_snapshot, local_snapshot)
print("✅ Snapshot baixado e sincronizado com sucesso!")

sftp.close()
ssh.close()
print("🎉 Montagem de Equipamentos de Nível 40 concluída com sucesso em produção!")
