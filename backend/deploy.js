import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import SftpClient from 'ssh2-sftp-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsFile = path.join(__dirname, 'config', 'settings.json');
const publicDir = path.join(__dirname, '..', 'public');

async function loadSettings() {
  const raw = await fs.readFile(settingsFile, 'utf-8');
  return JSON.parse(raw);
}

async function uploadDirectory(client, srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.posix.join(destDir, entry.name);
    if (entry.isDirectory()) {
      try {
        await client.mkdir(destPath, true);
      } catch (error) {
        if (error.code !== 4) {
          throw error;
        }
      }
      await uploadDirectory(client, srcPath, destPath);
    } else {
      await client.fastPut(srcPath, destPath);
    }
  }
}

export async function deploySite() {
  const settings = await loadSettings();
  const { deployment } = settings;
  if (!deployment.host || !deployment.username || !deployment.remotePath) {
    throw new Error('Deployment configuration is incomplete');
  }
  await fs.mkdir(publicDir, { recursive: true });
  const client = new SftpClient();
  try {
    await client.connect({
      host: deployment.host,
      username: deployment.username,
      password: deployment.password,
      port: deployment.port || 22
    });
    await uploadDirectory(client, publicDir, deployment.remotePath);
    console.log('Deployment complete');
  } finally {
    client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deploySite().catch(error => {
    console.error('Deployment failed', error);
    process.exit(1);
  });
}
