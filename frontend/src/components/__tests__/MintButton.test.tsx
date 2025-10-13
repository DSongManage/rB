import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MintButton from '../MintButton';

describe('MintButton', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tx_sig: 'dummy_tx' }),
    });
  });

  it('calls /api/mint and shows tx on success', async () => {
    render(<MintButton contentId={123} />);
    fireEvent.click(screen.getByRole('button', { name: /mint/i }));
    // Loading state
    expect(screen.getByRole('button', { name: /minting/i })).toBeDisabled();
    await waitFor(() => screen.getByText(/tx:/i));
    expect(screen.getByText(/dummy_tx/)).toBeInTheDocument();
    expect((global as any).fetch).toHaveBeenCalledWith('/api/mint/', expect.objectContaining({ method: 'POST' }));
    // Check body includes sale_amount
    const lastCall = ((global as any).fetch as jest.Mock).mock.calls.pop();
    expect(lastCall[1].body).toContain('"sale_amount"');
  });

  it('shows error on failure', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    });
    render(<MintButton contentId={1} />);
    fireEvent.click(screen.getByRole('button', { name: /mint/i }));
    await waitFor(() => screen.getByText(/error:/i));
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});


