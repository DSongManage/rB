import React from 'react';
import { render, screen } from '@testing-library/react';
import SignupForm from '../../src/components/SignupForm';

describe('SignupForm', () => {
  it('renders Web3Auth create button', async () => {
    render(<SignupForm />);
    expect(await screen.findByText(/Create account with Web3Auth/i)).toBeInTheDocument();
  });
});


