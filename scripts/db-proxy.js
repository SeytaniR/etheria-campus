/**
 * Proxy de conexão TCP Windows -> WSL2 para a porta do PostgreSQL 54322.
 * Garante estabilidade ininterrupta mesmo se o wslrelay do Windows hibernar.
 */
import net from 'node:net';

const WSL_IP = '172.20.73.118';
const WSL_PORT = 54320;
const LISTEN_PORT = 54322;
const LISTEN_HOST = '127.0.0.1';

const server = net.createServer((clientSocket) => {
  const remoteSocket = net.connect({ host: WSL_IP, port: WSL_PORT }, () => {
    clientSocket.pipe(remoteSocket);
    remoteSocket.pipe(clientSocket);
  });

  remoteSocket.on('error', (err) => {
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    remoteSocket.destroy();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`✅ [DB Proxy] Escutando em ${LISTEN_HOST}:${LISTEN_PORT} -> ${WSL_IP}:${WSL_PORT}`);
});
