import { initEditor } from './editor.js';
import { initTheme } from './theme.js';
import { initSettings } from './settings.js';
import { initPreview } from './preview.js';

export function adminApp() {
  return {
    view: 'login',
    pages: [],
    currentPage: null,
    theme: initTheme(),
    settings: initSettings(),
    previewUrl: '/index.html',
    api: createApiClient(),
    broadcast: () => {},

    async init() {
      try {
        this.broadcast = initPreview();
      } catch (error) {
        console.warn('Preview indisponible', error);
        this.broadcast = () => {};
      }

      if (!this.api.hasToken()) {
        this.view = 'login';
        return;
      }

      this.view = 'pages';
      await this.refreshData();
    },

    async refreshData() {
      try {
        const [pages, theme, settings] = await Promise.all([
          this.api.get('/pages'),
          this.api.get('/theme'),
          this.api.get('/settings')
        ]);

        this.pages = pages;
        this.theme = initTheme(theme);
        this.settings = {
          ...initSettings(),
          ...settings,
          admin: { ...settings.admin, password: '' }
        };

        const previousSlug = this.currentPage?.slug;
        if (previousSlug) {
          const match = pages.find(p => p.slug === previousSlug);
          if (match) {
            this.currentPage = {
              ...JSON.parse(JSON.stringify(match)),
              originalSlug: match.slug
            };
            this.previewUrl = buildPreviewUrl(match.slug);
          }
        }

        if (!this.currentPage && pages.length) {
          this.currentPage = {
            ...JSON.parse(JSON.stringify(pages[0])),
            originalSlug: pages[0].slug
          };
          this.previewUrl = buildPreviewUrl(this.currentPage.slug);
        }
      } catch (error) {
        console.error(error);
        this.resetToLogin();
      }
    },

    resetToLogin() {
      this.view = 'login';
      this.pages = [];
      this.currentPage = null;
      this.previewUrl = '/index.html';
    },

    async loadPage(slug) {
      const page = await this.api.get(`/pages/${slug}`);
      this.currentPage = { ...page, originalSlug: page.slug };
      this.previewUrl = buildPreviewUrl(slug);
    },

    createBlankPage() {
      this.currentPage = {
        title: 'Nouvelle page',
        slug: `page-${Date.now()}`,
        sections: [
          { type: 'text', props: { content: '<p>Contenu de votre page.</p>' } }
        ],
        originalSlug: null
      };
    },

    addSection(type) {
      if (!this.currentPage) return;
      this.currentPage.sections.push(initEditor(type));
    },

    removeSection(index) {
      if (!this.currentPage) return;
      this.currentPage.sections.splice(index, 1);
    },

    async savePage() {
      const payload = JSON.parse(JSON.stringify(this.currentPage));
      const originalSlug = payload.originalSlug;
      delete payload.originalSlug;
      const method = originalSlug ? 'put' : 'post';
      const endpoint = method === 'post' ? '/pages' : `/pages/${originalSlug}`;
      await this.api[method](endpoint, payload);
      await this.refreshData();
      this.broadcast();
    },

    async deletePage() {
      if (!this.currentPage || this.currentPage.slug === 'index') return;
      if (!confirm('Supprimer cette page ?')) return;
      const targetSlug = this.currentPage.originalSlug || this.currentPage.slug;
      await this.api.delete(`/pages/${targetSlug}`);
      this.currentPage = null;
      await this.refreshData();
      this.broadcast();
    },

    async saveTheme() {
      await this.api.put('/theme', this.theme);
      await this.refreshData();
      this.broadcast();
    },

    async saveSettings(showAlert = true) {
      await this.api.put('/settings', this.settings);
      if (showAlert) {
        alert('Paramètres enregistrés');
      }
    },

    async triggerBuild() {
      try {
        await this.api.post('/generate');
        alert('Site généré');
        this.broadcast();
      } catch (error) {
        alert('Erreur lors de la génération');
        console.error(error);
      }
    },

    async triggerDeploy() {
      try {
        await this.saveSettings(false);
        await this.api.post('/generate');
        await this.api.post('/deploy');
        alert('Déploiement lancé');
      } catch (error) {
        alert('Déploiement échoué, consultez la console');
        console.error(error);
      }
    }
  };
}

export function loginForm() {
  const api = createApiClient();
  return {
    username: '',
    password: '',
    error: '',
    async login() {
      try {
        const { token } = await api.post('/login', {
          username: this.username,
          password: this.password
        });
        api.setToken(token);
        window.location.reload();
      } catch (error) {
        this.error = 'Identifiants invalides';
      }
    }
  };
}

function buildPreviewUrl(slug) {
  const filename = slug === 'index' ? 'index.html' : `${slug}.html`;
  return `/public/${filename}?t=${Date.now()}`;
}

function createApiClient() {
  const BASE = '/api';
  const tokenKey = 'clowerToken';
  const headers = () => {
    const h = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(tokenKey);
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };
  const request = async (method, endpoint, body) => {
    const res = await fetch(`${BASE}${endpoint}`, {
      method: method.toUpperCase(),
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem(tokenKey);
      }
      const message = await res.text();
      throw new Error(message || `API error: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  };
  return {
    hasToken: () => Boolean(localStorage.getItem(tokenKey)),
    setToken: token => localStorage.setItem(tokenKey, token),
    get: endpoint => request('get', endpoint),
    post: (endpoint, body) => request('post', endpoint, body),
    put: (endpoint, body) => request('put', endpoint, body),
    delete: endpoint => request('delete', endpoint)
  };
}

window.adminApp = adminApp;
window.loginForm = loginForm;
