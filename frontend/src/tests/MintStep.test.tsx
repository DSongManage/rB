import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MintStep from '../../components/CreateWizard/MintStep';

describe('MintStep fee math', () => {
  beforeEach(()=>{
    // mock dashboard fee to 10%
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ ok:true, json: async ()=> ({ fee: 10 }) });
  });
  it('renders gross, fee and net', async () => {
    render(<MintStep onMint={()=>{}} price={2} editions={5} />);
    await waitFor(()=> expect(screen.getByText(/Gross:/)).toBeInTheDocument());
    expect(screen.getByText(/Gross: \$10.00/)).toBeInTheDocument();
    expect(screen.getByText(/Platform Fee: 10%/)).toBeInTheDocument();
    expect(screen.getByText(/Net: \$9.00/)).toBeInTheDocument();
  });
});


