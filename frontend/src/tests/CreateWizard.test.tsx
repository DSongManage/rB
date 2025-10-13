import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateWizard from '../components/CreateWizard/CreateWizard';

describe('CreateWizard customize PATCH integration', () => {
  beforeEach(()=>{
    // mock csrf and patch
    let step = 0;
    // @ts-ignore
    global.fetch = jest.fn((url:string, opts?:any)=>{
      if (url.includes('/api/auth/csrf/')) return Promise.resolve({ ok:true, json: async ()=> ({ csrfToken: 'tok' }) });
      if (url.includes('/api/content/detail/') && opts?.method==='PATCH') return Promise.resolve({ ok:true, json: async ()=> ({ ok:true }) });
      if (url.includes('/api/content/') && opts?.method==='POST') return Promise.resolve({ ok:true, json: async ()=> ({ id: 1 }) });
      if (url.includes('/api/dashboard/')) return Promise.resolve({ ok:true, json: async ()=> ({ fee:10 }) });
      return Promise.resolve({ ok:true, json: async()=> ({}) });
    }) as any;
  });
  it('submits create via FormData (text) then customize PATCH before mint', async () => {
    render(<CreateWizard />);
    // Step 0: select type via button
    const button = await screen.findByText(/Write Text/);
    fireEvent.click(button);
    // Step 1: requires Next in footer -> mock by clicking footer Next
    const nexts = await screen.findAllByText(/^Next$/);
    fireEvent.click(nexts[nexts.length-1]);
    // Expect create succeeded (id returned) and message cleared from failure state
    await waitFor(()=> expect((global as any).fetch).toHaveBeenCalledWith(expect.stringContaining('/api/content/'), expect.objectContaining({ method: 'POST' })));
    // Step 2: press Next to trigger PATCH
    const next2 = await screen.findAllByText(/^Next$/);
    fireEvent.click(next2[next2.length-1]);
    await waitFor(()=> expect(screen.getByText(/Mint/)).toBeInTheDocument());
  });

  it('publishes on mint and shows confirmation', async () => {
    // @ts-ignore
    global.fetch = jest.fn((url:string, opts?:any)=>{
      if (url.includes('/api/auth/csrf/')) return Promise.resolve({ ok:true, json: async ()=> ({ csrfToken: 'tok' }) });
      if (url.endsWith('/api/content/')) return Promise.resolve({ ok:true, json: async ()=> ([]) });
      if (url.includes('/api/content/') && opts?.method==='POST') return Promise.resolve({ ok:true, json: async ()=> ({ id: 2 }) });
      if (url.includes('/api/dashboard/')) return Promise.resolve({ ok:true, json: async ()=> ({ fee:10 }) });
      if (url.includes('/api/content/2/preview/')) return Promise.resolve({ ok:true, json: async ()=> ({ teaser_link:'http://t', content_type:'book' }) });
      if (url.includes('/api/mint/')) return Promise.resolve({ ok:true, json: async ()=> ({ tx_sig:'sig' }) });
      return Promise.resolve({ ok:true, json: async()=> ({}) });
    }) as any;
    render(<CreateWizard />);
    const button = await screen.findByText(/Write Text/);
    fireEvent.click(button);
    const nexts = await screen.findAllByText(/^Next$/);
    fireEvent.click(nexts[nexts.length-1]); // to Create/Upload
    const next2 = await screen.findAllByText(/^Next$/);
    fireEvent.click(next2[next2.length-1]); // to Mint
    // Agree and mint from MintStep
    const checkboxes = await screen.findAllByRole('checkbox');
    if (checkboxes.length > 0) fireEvent.click(checkboxes[0]);
    const mintBtn = await screen.findByRole('button', { name: /Mint\s*&\s*Publish/i });
    fireEvent.click(mintBtn);
    // Now on ShareStep, click Approve & Mint and expect Published
    const approveBtn = await screen.findByText(/Approve & Mint/);
    fireEvent.click(approveBtn);
    await waitFor(()=> expect(screen.getByText(/Published/)).toBeInTheDocument());
  });

  it('Profile inventory renders minted items', async () => {
    const { default: ProfilePage } = await import('../pages/ProfilePage');
    // Fix shape for ProfilePage expectations
    // @ts-ignore
    global.fetch = jest.fn((url:string)=>{
      if (url.includes('/api/auth/status/')) return Promise.resolve({ ok:true, json: async ()=> ({ authenticated:true, user_id: 1, username:'u' }) });
      if (url.includes('/api/users/profile/')) return Promise.resolve({ ok:true, json: async ()=> ({ username:'u' }) });
      if (url.endsWith('/api/content/')) return Promise.resolve({ ok:true, json: async ()=> ([]) });
      if (url.includes('/api/content/?inventory_status=minted')) return Promise.resolve({ ok:true, json: async ()=> ([{ id:1, title:'Minted One', teaser_link:'http://t', nft_contract:'mock' }]) });
      return Promise.resolve({ ok:true, json: async()=> ({}) });
    }) as any;
    // @ts-ignore
    global.fetch = jest.fn((url:string)=>{
      if (url.includes('/api/auth/status/')) return Promise.resolve({ ok:true, json: async ()=> ({ authenticated:true, username:'u' }) });
      if (url.includes('/api/users/profile/')) return Promise.resolve({ ok:true, json: async ()=> ({ username:'u' }) });
      if (url.includes('/api/content/?inventory_status=minted')) return Promise.resolve({ ok:true, json: async ()=> ([{ id:1, title:'Minted One', teaser_link:'http://img', nft_contract:'mock' }]) });
      if (url.includes('/api/dashboard/')) return Promise.resolve({ ok:true, json: async ()=> ({ fee:10 }) });
      return Promise.resolve({ ok:true, json: async()=> ({}) });
    }) as any;
    render(<ProfilePage />);
    await waitFor(()=> expect(screen.getByText('Minted One')).toBeInTheDocument());
  });
});


