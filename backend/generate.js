import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'pages');
const templatesDir = path.join(__dirname, 'templates');
const configDir = path.join(__dirname, 'config');
const publicDir = path.join(__dirname, '..', 'public');

nunjucks.configure(templatesDir, { autoescape: true });

async function ensureTheme() {
  try {
    await fs.access(path.join(configDir, 'theme.json'));
  } catch (error) {
    const defaultTheme = {
      colors: {
        primary: '#9C6BFF',
        secondary: '#A3E3C2',
        text: '#1E1E1E',
        background: '#F8F8FF'
      },
      fonts: {
        display: 'Outfit',
        body: 'Inter'
      },
      radius: {
        small: '0.5rem',
        medium: '1rem',
        large: '2rem'
      }
    };
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'theme.json'), JSON.stringify(defaultTheme, null, 2));
  }
}

async function loadPages() {
  await fs.mkdir(pagesDir, { recursive: true });
  const files = await fs.readdir(pagesDir);
  const pages = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const raw = await fs.readFile(path.join(pagesDir, file), 'utf-8');
    pages.push(JSON.parse(raw));
  }
  return pages;
}

function renderPage(page, theme) {
  const layoutTemplate = 'layout.njk';
  const context = {
    page,
    theme,
    sections: page.sections || []
  };
  return nunjucks.render(layoutTemplate, context);
}

async function writePage(page, html) {
  const fileName = page.slug === 'index' ? 'index.html' : `${page.slug}.html`;
  const filePath = path.join(publicDir, fileName);
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(filePath, html);
}

export async function generateSite() {
  await ensureTheme();
  const themeRaw = await fs.readFile(path.join(configDir, 'theme.json'), 'utf-8');
  const theme = JSON.parse(themeRaw);
  await fs.mkdir(publicDir, { recursive: true });
  const pages = await loadPages();
  for (const page of pages) {
    const html = renderPage(page, theme);
    await writePage(page, html);
  }
  return pages.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateSite()
    .then(count => console.log(`Generated ${count} pages.`))
    .catch(err => {
      console.error('Failed to generate site', err);
      process.exit(1);
    });
}
