import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders renaissBlock header', () => {
  render(<App />);
  const headerElement = screen.getByText(/renaissBlock Content/i);
  expect(headerElement).toBeInTheDocument();
});
