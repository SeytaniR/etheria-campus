import { Client } from 'ssh2';

const conn = new Client();

const deployCmd = `
set -e
cd /home/azureuser/etheria-campus
git fetch origin main
git reset --hard origin/main
cd packages/database
npx prisma generate
npx prisma db push --skip-generate --accept-data-loss
cd ../..
npm run build:packages
npm --workspace=@etheria/server run build
sudo systemctl restart etheria-campus.service
sleep 3
systemctl is-active etheria-campus.service
curl -s -o /dev/null -w "ADMIN_HTTP_STATUS=%{http_code}\\n" https://40-65-63-193.sslip.io/admin
curl -s -o /dev/null -w "PLAY_HTTP_STATUS=%{http_code}\\n" https://40-65-63-193.sslip.io/play
`;

console.log('🚀 Conectando à VPS Azure (40.65.63.193)...');

conn.on('ready', () => {
  console.log('✅ Conexão SSH estabelecida. Executando deploy...');
  conn.exec(deployCmd, (err, stream) => {
    if (err) {
      console.error('❌ Erro no comando SSH:', err);
      conn.end();
      process.exit(1);
    }

    stream.on('close', (code, signal) => {
      console.log(`\n🏁 Processo remoto encerrado com código: ${code}`);
      conn.end();
      if (code !== 0) {
        process.exit(code);
      }
    });

    stream.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    stream.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
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
