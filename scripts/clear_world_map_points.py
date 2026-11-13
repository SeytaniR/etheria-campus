import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('40.65.63.193', port=22, username='azureuser', password='Dev%95175300', timeout=20)

sql = """
UPDATE world_map_templates
SET points_json = '[]'::jsonb, routes_json = '[]'::jsonb;

SELECT id, code, name_pt_br, jsonb_array_length(points_json) as pts_count, jsonb_array_length(routes_json) as routes_count
FROM world_map_templates;
"""

cmd = f"sudo -u postgres psql -d etheria_campus -c \"{sql}\""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:\n", err)

ssh.close()
