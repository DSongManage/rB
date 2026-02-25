import React from 'react';
import { Link } from 'react-router-dom';

export default function WalletInfoPage() {
  return (
    <div className="page" style={{maxWidth:720, margin:'40px auto'}}>
      <h2 style={{color:'#e5e7eb'}}>About Your Wallet</h2>
      <p style={{color:'#94a3b8'}}>When you sign up, we automatically create a Solana wallet for you using Web3Auth's secure infrastructure. No seed phrases or complex setup required!</p>
      <ul style={{color:'#cbd5e1', marginTop:12}}>
        <li><strong>Automatic creation:</strong> Your wallet is created in the background when you register</li>
        <li><strong>Social login security:</strong> Access your wallet through your existing social login — no seed phrases to memorize</li>
        <li><strong>Receive NFTs instantly:</strong> When you purchase content, NFTs are minted directly to your wallet</li>
        <li><strong>Your data:</strong> We store only your public Solana address for linking and payouts</li>
        <li><strong>Optional:</strong> You can connect your own Solana wallet anytime from your Profile</li>
      </ul>
      <div style={{marginTop:16, color:'#94a3b8'}}>
        Learn more about Web3Auth: <a href="https://web3auth.io" target="_blank" rel="noreferrer" style={{color:'#60a5fa'}}>web3auth.io</a>
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
