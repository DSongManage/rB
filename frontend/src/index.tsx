import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// Polyfills for Node globals used by some dependencies in the browser
import { Buffer } from 'buffer';
import process from 'process';
if (!(window as any).Buffer) (window as any).Buffer = Buffer;
if (!(window as any).process) (window as any).process = process;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
