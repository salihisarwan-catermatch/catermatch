// src/sentry.js
import * as Sentry from '@sentry/react';

console.log('[sentry] init starting. DSN =', import.meta.env.VITE_SENTRY_DSN);

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  debug: true, // 👈 tijdelijk aan voor console-logs
});

// Handig om in de browserconsole te testen: window.Sentry.captureException(...)
if (typeof window !== 'undefined') {
  window.Sentry = Sentry;
  console.log('[sentry] window.Sentry is ready:', !!window.Sentry);
}