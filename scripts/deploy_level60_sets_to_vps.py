# -*- coding: utf-8 -*-
"""
scripts/deploy_level60_sets_to_vps.py
Faz o upload das definições de 12 Conjuntos Lendários de Nível 60 para a VPS Azure (40.65.63.193),
executa o seed declarativo no PostgreSQL remoto com download de ícones e vinculação direta aos conjuntos,
reinicia o serviço etheria-campus.service e baixa o snapshot atualizado para sincronização local.
"""

import os
import sys
import paramiko

VPS_HOST = "40.65.63.193"
VPS_USER = "azureuser"
VPS_PASS = "Dev%95175300"

local_root = r"C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus"
remote_root = "/home/azureuser/etheria-campus"

files_to_upload = [
    ("scripts/equipment_sets_definitions.json", "scripts/equipment_sets_definitions.json"),
    ("scripts/twelve_level60_equipment_sets.json", "scripts/twelve_level60_equipment_sets.json"),
    ("scripts/seed_12_level60_equipment_sets.mjs", "scripts/seed_12_level60_equipment_sets.mjs"),
]

def run_cmd(ssh, cmd):
    print(f"\n>>> Running: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
    for line in iter(stdout.readline, ""):
        print(line, end="")
    status = stdout.channel.recv_exit_status()
    err = stderr.read().decode('utf-8')
    if err and status != 0:
        print("STDERR:", err)
    if status != 0:
        raise RuntimeError(f"Command failed with exit code {status}: {cmd}")
    return status

def main():
    print(f"Connecting to VPS {VPS_USER}@{VPS_HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_HOST, port=22, username=VPS_USER, password=VPS_PASS, timeout=30)
    print("Connected successfully!")

    sftp = ssh.open_sftp()

    print("Uploading updated files...")
    for rel_local, rel_remote in files_to_upload:
        loc_path = os.path.join(local_root, rel_local.replace("/", os.sep))
        rem_path = f"{remote_root}/{rel_remote}"
        print(f"  -> Uploading {rel_local} to {rem_path}")
        sftp.put(loc_path, rem_path)
    print("Files uploaded successfully!")

    # 1. Executa o seed dos 12 conjuntos lendários de nível 60
    print("\nExecuting seed_12_level60_equipment_sets.mjs on VPS...")
    run_cmd(ssh, f"cd {remote_root} && node scripts/seed_12_level60_equipment_sets.mjs")

    # 2. Reiniciar serviço etheria-campus.service
    print("\nRestarting etheria-campus.service on VPS...")
    run_cmd(ssh, "sudo systemctl restart etheria-campus.service")

    # 3. Verificar status do serviço
    run_cmd(ssh, "systemctl is-active etheria-campus.service")

    # 4. Baixar snapshot atualizado de volta
    remote_snapshot = f"{remote_root}/packages/database/snapshots/lowcode.snapshot.json"
    local_snapshot = os.path.join(local_root, "packages", "database", "snapshots", "lowcode.snapshot.json")
    print(f"\nDownloading updated snapshot from {remote_snapshot}...")
    sftp.get(remote_snapshot, local_snapshot)
    print(f"Downloaded snapshot to {local_snapshot} (Size: {os.path.getsize(local_snapshot)} bytes)")

    sftp.close()
    ssh.close()
    print("\n✅ Deploy de 12 Conjuntos Lendários de Nível 60 na VPS concluído com sucesso!")

if __name__ == "__main__":
    main()
