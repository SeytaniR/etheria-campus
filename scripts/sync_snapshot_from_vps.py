import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=20)

sftp = ssh.open_sftp()
remote_path = '/home/azureuser/etheria-campus/packages/database/snapshots/lowcode.snapshot.json'
local_path = r'C:\Users\Dell\.gemini\antigravity\scratch\etheria-campus\packages\database\snapshots\lowcode.snapshot.json'
sftp.get(remote_path, local_path)
sftp.close()
ssh.close()
print("Snapshot synced successfully!")
