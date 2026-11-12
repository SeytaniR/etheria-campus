import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=20)

cmd = """
cd /home/azureuser/etheria-campus
node -e "
const crypto = require('crypto');
const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf-8');
let secret = '';
for (const line of dotenv.split('\\n')) {
  if (line.startsWith('ADMIN_SESSION_SECRET=')) {
    secret = line.split('=')[1].trim().replace(/^['\\\"]|['\\\"]$/g, '');
  }
}
const payload = {
  sub: '1',
  username: 'dev',
  role: 'DEV',
  tablePermissions: {},
  authSource: 'DATABASE_CRUD',
  exp: Date.now() + 30 * 24 * 60 * 60 * 1000
};
const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
console.log('CLEAN_SECRET=' + secret);
console.log('TOKEN=' + data + '.' + sig);
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
