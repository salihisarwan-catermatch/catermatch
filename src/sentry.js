// src/sentry.js
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN, // zet je DSN in Vercel env vars
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.2,            // performance sampling (20%)
  replaysSessionSampleRate: 0.05,   // 5% sessie replays
  replaysOnErrorSampleRate: 1.0,    // 100% bij errors
  environment: import.meta.env.MODE // 'development' of 'production'
});