import React from 'react';
import { Link } from 'react-router-dom';

export default function WalletInfoPage() {
  return (
    <div className="page" style={{maxWidth:720, margin:'40px auto'}}>
      <h2 style={{color:'#e5e7eb'}}>About Web3Auth Wallets</h2>
      <p style={{color:'#94a3b8'}}>Web3Auth creates a keyless, non-custodial wallet for you. Your private key is never stored by renaissBlock. Instead, it’s split using threshold cryptography and reconstructed when you authenticate.</p>
      <ul style={{color:'#cbd5e1', marginTop:12}}>
        <li>Non-custodial: you control the wallet; we don’t hold your keys.</li>
        <li>Keyless setup: no seed phrase to write down; recovery options are available in your Web3Auth account.</li>
        <li>Public-only data on our side: we store your public address for linking and payouts.</li>
        <li>Optional: you can skip Web3Auth and paste your own Solana address anytime from Profile.</li>
      </ul>
      <div style={{marginTop:16, color:'#94a3b8'}}>
        Learn more in Web3Auth docs: <a href="https://web3auth.io/docs" target="_blank" rel="noreferrer" style={{color:'#60a5fa'}}>web3auth.io/docs</a>
      </div>
      <div style={{marginTop:8, color:'#94a3b8'}}>
        renaissBlock Terms: <Link to="/terms" style={{color:'#60a5fa'}}>View terms</Link>
      </div>
      <div style={{marginTop:16}}>
        <Link to="/auth" style={{color:'#60a5fa'}}>Back to sign up</Link>
      </div>
    </div>
  );
}
