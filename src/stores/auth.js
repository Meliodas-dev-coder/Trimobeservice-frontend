import { defineStore } from 'pinia';

import { api, setAccessToken, setRefreshHandler } from '@/api/client';
import { HR_AREA_RESOURCES, hrFeatureForResource, widestScope } from '@/data/hrAccess';

const ACCESS_KEY = 'trimobe.access';
const REFRESH_KEY = 'trimobe.refresh';

// Cached session-restore promise so init() runs exactly once, and both the app
// bootstrap and the router guard can await the same restore.
let initPromise = null;

const HR_ACTION_ALIASES = {
  view: ['view', 'read'],
  read: ['read', 'view'],
  edit: ['edit', 'update'],
  update: ['update', 'edit'],
  remove: ['remove', 'delete'],
  delete: ['delete', 'remove'],
};

function policyAllows(actions, requested) {
  const accepted = HR_ACTION_ALIASES[requested] || [requested];
  return actions.includes('*') || actions.includes('manage') || actions.includes('modify')
    || accepted.some((action) => actions.includes(action));
}

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
    isSuperAdmin: (state) => Boolean(state.user?.is_super_admin),
    permissions: (state) => state.user?.permissions || [],
    employee: (state) => state.user?.employee || state.user?.access_context?.employee || null,
    accessContext: (state) => state.user?.access_context || {},
    hasEmployee: (state) => Boolean(state.user?.employee?.id || state.user?.access_context?.employee?.id),
    hasExplicitBusinessAccess: (state) => Array.isArray(state.user?.access_context?.business_capabilities),
    hasExplicitHrAccess: (state) => Array.isArray(state.user?.access_context?.hr_policies),
    hasHrAccess: (state) => Boolean(
      state.user?.is_super_admin
      || state.user?.employee?.id
      || state.user?.access_context?.employee?.id
      || (state.user?.permissions || []).some((key) => key === 'hr_employee' || key === 'hr' || String(key).startsWith('hr_'))
    ),
    // Distinguishes an HR manager / HR-staff member (who gets the full HR
    // console) from a normal worker (who gets the self-service portal). True for
    // super-admins, anyone who manages others (reporting tree or department
    // head), or anyone granted an explicit HR management permission. A plain
    // employee whose only HR grant is self-service (`hr_employee`) is false.
    isHrManager: (state) => {
      if (state.user?.is_super_admin) return true;
      const ctx = state.user?.access_context || {};
      if (ctx.is_manager || ctx.is_department_head) return true;
      return (state.user?.permissions || []).some(
        (key) => key === 'hr' || (String(key).startsWith('hr_') && key !== 'hr_employee'),
      );
    },
    hasOperationalAccess: (state) => {
      if (state.user?.is_super_admin) return true;
      const business = state.user?.access_context?.business_capabilities;
      const hasPositionAccess = Array.isArray(business) && business.length > 0;
      const hasLegacyAccess = (state.user?.permissions || []).some((key) => (
        !['hr', 'hr_employee'].includes(key) && !String(key).startsWith('hr_')
      ));
      return hasPositionAccess || hasLegacyAccess;
    },
    displayName: (state) => state.user?.full_name || state.user?.email || 'Account',

    // can(permission) → whether the signed-in admin may reach a screen. Accepts a
    // single section key or an array (any-of). Super-admins pass everything; a
    // null/empty requirement means "no restriction". Backend RequirePermission
    // enforces the same rule server-side — this only drives what the UI shows.
    can: (state) => (permission) => {
      if (state.user?.is_super_admin) {
        return true;
      }
      if (permission == null) {
        return true;
      }
      const needed = Array.isArray(permission) ? permission : [permission];
      if (needed.length === 0) {
        return true;
      }
      const perms = state.user?.permissions || [];
      return needed.some((key) => perms.includes(key));
    },

    // Business capabilities are submenu-level and carry read/manage access.
    // During the rollout, a legacy module permission (for example `mobility`)
    // remains a valid fallback so existing team members are not locked out.
    canBusiness: (state) => (capability, level = 'read') => {
      if (state.user?.is_super_admin) return true;
      if (!capability) return true;
      const required = Array.isArray(capability) ? capability : [capability];
      const granted = state.user?.access_context?.business_capabilities;
      const legacy = state.user?.permissions || [];
      return required.some((key) => {
        const explicitlyGranted = Array.isArray(granted) && granted.some((entry) => {
          const grantedKey = typeof entry === 'string' ? entry : entry?.key;
          const grantedLevel = typeof entry === 'string' ? 'manage' : entry?.access_level || entry?.level || 'read';
          return grantedKey === key && (level === 'read' || grantedLevel === 'manage');
        });
        if (explicitlyGranted) return true;
        // Flat-permission fallback, mirroring the backend's capability keys
        // (RequiredCapabilityKeys): a bare module key (e.g. `mobility`) is a
        // full-access wildcard; `<key>.manage` grants manage; a bare capability
        // key (`mobility.cars`) grants read only. Without this level split, a
        // read-only position grant leaked create/edit (manage) affordances.
        if (legacy.includes(String(key).split('.')[0])) return true;
        if (level === 'manage') return legacy.includes(`${key}.manage`);
        return legacy.includes(key) || legacy.includes(`${key}.manage`);
      });
    },

    hrScope: (state) => (feature, action = 'view') => {
      if (state.user?.is_super_admin) return 'all';
      const normalized = hrFeatureForResource(feature);
      const policies = state.user?.access_context?.hr_policies;
      if (Array.isArray(policies)) {
        const scopes = policies.filter((policy) => {
          const policyFeature = String(policy?.feature || policy?.key || '').replaceAll('-', '_');
          const actions = policy?.actions || (policy?.action ? [policy.action] : []);
          return (policyFeature === normalized || policyFeature === '*' || policyFeature === 'all')
            && policyAllows(actions, action);
        }).map((policy) => policy.scope || 'self');
        return scopes.length ? widestScope(scopes) : null;
      }
      const legacyMap = {
        dashboard: 'hr_dashboard', employees: 'hr_employees', emergency_contacts: 'hr_employees', organization: 'hr_organization',
        lifecycle: 'hr_lifecycle', contracts: 'hr_compensation', documents: 'hr_documents', leave: 'hr_leave',
        attendance: 'hr_attendance', performance: 'hr_performance', recruitment: 'hr_recruitment', expenses: 'hr_expenses',
        compensation: 'hr_compensation', benefits: 'hr_compensation', reports: 'hr_reports', audit: 'hr', access: 'user_management',
        notifications: 'hr_employee',
      };
      const permissions = state.user?.permissions || [];
      if (permissions.includes('hr')) return 'all';
      // Legacy HR permissions predate employee scopes and remain module-wide
      // compatibility wildcards on the backend until those roles are migrated.
      if (permissions.includes(legacyMap[normalized])) return 'all';
      return null;
    },

    canHr: (state) => (feature, action = 'view') => {
      if (state.user?.is_super_admin) return true;
      const normalized = hrFeatureForResource(feature);
      if (normalized === 'notifications' && (state.user?.employee?.id || state.user?.access_context?.employee?.id)) {
        return ['view', 'read'].includes(action);
      }
      const policies = state.user?.access_context?.hr_policies;
      if (Array.isArray(policies)) {
        return policies.some((policy) => {
          const policyFeature = String(policy?.feature || policy?.key || '').replaceAll('-', '_');
          const actions = policy?.actions || (policy?.action ? [policy.action] : []);
          return (policyFeature === normalized || policyFeature === '*' || policyFeature === 'all')
            && policyAllows(actions, action);
        });
      }
      const permissions = state.user?.permissions || [];
      if (permissions.includes('hr')) return true;
      const broad = {
        dashboard: 'hr_dashboard', employees: 'hr_employees', emergency_contacts: 'hr_employees', organization: 'hr_organization',
        lifecycle: 'hr_lifecycle', contracts: 'hr_compensation', documents: 'hr_documents', leave: 'hr_leave',
        attendance: 'hr_attendance', performance: 'hr_performance', recruitment: 'hr_recruitment', expenses: 'hr_expenses',
        compensation: 'hr_compensation', benefits: 'hr_compensation', reports: 'hr_reports', audit: 'hr', access: 'user_management',
        notifications: 'hr_employee',
      };
      return permissions.includes(broad[normalized]);
    },

    canHrArea: (state) => (area, action = 'view') => {
      if (state.user?.is_super_admin) return true;
      const resources = HR_AREA_RESOURCES[area] || [];
      const policies = state.user?.access_context?.hr_policies;
      if (Array.isArray(policies)) {
        return resources.some((resource) => {
          const feature = hrFeatureForResource(resource);
          return policies.some((policy) => {
            const policyFeature = String(policy?.feature || policy?.key || '').replaceAll('-', '_');
            const actions = policy?.actions || (policy?.action ? [policy.action] : []);
            return (policyFeature === feature || policyFeature === '*' || policyFeature === 'all')
              && policyAllows(actions, action);
          });
        });
      }
      const permissions = state.user?.permissions || [];
      const legacy = { organization: ['hr_organization', 'hr_employees', 'hr_compensation', 'hr_documents'], lifecycle: ['hr_lifecycle'], leave: ['hr_leave'], time: ['hr_attendance'], performance: ['hr_performance'], recruitment: ['hr_recruitment'], finance: ['hr_expenses', 'hr_compensation'] };
      return permissions.includes('hr') || (legacy[area] || []).some((key) => permissions.includes(key));
    },
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

    // Change the signed-in user's password. The backend verifies the current
    // password and keeps the current session valid, so no re-login is needed.
    async changePassword(currentPassword, newPassword) {
      await api.post('/account/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
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
