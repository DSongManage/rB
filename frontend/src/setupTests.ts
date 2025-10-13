// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for node test environment (needed by web3auth deps)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { TextEncoder, TextDecoder } from 'util';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).TextEncoder = TextEncoder;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;

// Mock web3auth modal to avoid crypto dependencies in Jest
jest.mock('@web3auth/modal', () => ({
  Web3Auth: function Web3Auth() { return {}; },
  WEB3AUTH_NETWORK: {},
}), { virtual: true });
