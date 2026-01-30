/**
 * TierBadge — small badge displaying a creator's tier.
 */
import React from 'react';

interface TierBadgeProps {
  tier: string;
  className?: string;
}

const TIER_LABELS: Record<string, string> = {
  founding: 'Founding Creator',
  level_5: 'Level 5',
  level_4: 'Level 4',
  level_3: 'Level 3',
  level_2: 'Level 2',
  level_1: 'Level 1',
  standard: 'Standard',
};

const TIER_COLORS: Record<string, string> = {
  founding: 'bg-amber-500 text-white',
  level_5: 'bg-purple-600 text-white',
  level_4: 'bg-indigo-500 text-white',
  level_3: 'bg-blue-500 text-white',
  level_2: 'bg-teal-500 text-white',
  level_1: 'bg-green-500 text-white',
  standard: 'bg-gray-500 text-white',
};

const TierBadge: React.FC<TierBadgeProps> = ({ tier, className = '' }) => {
  const label = TIER_LABELS[tier] || tier;
  const color = TIER_COLORS[tier] || TIER_COLORS.standard;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {tier === 'founding' && (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {label}
    </span>
  );
};

export default TierBadge;
