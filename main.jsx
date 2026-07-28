import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './src/App.jsx';
import { initSentry } from './src/lib/sentry.js';

initSentry();

// TEMP (ACD-61): Sentry verification trigger — remove after confirming in dashboard.
// Invoke from the browser console on a preview deploy: window.__testSentry()
window.__testSentry = () => {
  throw new Error('sentry-verification');
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
