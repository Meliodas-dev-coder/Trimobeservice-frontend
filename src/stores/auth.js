import { defineStore } from 'pinia';

import { api, setAccessToken, setRefreshHandler } from '@/api/client';

const ACCESS_KEY = 'trimobe.access';
const REFRESH_KEY = 'trimobe.refresh';

// Cached session-restore promise so init() runs exactly once, and both the app
// bootstrap and the router guard can await the same restore.
let initPromise = null;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    accessToken: localStorage.getItem(ACCESS_KEY) || null,
    refreshToken: localStorage.getItem(REFRESH_KEY) || null,
    ready: false, // has a session-restore attempt completed?
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken && state.user),
    isAdmin: (state) => state.user?.role === 'admin',
    displayName: (state) => state.user?.full_name || state.user?.email || 'Account',
  },

  actions: {
    persist() {
      if (this.accessToken) {
        localStorage.setItem(ACCESS_KEY, this.accessToken);
      } else {
        localStorage.removeItem(ACCESS_KEY);
      }
      if (this.refreshToken) {
        localStorage.setItem(REFRESH_KEY, this.refreshToken);
      } else {
        localStorage.removeItem(REFRESH_KEY);
      }
      setAccessToken(this.accessToken);
    },

    setTokens(tokens) {
      if (!tokens) {
        return;
      }
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.persist();
    },

    async login(email, password) {
      const data = await api.post('/auth/login', { email, password }, { auth: false });
      this.user = data.user;
      this.setTokens(data.tokens);
      return this.user;
    },

    async register(payload) {
      const data = await api.post('/auth/register', payload, { auth: false });
      this.user = data.user;
      this.setTokens(data.tokens);
      return this.user;
    },

    async fetchMe() {
      const data = await api.get('/auth/me');
      this.user = data.user;
      return this.user;
    },

    // Returns a fresh access token, or null when refresh is not possible. Used
    // by the API client's 401 handler, so it must not throw.
    async refresh() {
      if (!this.refreshToken) {
        return null;
      }
      try {
        const data = await api.post('/auth/refresh', { refresh_token: this.refreshToken }, { auth: false });
        this.setTokens(data.tokens);
        return this.accessToken;
      } catch {
        this.clear();
        return null;
      }
    },

    async logout() {
      const token = this.refreshToken;
      this.clear();
      if (token) {
        try {
          await api.post('/auth/logout', { refresh_token: token }, { auth: false });
        } catch {
          // best-effort; the local session is already cleared
        }
      }
    },

    clear() {
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;
      this.persist();
    },

    // Registers token hooks and restores the session from a stored access token
    // if present.
    async init() {
      setAccessToken(this.accessToken);
      setRefreshHandler(() => this.refresh());
      if (this.accessToken) {
        try {
          await this.fetchMe();
        } catch {
          this.clear();
        }
      }
      this.ready = true;
    },

    // Runs init() at most once and returns the shared promise. Anything that
    // depends on a restored session (the router guard, app bootstrap) awaits this.
    ensureReady() {
      if (!initPromise) {
        initPromise = this.init();
      }
      return initPromise;
    },
  },
});
