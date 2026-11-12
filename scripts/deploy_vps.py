import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=30)

deploy_cmd = """
set -e
cd /home/azureuser/etheria-campus
git pull origin main
npm run build --workspaces || true
sudo systemctl restart etheria-campus.service
sleep 2
systemctl is-active etheria-campus.service
curl -s -o /dev/null -w "HTTP_STATUS=%{http_code}\\n" https://40-65-63-193.sslip.io/play
"""

stdin, stdout, stderr = ssh.exec_command(deploy_cmd)
print("STDOUT:\n", stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:\n", err)

ssh.close()
