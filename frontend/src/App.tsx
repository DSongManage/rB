import React, { useEffect, useState } from 'react';
import './App.css';

interface Content {
  id: number;
  title: string;
  teaser_link: string;
  created_at: string;
  creator: number;
}

function App() {
  const [contentList, setContentList] = useState<Content[]>([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/content/')
      .then(response => response.json())
      .then(data => setContentList(data))
      .catch(error => console.error('Error fetching content:', error));
  }, []);

  const handleMint = () => {
    fetch('http://127.0.0.1:8000/api/mint/', { method: 'POST' })  // Placeholder endpoint
      .then(response => response.json())
      .then(data => alert('Mint successful! NFT ID: ' + (data.nft_id || 'unknown')))  // Simulate response; handle undefined
      .catch((error: any) => console.error('Mint error:', error));  // Typed error
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>renaissBlock Content</h1>
        <button onClick={handleMint}>Mint NFT</button>  # Prototype mint button (triggers backend/Anchor per FR5)
        <ul>
          {contentList.map(item => (
            <li key={item.id}>
              <a href={item.teaser_link}>{item.title}</a> (Created: {item.created_at})
            </li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;
