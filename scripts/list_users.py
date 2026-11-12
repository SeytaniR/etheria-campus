import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=15)

stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d etheria_campus -c 'SELECT id, username, role, password_hash FROM user_accounts;'")
print(stdout.read().decode('utf-8'))

stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d etheria_campus -c 'SELECT id, name, level, gold, diamonds, class_id FROM player_characters;'")
print(stdout.read().decode('utf-8'))

ssh.close()
