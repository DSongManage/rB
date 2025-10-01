import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateWizard from '../../components/CreateWizard/CreateWizard';

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
  it('submits customize PATCH before mint', async () => {
    render(<CreateWizard />);
    // Step 0: select type via button
    const button = await screen.findByText(/Write Text/);
    fireEvent.click(button);
    // Step 1: requires Next in footer -> mock by clicking footer Next
    const nexts = await screen.findAllByText(/^Next$/);
    fireEvent.click(nexts[nexts.length-1]);
    // Step 2: press Next to trigger PATCH
    const next2 = await screen.findAllByText(/^Next$/);
    fireEvent.click(next2[next2.length-1]);
    await waitFor(()=> expect((global.fetch as any)).toHaveBeenCalledWith(expect.stringMatching(/\/api\/content\/detail\//), expect.objectContaining({ method:'PATCH' })));
  });

  it('publishes on mint and shows confirmation', async () => {
    // @ts-ignore
    global.fetch = jest.fn((url:string, opts?:any)=>{
      if (url.includes('/api/auth/csrf/')) return Promise.resolve({ ok:true, json: async ()=> ({ csrfToken: 'tok' }) });
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
    const shareBtn = await screen.findByText(/Approve & Mint/);
    fireEvent.click(shareBtn);
    await waitFor(()=> expect(screen.getByText(/Published/)).toBeInTheDocument());
  });

  it('Profile inventory renders minted items', async () => {
    const { default: ProfilePage } = await import('../../pages/ProfilePage');
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


