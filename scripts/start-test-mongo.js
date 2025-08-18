#!/usr/bin/env node
import { execSync, spawn } from 'child_process';
import net from 'net';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function waitForPort(host, port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = net.createConnection(port, host);
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

async function main() {
  console.log('> Starting MongoDB docker container for tests...');
  try {
    // pull and run mongo if not already running
    execSync('docker pull mongo:6.0', { stdio: 'inherit' });

    const name = 'github-cli-test-mongo';
    // Remove any existing container with same name
    try { execSync(`docker rm -f ${name}`, { stdio: 'ignore' }); } catch (e) {}

    // Find a free host port by binding to port 0
    const reserve = net.createServer();
    await new Promise((resolve, reject) => {
      reserve.listen(0, '127.0.0.1', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    const address = reserve.address();
    const hostPort = address.port;
    reserve.close();

    execSync(`docker run -d --name ${name} -p ${hostPort}:27017 mongo:6.0`, { stdio: 'inherit' });

    console.log(`> Waiting for MongoDB to accept connections on localhost:${hostPort}...`);
    await waitForPort('127.0.0.1', hostPort, 60000);

    const env = Object.assign({}, process.env, { MONGO_URI: `mongodb://127.0.0.1:${hostPort}/githubcli_test` });

    console.log('> Running tests with MONGO_URI=', env.MONGO_URI);
    const jestCmd = process.execPath;
    const jestArgs = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--detectOpenHandles', '--forceExit', '--coverage'];

    const child = spawn(jestCmd, jestArgs, { stdio: 'inherit', env });

    child.on('exit', (code) => {
      console.log('> Tests exited with code', code);
      try { execSync(`docker rm -f ${name}`, { stdio: 'inherit' }); } catch (e) { console.warn('> Failed to remove docker container', e.message); }
      process.exit(code || 0);
    });

  } catch (err) {
    console.error('> Failed to start test mongo or run tests:', err.message);
    process.exit(1);
  }
}

main();
