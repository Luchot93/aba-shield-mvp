import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './src/App.jsx';
import { initSentry } from './src/lib/sentry.js';

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
