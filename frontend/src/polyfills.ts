// Global polyfills for browser runtime (Vite)
import { Buffer } from 'buffer';
import process from 'process';
import { EventEmitter } from 'events';

const g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;

// Polyfill global
if (!g.global) g.global = g;

// Polyfill Buffer
if (!g.Buffer) g.Buffer = Buffer;

// Polyfill process with EventEmitter methods
if (!g.process) {
  g.process = process;
}

// Ensure process has EventEmitter methods (for end-of-stream)
if (g.process && !g.process.on) {
  const emitter = new EventEmitter();
  g.process.on = emitter.on.bind(emitter);
  g.process.once = emitter.once.bind(emitter);
  g.process.off = emitter.off.bind(emitter);
  g.process.emit = emitter.emit.bind(emitter);
  g.process.removeListener = emitter.removeListener.bind(emitter);
  g.process.removeAllListeners = emitter.removeAllListeners.bind(emitter);
  g.process.listeners = emitter.listeners.bind(emitter);
}

if (!g.process.env) g.process.env = {};
