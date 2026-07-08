import paramiko

host = "109.123.253.238"
user = "root"
password = "Supreme001"

cmd = """
cd /root/Axentis-market
git fetch origin
git reset --hard origin/main
echo "=== GIT DONE ==="
docker-compose build backend 2>&1 | tail -3
docker-compose up -d --force-recreate backend
echo "=== DEPLOY DONE ==="
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}" | grep axentis-market
echo "==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/api/products?limit=1
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print((out + err).encode('ascii', errors='replace').decode('ascii'))
client.close()
