#!/usr/bin/env python3
"""
Script seguro de deploy para a VPS Azure do Etheria Campus (Regra #9.2 e #9.3 do AGENTS.md).

Autentica estritamente por chave SSH (~/.ssh/id_ed25519 ou VPS_SSH_KEY) ou por variável de
ambiente VPS_SSH_PASSWORD se explicitamente informada (nunca grava senhas no código).
Executa backup preventivo (snapshot + pg_dump gzip) antes do git pull e valida HTTP 200.
"""

import os
import pathlib
import sys
import paramiko


def main() -> int:
    host = os.environ.get('VPS_HOST', '40.65.63.193')
    port = int(os.environ.get('VPS_PORT', '22'))
    username = os.environ.get('VPS_USER', 'azureuser')
    default_key = str(pathlib.Path.home() / '.ssh' / 'id_ed25519')
    key_path = os.environ.get('VPS_SSH_KEY', default_key)
    env_password = os.environ.get('VPS_SSH_PASSWORD')

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = {
        'hostname': host,
        'port': port,
        'username': username,
        'timeout': 30,
    }
    if key_path and os.path.exists(key_path):
        connect_kwargs['key_filename'] = key_path
        connect_kwargs['look_for_keys'] = True
    elif env_password:
        connect_kwargs['password'] = env_password
        connect_kwargs['look_for_keys'] = False
    else:
        print(
            f'ERRO: Chave SSH não encontrada em "{key_path}" e VPS_SSH_PASSWORD não definida.',
            file=sys.stderr,
        )
        return 1

    deploy_cmd = r"""
set -e
cd /home/azureuser/etheria-campus

# 1. Backup preventivo do snapshot e do PostgreSQL antes de qualquer pull
BACKUP_DIR="/home/azureuser/backups/deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -f packages/database/snapshots/lowcode.snapshot.json ]; then
  cp packages/database/snapshots/lowcode.snapshot.json "$BACKUP_DIR/lowcode.snapshot.json"
fi
if [ -f .env ]; then
  set -a
  source .env
  set +a
  CLEAN_DB_URL="${DATABASE_URL%%\?*}"
  pg_dump "$CLEAN_DB_URL" | gzip > "$BACKUP_DIR/etheria_db.sql.gz"
fi
ls -1dt /home/azureuser/backups/deploy-* 2>/dev/null | tail -n +11 | xargs -r rm -rf || true
echo "BACKUP_OK=$BACKUP_DIR"

# 2. Atualização limpa via Git + Prisma (sem --force-reset, sem --accept-data-loss e sem re-seed)
git checkout -- packages/database/snapshots/lowcode.snapshot.json || true
git pull origin main
cd packages/database
npx prisma generate
npx prisma db push --skip-generate
cd ../..

# 3. Build completo e restart do serviço
npm run build:packages
npm --workspace=@etheria/server run build
sudo systemctl restart etheria-campus.service
sleep 3
systemctl is-active etheria-campus.service

# 4. Verificação HTTP 200 obrigatória em /admin e /play
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://40-65-63-193.sslip.io/admin)
PLAY_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://40-65-63-193.sslip.io/play)
echo "HTTP_ADMIN=$ADMIN_CODE HTTP_PLAY=$PLAY_CODE"
test "$ADMIN_CODE" = "200"
test "$PLAY_CODE" = "200"
"""

    ssh.connect(**connect_kwargs)
    try:
        _, stdout, stderr = ssh.exec_command(deploy_cmd)
        exit_code = stdout.channel.recv_exit_status()
        out_text = stdout.read().decode('utf-8', errors='replace')
        err_text = stderr.read().decode('utf-8', errors='replace')
        print('STDOUT:\n' + out_text)
        if err_text:
            print('STDERR:\n' + err_text, file=sys.stderr)
        return exit_code
    finally:
        ssh.close()


if __name__ == '__main__':
    sys.exit(main())
