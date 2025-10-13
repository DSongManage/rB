import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders logo', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByAltText('renaissBlock')).toBeInTheDocument();
});
