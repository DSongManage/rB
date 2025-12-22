import { useState, useEffect } from 'react';

export interface MobileState {
  isMobile: boolean;      // <= 768px
  isPhone: boolean;       // <= 480px
  isTablet: boolean;      // 481px - 768px
  isDesktop: boolean;     // > 768px
  screenWidth: number;
}

function getState(): MobileState {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
  return {
    isMobile: width <= 768,
    isPhone: width <= 480,
    isTablet: width > 480 && width <= 768,
    isDesktop: width > 768,
    screenWidth: width,
  };
}

export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>(getState);

  useEffect(() => {
    const handleResize = () => setState(getState());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
