import React from 'react';
import { LayoutDashboard, FileText, Users, MessageSquare, Rocket } from 'lucide-react';

export type TabId = 'overview' | 'content' | 'team' | 'activity' | 'publish';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  badges?: {
    activity?: number;
    team?: number;
  };
  isFullyApproved?: boolean;
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'content', label: 'Content', icon: <FileText size={18} /> },
  { id: 'team', label: 'Team', icon: <Users size={18} /> },
  { id: 'activity', label: 'Activity', icon: <MessageSquare size={18} /> },
  { id: 'publish', label: 'Publish', icon: <Rocket size={18} /> },
];

export default function TabNavigation({
  activeTab,
  onTabChange,
  badges = {},
  isFullyApproved = false,
}: TabNavigationProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      background: 'var(--panel)',
      padding: 4,
      borderRadius: 12,
      border: '1px solid var(--panel-border)',
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const badge = tab.id === 'activity' ? badges.activity :
                     tab.id === 'team' ? badges.team : undefined;

        // Highlight publish tab when ready
        const isPublishReady = tab.id === 'publish' && isFullyApproved;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: isActive
                ? 'var(--bg)'
                : isPublishReady
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'transparent',
              border: isActive
                ? '1px solid var(--panel-border)'
                : isPublishReady
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid transparent',
              borderRadius: 8,
              color: isActive
                ? 'var(--text)'
                : isPublishReady
                  ? '#10b981'
                  : '#94a3b8',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {badge !== undefined && badge > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 10,
                minWidth: 18,
                textAlign: 'center',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
