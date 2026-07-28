import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.DEV) return; // dev stays quiet
  Sentry.init({
    dsn,
    environment: 'production',
    tracesSampleRate: 0, // errors only — no perf quota burn
    sendDefaultPii: false,
    beforeSend(event) {
      // PHI scrub: keep only user id; strip request bodies
      if (event.user) event.user = { id: event.user.id };
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

export function setSentryUser(id) {
  import.meta.env.DEV || Sentry.setUser({ id });
}

export function clearSentryUser() {
  import.meta.env.DEV || Sentry.setUser(null);
}
