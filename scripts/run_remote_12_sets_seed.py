# -*- coding: utf-8 -*-
"""
Executa o seed declarativo de 12 conjuntos de equipamentos Nível 40 (144 peças)
diretamente na VPS Azure (40.65.63.193), atualiza o PostgreSQL, reinicia o serviço
e sincroniza o snapshot lowcode.snapshot.json e os ícones baixados de volta para a máquina local.
"""

import os
import paramiko

VPS_HOST = "40.65.63.193"
VPS_USER = "azureuser"
VPS_PASS = "Dev%95175300"

local_project_root = r"C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus"
remote_project_root = "/home/azureuser/etheria-campus"

print(f"Connecting to VPS {VPS_USER}@{VPS_HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(VPS_HOST, port=22, username=VPS_USER, password=VPS_PASS, timeout=30)
print("Connected successfully!")

sftp = ssh.open_sftp()

# 1. Envia scripts e dados JSON para a VPS
print("Uploading seed script and data JSON...")
local_json = os.path.join(local_project_root, "scripts", "twelve_level40_equipment_sets.json")
remote_json = f"{remote_project_root}/scripts/twelve_level40_equipment_sets.json"
sftp.put(local_json, remote_json)

local_mjs = os.path.join(local_project_root, "scripts", "seed_12_level40_equipment_sets.mjs")
remote_mjs = f"{remote_project_root}/scripts/seed_12_level40_equipment_sets.mjs"
sftp.put(local_mjs, remote_mjs)

print("Uploaded successfully!")

# 2. Executa o seed no Node.js da VPS
cmd = f"cd {remote_project_root} && node scripts/seed_12_level40_equipment_sets.mjs"
print(f"Running remote command: {cmd}")
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)

for line in stdout:
    print(line, end="")

err = stderr.read().decode('utf-8')
if err:
    print("STDERR:", err)

# 3. Reinicia o serviço na VPS
print("Restarting etheria-campus service on VPS...")
stdin, stdout, stderr = ssh.exec_command("sudo systemctl restart etheria-campus.service")
stdout.channel.recv_exit_status()
print("Service restarted.")

# 4. Baixa o snapshot canônico atualizado de volta para a máquina local
remote_snapshot = f"{remote_project_root}/packages/database/snapshots/lowcode.snapshot.json"
local_snapshot = os.path.join(local_project_root, "packages", "database", "snapshots", "lowcode.snapshot.json")
print("Downloading updated snapshot from VPS...")
sftp.get(remote_snapshot, local_snapshot)
print(f"Downloaded snapshot to {local_snapshot} (Size: {os.path.getsize(local_snapshot)} bytes)")

# 5. Sincroniza ícones baixados na VPS para o cache local
remote_icons_dir = f"{remote_project_root}/apps/server/cache/mcrework/assets/equipment/icons"
local_icons_dir = os.path.join(local_project_root, "apps", "server", "cache", "mcrework", "assets", "equipment", "icons")
os.makedirs(local_icons_dir, exist_ok=True)

try:
    remote_files = sftp.listdir(remote_icons_dir)
    print(f"Total icons on VPS cache: {len(remote_files)}")
    downloaded_icons = 0
    for rf in remote_files:
        lf = os.path.join(local_icons_dir, rf)
        if not os.path.exists(lf):
            sftp.get(f"{remote_icons_dir}/{rf}", lf)
            downloaded_icons += 1
    print(f"Synced {downloaded_icons} new icons to local cache.")
except Exception as e:
    print("Warning syncing icons:", e)

sftp.close()
ssh.close()
print("All remote operations completed!")
