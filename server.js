import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { generateSite } from './backend/generate.js';
import { deploySite } from './backend/deploy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clower-edit-secret';
const ADMIN_USER_FILE = path.join(__dirname, 'backend', 'config', 'settings.json');

app.use(bodyParser.json({ limit: '2mb' }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

const pagesDir = path.join(__dirname, 'backend', 'pages');
const configDir = path.join(__dirname, 'backend', 'config');

async function ensureAdminUser() {
  try {
    const raw = await fs.readFile(ADMIN_USER_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.admin) {
      throw new Error('missing admin');
    }
    if (!data.admin.passwordHash) {
      const hash = await bcrypt.hash('admin', 10);
      data.admin.passwordHash = hash;
      await fs.writeFile(ADMIN_USER_FILE, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    const defaultSettings = {
      admin: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin', 10)
      },
      deployment: {
        host: '',
        username: '',
        password: '',
        remotePath: ''
      },
      autoDeploy: false
    };
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(ADMIN_USER_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

await ensureAdminUser();
await generateSite();

async function loadSettings() {
  const raw = await fs.readFile(ADMIN_USER_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function maybeAutoDeploy() {
  try {
    const settings = await loadSettings();
    if (settings.autoDeploy) {
      await deploySite();
    }
  } catch (error) {
    console.error('Auto deploy failed:', error.message);
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  try {
    const raw = await fs.readFile(ADMIN_USER_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const { admin } = data;
    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (admin.username !== username || !isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to authenticate', error: error.message });
  }
});

app.get('/api/pages', authMiddleware, async (req, res) => {
  try {
    const files = await fs.readdir(pagesDir);
    const pages = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(pagesDir, file), 'utf-8');
      const data = JSON.parse(raw);
      pages.push(data);
    }
    return res.json(pages);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list pages', error: error.message });
  }
});

app.get('/api/pages/:slug', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  try {
    const file = path.join(pagesDir, `${slug}.json`);
    const raw = await fs.readFile(file, 'utf-8');
    return res.json(JSON.parse(raw));
  } catch (error) {
    return res.status(404).json({ message: 'Page not found', error: error.message });
  }
});

app.post('/api/pages', authMiddleware, async (req, res) => {
  const page = req.body;
  if (!page.slug) {
    return res.status(400).json({ message: 'Slug is required' });
  }
  try {
    const file = path.join(pagesDir, `${page.slug}.json`);
    if (!Array.isArray(page.sections)) {
      page.sections = [];
    }
    await fs.writeFile(file, JSON.stringify(page, null, 2));
    await generateSite();
    await maybeAutoDeploy();
    return res.status(201).json(page);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create page', error: error.message });
  }
});

app.put('/api/pages/:slug', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  const page = req.body;
  if (!page.slug) {
    return res.status(400).json({ message: 'Slug is required' });
  }
  try {
    const targetFile = path.join(pagesDir, `${page.slug}.json`);
    if (!Array.isArray(page.sections)) {
      page.sections = [];
    }
    await fs.writeFile(targetFile, JSON.stringify(page, null, 2));
    if (slug !== page.slug) {
      const oldFile = path.join(pagesDir, `${slug}.json`);
      try {
        await fs.unlink(oldFile);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    await generateSite();
    await maybeAutoDeploy();
    return res.json(page);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update page', error: error.message });
  }
});

app.delete('/api/pages/:slug', authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  if (slug === 'index') {
    return res.status(400).json({ message: 'Home page cannot be deleted' });
  }
  try {
    await fs.unlink(path.join(pagesDir, `${slug}.json`));
    await generateSite();
    await maybeAutoDeploy();
    return res.json({ message: 'Deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete page', error: error.message });
  }
});

app.get('/api/theme', authMiddleware, async (req, res) => {
  try {
    const theme = await fs.readFile(path.join(configDir, 'theme.json'), 'utf-8');
    return res.json(JSON.parse(theme));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read theme', error: error.message });
  }
});

app.put('/api/theme', authMiddleware, async (req, res) => {
  try {
    await fs.writeFile(path.join(configDir, 'theme.json'), JSON.stringify(req.body, null, 2));
    await generateSite();
    await maybeAutoDeploy();
    return res.json(req.body);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update theme', error: error.message });
  }
});

app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const data = await loadSettings();
    delete data.admin.passwordHash;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to read settings', error: error.message });
  }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const data = await loadSettings();
    if (req.body.admin) {
      if (req.body.admin.username) {
        data.admin.username = req.body.admin.username;
      }
      if (req.body.admin.password) {
        data.admin.passwordHash = await bcrypt.hash(req.body.admin.password, 10);
      }
    }
    if (req.body.deployment) {
      data.deployment = { ...data.deployment, ...req.body.deployment };
    }
    if (typeof req.body.autoDeploy === 'boolean') {
      data.autoDeploy = req.body.autoDeploy;
    }
    await fs.writeFile(ADMIN_USER_FILE, JSON.stringify(data, null, 2));
    return res.json({ message: 'Settings updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update settings', error: error.message });
  }
});

app.post('/api/generate', authMiddleware, async (req, res) => {
  try {
    await generateSite();
    await maybeAutoDeploy();
    return res.json({ message: 'Site generated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate site', error: error.message });
  }
});

app.post('/api/deploy', authMiddleware, async (req, res) => {
  try {
    await deploySite();
    return res.json({ message: 'Deployment triggered' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to deploy site', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.redirect('/admin/index.html');
});

app.listen(PORT, () => {
  console.log(`Clower Edit server running on http://localhost:${PORT}`);
});
