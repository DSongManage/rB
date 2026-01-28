import React from 'react';
import { LayoutDashboard, FileText, Users, MessageSquare, Rocket, ScrollText, Layers, Image, BookOpen } from 'lucide-react';

export type TabId = 'overview' | 'script' | 'content' | 'team' | 'activity' | 'publish';

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
  contentType?: 'comic' | 'book' | 'art';
  isSolo?: boolean;
}

function getTabs(contentType?: 'comic' | 'book' | 'art', isSolo?: boolean): Tab[] {
  const baseTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  ];

  // Add content-specific tabs based on content type
  if (contentType === 'comic') {
    // Comic: has Script tab AND Comic tab
    baseTabs.push(
      { id: 'script', label: 'Script', icon: <ScrollText size={18} /> },
      { id: 'content', label: 'Comic', icon: <Layers size={18} /> }
    );
  } else if (contentType === 'book') {
    // Book: has Editor tab (writer's editor) - no Script
    baseTabs.push(
      { id: 'content', label: 'Editor', icon: <BookOpen size={18} /> }
    );
  } else if (contentType === 'art') {
    // Art: has Gallery tab (image uploads) - no Script or Comic
    baseTabs.push(
      { id: 'content', label: 'Gallery', icon: <Image size={18} /> }
    );
  } else {
    // Fallback - show all tabs for unknown content types
    baseTabs.push(
      { id: 'script', label: 'Script', icon: <ScrollText size={18} /> },
      { id: 'content', label: 'Comic', icon: <Layers size={18} /> }
    );
  }

  // Add common tabs
  baseTabs.push(
    { id: 'team', label: 'Team', icon: <Users size={18} /> }
  );

  // Only show Activity tab for collaborative projects (not solo)
  if (!isSolo) {
    baseTabs.push({ id: 'activity', label: 'Activity', icon: <MessageSquare size={18} /> });
  }

  baseTabs.push({ id: 'publish', label: 'Publish', icon: <Rocket size={18} /> });

  return baseTabs;
}

export default function TabNavigation({
  activeTab,
  onTabChange,
  badges = {},
  isFullyApproved = false,
  contentType,
  isSolo = false,
}: TabNavigationProps) {
  const tabs = getTabs(contentType, isSolo);
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
