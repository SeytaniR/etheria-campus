import { Client } from 'ssh2';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const localScriptPath = path.join(projectRoot, 'scripts', 'apply_izumo_lore_and_lock_stats.mjs');
const remoteScriptPath = '/home/azureuser/etheria-campus/scripts/apply_izumo_lore_and_lock_stats.mjs';

const localSnapshotPath = path.join(projectRoot, 'packages', 'database', 'snapshots', 'lowcode.snapshot.json');
const remoteSnapshotPath = '/home/azureuser/etheria-campus/packages/database/snapshots/lowcode.snapshot.json';

const conn = new Client();

console.log('🚀 Conectando à VPS Azure (40.65.63.193) via SSH2...');

conn.on('ready', () => {
  console.log('✅ Conexão SSH estabelecida. Abrindo SFTP...');
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ Erro ao abrir SFTP:', err);
      conn.end();
      process.exit(1);
    }

    console.log(`📤 Enviando ${localScriptPath} para ${remoteScriptPath}...`);
    sftp.fastPut(localScriptPath, remoteScriptPath, (putErr) => {
      if (putErr) {
        console.error('❌ Erro no upload:', putErr);
        conn.end();
        process.exit(1);
      }
      console.log('✅ Upload concluído. Executando script de migração...');

      const execCmd = `
set -e
cd /home/azureuser/etheria-campus
node scripts/apply_izumo_lore_and_lock_stats.mjs
`;

      conn.exec(execCmd, (execErr, stream) => {
        if (execErr) {
          console.error('❌ Erro ao executar comando:', execErr);
          conn.end();
          process.exit(1);
        }

        stream.on('close', (code, signal) => {
          console.log(`\n🏁 Script de migração concluído com código: ${code}`);
          if (code !== 0) {
            conn.end();
            process.exit(code);
          }

          console.log(`📥 Baixando snapshot atualizado de ${remoteSnapshotPath} para ${localSnapshotPath}...`);
          sftp.fastGet(remoteSnapshotPath, localSnapshotPath, (getErr) => {
            if (getErr) {
              console.error('❌ Erro no download do snapshot:', getErr);
              conn.end();
              process.exit(1);
            }
            console.log('✅ Snapshot baixado e sincronizado com sucesso!');
            conn.end();
            process.exit(0);
          });
        });

        stream.on('data', (data) => {
          process.stdout.write(data.toString());
        });

        stream.stderr.on('data', (data) => {
          process.stderr.write(data.toString());
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('❌ Falha na conexão SSH:', err);
  process.exit(1);
}).connect({
  host: '40.65.63.193',
  port: 22,
  username: 'azureuser',
  password: 'Dev%95175300',
  readyTimeout: 30000,
});
