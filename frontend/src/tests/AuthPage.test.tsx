import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../../src/pages/AuthPage';

describe('AuthPage Web3Auth', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn(async (url: string, opts?: any) => {
      if (url.includes('/api/auth/csrf/')) return new Response(JSON.stringify({ csrfToken: 't' }), { status: 200 });
      if (url.includes('/auth/web3/')) return new Response(JSON.stringify({ message: 'Login successful' }), { status: 200 });
      if (url.includes('/api/auth/status/')) return new Response(JSON.stringify({ authenticated: true, wallet_address: null }), { status: 200 });
      if (url.includes('/api/wallet/link/')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response('{}', { status: 200 });
    });
    (window as any).matchMedia = (q: any) => ({ matches: false, addListener: () => {}, removeListener: () => {} });
  });

  it('renders and shows Continue with Web3Auth button', async () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );
    expect(await screen.findByText(/Continue with Web3Auth/i)).toBeInTheDocument();
  });
});


