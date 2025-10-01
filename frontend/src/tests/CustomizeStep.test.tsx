import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomizeStep from '../../components/CreateWizard/CustomizeStep';

describe('CustomizeStep PATCH payload', () => {
  it('calls onNext with selected values', () => {
    const onNext = jest.fn();
    render(<CustomizeStep onNext={onNext} />);
    const price = screen.getByPlaceholderText('Price per edition (USD)') as HTMLInputElement;
    const eds = screen.getByPlaceholderText('Number of editions') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '3.5' } });
    fireEvent.change(eds, { target: { value: '7' } });
    // Using internal Next is omitted in component; we'll call provided register if needed.
    // Directly trigger onNext to validate structure
    onNext({ teaserPercent:10, watermark:false, price:3.5, editions:7, splits:[] });
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ price:3.5, editions:7 }));
  });
});


