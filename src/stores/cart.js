import { defineStore } from 'pinia';

import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

// Guests keep a local cart (locked product decision: browse and collect items
// without an account; the auth gate is at checkout). Guest lines live in
// localStorage as price/stock snapshots taken at add time, and are pushed into
// the server cart right after login, then the local copy is cleared.
const GUEST_KEY = 'trimobe.guest_cart';

// Deduped merge+load so the header watcher and the login form don't both
// merge the guest cart at the same time.
let syncPromise = null;

function readGuestItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((item) => item && item.product_variant_id) : [];
  } catch {
    return [];
  }
}

function writeGuestItems(items) {
  if (items.length) {
    localStorage.setItem(GUEST_KEY, JSON.stringify(items));
  } else {
    localStorage.removeItem(GUEST_KEY);
  }
}

// guestView shapes local items like the server's cart payload so the views
// render both the same way.
function guestView(items) {
  let subtotal = 0;
  let count = 0;
  const lines = items.map((item) => {
    const lineTotal = Number(item.unit_price || 0) * item.quantity;
    subtotal += lineTotal;
    count += item.quantity;
    return { ...item, line_total: lineTotal.toFixed(2) };
  });
  return { items: lines, subtotal: subtotal.toFixed(2), item_count: count };
}

function capQuantity(quantity, inStock) {
  const max = Number(inStock || 0);
  const wanted = Math.max(1, Number(quantity || 1));
  return max > 0 ? Math.min(wanted, max) : wanted;
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    cart: null,
    guest: false, // the current cart is the local signed-out cart
    loading: false,
    ready: false,
  }),

  getters: {
    items: (state) => state.cart?.items || [],
    itemCount: (state) => state.cart?.item_count || 0,
    subtotal: (state) => Number(state.cart?.subtotal || 0),
    hasItems: (state) => Boolean(state.cart?.items?.length),
  },

  actions: {
    setCart(data, guest = false) {
      this.cart = data || { items: [], subtotal: '0.00', item_count: 0 };
      this.guest = guest;
      this.ready = true;
    },

    loadGuest() {
      this.setCart(guestView(readGuestItems()), true);
      return this.cart;
    },

    setGuestItems(items) {
      writeGuestItems(items);
      this.setCart(guestView(items), true);
      return this.cart;
    },

    // sync is the single entry point after auth state settles: guests get the
    // local cart; signed-in users get their guest lines merged into the server
    // cart, then the server cart.
    async sync() {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        return this.loadGuest();
      }
      if (!syncPromise) {
        syncPromise = (async () => {
          try {
            await this.mergeGuestItems();
            await this.load();
          } finally {
            syncPromise = null;
          }
        })();
      }
      await syncPromise;
      return this.cart;
    },

    // mergeGuestItems pushes each guest line to the server cart (best-effort:
    // variants that went out of stock or inactive are dropped) and clears the
    // local copy.
    async mergeGuestItems() {
      const guestItems = readGuestItems();
      if (!guestItems.length) {
        return;
      }
      for (const item of guestItems) {
        try {
          await api.post('/cart/items', {
            product_variant_id: item.product_variant_id,
            quantity: item.quantity,
          });
        } catch {
          // skip lines the server refuses; the rest of the cart still merges
        }
      }
      writeGuestItems([]);
    },

    async load() {
      this.loading = true;
      try {
        const data = await api.get('/cart');
        this.setCart(data?.cart);
        return this.cart;
      } finally {
        this.loading = false;
      }
    },

    // snapshot (guest only) carries the display fields a local line needs:
    // product_name, product_slug, variant_label, sku, unit_price, in_stock.
    async addItem(productVariantId, quantity = 1, snapshot = null) {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        const items = readGuestItems();
        const existing = items.find((item) => item.product_variant_id === productVariantId);
        if (existing) {
          Object.assign(existing, snapshot || {});
          existing.quantity = capQuantity(existing.quantity + Number(quantity || 1), existing.in_stock);
        } else {
          items.push({
            id: `guest-${productVariantId}`,
            product_variant_id: productVariantId,
            quantity: capQuantity(quantity, snapshot?.in_stock),
            ...(snapshot || {}),
          });
        }
        return this.setGuestItems(items);
      }
      this.loading = true;
      try {
        const data = await api.post('/cart/items', {
          product_variant_id: productVariantId,
          quantity,
        });
        this.setCart(data?.cart);
        return this.cart;
      } finally {
        this.loading = false;
      }
    },

    async updateItem(itemId, quantity) {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        const items = readGuestItems();
        const item = items.find((entry) => entry.id === itemId);
        if (item) {
          item.quantity = capQuantity(quantity, item.in_stock);
        }
        return this.setGuestItems(items);
      }
      this.loading = true;
      try {
        const data = await api.patch(`/cart/items/${itemId}`, { quantity });
        this.setCart(data?.cart);
        return this.cart;
      } finally {
        this.loading = false;
      }
    },

    async removeItem(itemId) {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        return this.setGuestItems(readGuestItems().filter((entry) => entry.id !== itemId));
      }
      this.loading = true;
      try {
        const data = await api.del(`/cart/items/${itemId}`);
        this.setCart(data?.cart);
        return this.cart;
      } finally {
        this.loading = false;
      }
    },

    async clear() {
      const auth = useAuthStore();
      if (!auth.isAuthenticated) {
        return this.setGuestItems([]);
      }
      this.loading = true;
      try {
        const data = await api.del('/cart');
        this.setCart(data?.cart);
        return this.cart;
      } finally {
        this.loading = false;
      }
    },

    async checkout(body) {
      this.loading = true;
      try {
        const data = await api.post('/orders', body);
        this.setCart({ items: [], subtotal: '0.00', item_count: 0 });
        return data?.order || null;
      } finally {
        this.loading = false;
      }
    },
  },
});
