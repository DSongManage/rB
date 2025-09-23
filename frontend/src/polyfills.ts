// Global polyfills for browser runtime (Webpack 5 CRA)
import { Buffer } from 'buffer';
import process from 'process';

const g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;

if (!g.global) g.global = g;
if (!g.Buffer) g.Buffer = Buffer;
if (!g.process) g.process = process;
if (!g.process.env) g.process.env = {};
