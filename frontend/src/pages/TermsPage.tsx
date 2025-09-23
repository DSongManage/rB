import React from 'react';

export default function TermsPage() {
  return (
    <div className="page" style={{maxWidth:720, margin:'40px auto'}}>
      <h2 style={{color:'#e5e7eb'}}>Terms & Disclosures</h2>
      <p style={{color:'#94a3b8'}}>By creating an account, you agree to our platform terms and content policies. Highlights:</p>
      <ul style={{color:'#cbd5e1', marginTop:12}}>
        <li>No storage of private keys; wallets are non-custodial via Web3Auth.</li>
        <li>Public wallet addresses may be used for payouts and on-chain interactions.</li>
        <li>Content must comply with our acceptable use policy and applicable laws.</li>
      </ul>
      <div style={{marginTop:12}}>
        <a href="/terms_and_conditions.md" target="_blank" rel="noreferrer" style={{color:'#60a5fa'}}>Read full terms (Markdown)</a>
      </div>
    </div>
  );
}
