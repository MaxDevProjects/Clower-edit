import { initEditor } from './editor.js';
import { initTheme } from './theme.js';
import { initSettings } from './settings.js';
import { initPreview } from './preview.js';

export function adminApp() {
  const state = {
    view: 'login',
    pages: [],
    currentPage: null,
    theme: initTheme(),
    settings: initSettings(),
    previewUrl: '/index.html'
  };

  const api = createApiClient();
  const broadcast = initPreview();

  const actions = {
    async init() {
      if (api.hasToken()) {
        await actions.refreshData();
        state.view = 'pages';
      } else {
        state.view = 'login';
      }
    },
    async refreshData() {
      try {
        const [pages, theme, settings] = await Promise.all([
          api.get('/pages'),
          api.get('/theme'),
          api.get('/settings')
        ]);
        state.pages = pages;
        state.theme = initTheme(theme);
        state.settings = {
          ...initSettings(),
          ...settings,
          admin: { ...settings.admin, password: '' }
        };
        const previousSlug = state.currentPage?.slug;
        if (previousSlug) {
          const match = pages.find(p => p.slug === previousSlug);
          if (match) {
            state.currentPage = { ...JSON.parse(JSON.stringify(match)), originalSlug: match.slug };
            state.previewUrl = buildPreviewUrl(match.slug);
          }
        }
        if (!state.currentPage && pages.length) {
          state.currentPage = { ...JSON.parse(JSON.stringify(pages[0])), originalSlug: pages[0].slug };
          state.previewUrl = buildPreviewUrl(state.currentPage.slug);
        }
      } catch (error) {
        console.error(error);
        state.view = 'login';
      }
    },
    async loadPage(slug) {
      const page = await api.get(`/pages/${slug}`);
      state.currentPage = { ...page, originalSlug: page.slug };
      state.previewUrl = buildPreviewUrl(slug);
    },
    createBlankPage() {
      state.currentPage = {
        title: 'Nouvelle page',
        slug: `page-${Date.now()}`,
        sections: [
          { type: 'text', props: { content: '<p>Contenu de votre page.</p>' } }
        ],
        originalSlug: null
      };
    },
    addSection(type) {
      if (!state.currentPage) return;
      state.currentPage.sections.push(initEditor(type));
    },
    removeSection(index) {
      if (!state.currentPage) return;
      state.currentPage.sections.splice(index, 1);
    },
    async savePage() {
      const payload = JSON.parse(JSON.stringify(state.currentPage));
      const originalSlug = payload.originalSlug;
      delete payload.originalSlug;
      const method = originalSlug ? 'put' : 'post';
      const endpoint = method === 'post' ? '/pages' : `/pages/${originalSlug}`;
      await api[method](endpoint, payload);
      await actions.refreshData();
      broadcast();
    },
    async deletePage() {
      if (!state.currentPage || state.currentPage.slug === 'index') return;
      if (!confirm('Supprimer cette page ?')) return;
      const targetSlug = state.currentPage.originalSlug || state.currentPage.slug;
      await api.delete(`/pages/${targetSlug}`);
      state.currentPage = null;
      await actions.refreshData();
      broadcast();
    },
    async saveTheme() {
      await api.put('/theme', state.theme);
      await actions.refreshData();
      broadcast();
    },
    async saveSettings(showAlert = true) {
      await api.put('/settings', state.settings);
      if (showAlert) {
        alert('Paramètres enregistrés');
      }
    },
    async triggerBuild() {
      try {
        await api.post('/generate');
        alert('Site généré');
        broadcast();
      } catch (error) {
        alert("Erreur lors de la génération");
        console.error(error);
      }
    },
    async triggerDeploy() {
      try {
        await actions.saveSettings(false);
        await api.post('/generate');
        await api.post('/deploy');
        alert('Déploiement lancé');
      } catch (error) {
        alert('Déploiement échoué, consultez la console');
        console.error(error);
      }
    }
  };

  Object.assign(state, actions);
  actions.init();

  return state;
}

export function loginForm() {
  const api = createApiClient();
  return {
    username: '',
    password: '',
    error: '',
    async login() {
      try {
        const { token } = await api.post('/login', { username: this.username, password: this.password });
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
