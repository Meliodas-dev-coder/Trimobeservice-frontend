import { defineStore } from 'pinia';

import { BASE_URL } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

// Realtime admin notifications, fed by the backend SSE stream (GET
// /admin/events). Native EventSource can't send the Bearer token, so we read the
// stream with fetch() + the Authorization header, reusing the auth store's
// refresh-on-401. State is shared by the topbar bell and the dashboard feed.

const MAX_ITEMS = 50;

// event type -> how to label it and which admin page it opens.
const KIND = {
  'order.created': { label: 'New order', icon: 'pi pi-receipt', route: 'admin-orders' },
  'order.status_changed': { label: 'Order updated', icon: 'pi pi-receipt', route: 'admin-orders' },
  'booking.created': { label: 'New booking', icon: 'pi pi-calendar-clock', route: 'admin-bookings' },
  'booking.status_changed': { label: 'Booking updated', icon: 'pi pi-calendar-clock', route: 'admin-bookings' },
  'event_request.created': { label: 'New event request', icon: 'pi pi-calendar-plus', route: 'admin-event-requests' },
  'event_request.status_changed': { label: 'Event request updated', icon: 'pi pi-calendar-plus', route: 'admin-event-requests' },
  'healthcare_request.created': { label: 'New care request', icon: 'pi pi-heart', route: 'admin-healthcare-requests' },
  'healthcare_request.status_changed': { label: 'Care request updated', icon: 'pi pi-heart', route: 'admin-healthcare-requests' },
  'payment.recorded': { label: 'Payment recorded', icon: 'pi pi-wallet', route: 'admin-payments' },
  'payment.refunded': { label: 'Payment refunded', icon: 'pi pi-wallet', route: 'admin-payments' },
};

// Loop control lives at module scope so it never becomes reactive state.
let controller = null;
let running = false;
let stopped = false;
let backoff = 1000;
let seq = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [],
    unread: 0,
    connected: false,
    lastEventAt: 0, // bumped on each event; views watch this to refetch
  }),

  actions: {
    // Open the stream (idempotent). Called when the admin shell mounts.
    start() {
      if (running) {
        return;
      }
      running = true;
      stopped = false;
      backoff = 1000;
      this.loop();
    },

    // Close the stream and reset connection state (admin shell unmount / logout).
    stop() {
      stopped = true;
      running = false;
      this.connected = false;
      if (controller) {
        controller.abort();
        controller = null;
      }
    },

    markAllRead() {
      this.unread = 0;
      this.items = this.items.map((n) => (n.read ? n : { ...n, read: true }));
    },

    clear() {
      this.items = [];
      this.unread = 0;
    },

    push(type, payload = {}, id) {
      const kind = KIND[type];
      if (!kind) {
        return;
      }
      const isPayment = type.startsWith('payment.');
      // Payments reference a target (e.g. "order #12") rather than a customer.
      const number =
        payload.number ||
        (isPayment && payload.payable_type != null ? `${payload.payable_type} #${payload.payable_id}` : '');
      const notif = {
        id: id || `${type}-${payload.id ?? ''}-${seq++}`,
        type,
        icon: kind.icon,
        title: kind.label,
        number,
        customer: payload.customer_name || '',
        amount: payload.amount ?? null,
        method: payload.method || '',
        status: payload.status || '',
        // Show the status chip on transitions/payments; on a fresh create the
        // status is just the initial state and would be noise.
        showStatus: isPayment || type.endsWith('.status_changed'),
        at: Date.now(),
        to: { name: kind.route, query: payload.id != null ? { focus: String(payload.id) } : {} },
        read: false,
      };
      this.items = [notif, ...this.items].slice(0, MAX_ITEMS);
      this.unread += 1;
      this.lastEventAt = notif.at;
    },

    // Reconnecting read loop with exponential backoff.
    async loop() {
      const auth = useAuthStore();
      while (!stopped) {
        controller = new AbortController();
        try {
          const res = await fetch(`${BASE_URL}/admin/events`, {
            headers: {
              Accept: 'text/event-stream',
              ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
            },
            signal: controller.signal,
          });
          if (res.status === 401) {
            const token = await auth.refresh();
            if (!token) {
              break; // session gone; give up until start() is called again
            }
            continue; // retry immediately with the fresh token
          }
          if (!res.ok || !res.body) {
            throw new Error(`stream failed: ${res.status}`);
          }
          this.connected = true;
          backoff = 1000;
          await this.readStream(res.body);
        } catch {
          // network error or abort — fall through to reconnect
        }
        this.connected = false;
        if (stopped) {
          break;
        }
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
      running = false;
    },

    async readStream(body) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let sep;
        // SSE frames are separated by a blank line.
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          this.handleFrame(buffer.slice(0, sep));
          buffer = buffer.slice(sep + 2);
        }
      }
    },

    handleFrame(frame) {
      let eventName = 'message';
      let id = '';
      const data = [];
      for (const line of frame.split('\n')) {
        if (!line || line.startsWith(':')) {
          continue; // heartbeat / comment
        }
        const idx = line.indexOf(':');
        const field = idx === -1 ? line : line.slice(0, idx);
        const value = idx === -1 ? '' : line.slice(idx + 1).replace(/^ /, '');
        if (field === 'event') eventName = value;
        else if (field === 'id') id = value;
        else if (field === 'data') data.push(value);
      }
      if (!data.length) {
        return; // e.g. the initial "retry:" frame
      }
      let parsed;
      try {
        parsed = JSON.parse(data.join('\n'));
      } catch {
        return;
      }
      this.push(parsed.type || eventName, parsed.payload || {}, parsed.id || id);
    },
  },
});
