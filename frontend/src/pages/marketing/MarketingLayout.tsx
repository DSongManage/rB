import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import './marketing.css';

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="marketing-app">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
