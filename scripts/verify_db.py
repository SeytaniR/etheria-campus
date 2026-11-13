import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=20)

stdin, stdout, stderr = ssh.exec_command("sudo -u postgres psql -d etheria_campus -c 'SELECT id, code, name_pt_br, jsonb_array_length(points_json) as pts, jsonb_array_length(routes_json) as routes FROM world_map_templates;'")
print(stdout.read().decode('utf-8'))

ssh.close()
